import asyncio
import os
import secrets
import unittest
from types import SimpleNamespace
from unittest.mock import AsyncMock, patch

from fastapi.security import HTTPAuthorizationCredentials
from jose import jwt
from pydantic import ValidationError
from starlette.requests import Request

from app.config import settings
from app.config.settings import Settings
from app.middlewares.auth import get_current_user
from app.utils.exceptions import AppError, UnauthorizedError
from app.utils.otp import OTPStore
from app.utils.security import create_access_token, hash_password, verify_password


class SecurityTests(unittest.IsolatedAsyncioTestCase):
    async def test_redis_lua_scripts_preserve_attempts_and_atomic_consumption(self):
        from fakeredis import FakeServer
        from fakeredis.aioredis import FakeRedis
        server = FakeServer()
        with patch('app.utils.otp.Redis.from_url', side_effect=lambda _: FakeRedis(server=server)):
            first, second = OTPStore('redis://emulator'), OTPStore('redis://emulator')
            token, otp = await first.create(123)
            with self.assertRaises(AppError) as caught:
                await second.create(123)
            self.assertEqual(caught.exception.error_code, 'OTP_COOLDOWN')
            wrong = '999999' if otp != '999999' else '000000'
            for attempt in range(5):
                with self.assertRaises(AppError) as caught:
                    await (first if attempt % 2 else second).consume(token, wrong)
                self.assertEqual(caught.exception.error_code, 'OTP_LOCKED' if attempt == 4 else 'OTP_INVALID')
            with self.assertRaises(AppError):
                await second.consume(token, otp)
            token, otp = await first.create(124)
            results = await asyncio.gather(first.consume(token, otp), second.consume(token, otp), return_exceptions=True)
            self.assertEqual(sum(value == 124 for value in results), 1)

    async def test_redis_failure_never_falls_back_to_process_memory(self):
        from redis.exceptions import ConnectionError
        store = OTPStore('redis://unavailable')
        with patch('app.utils.otp.Redis.from_url', side_effect=ConnectionError('unavailable')):
            for operation in [store.create(1), store.consume('token', '123456')]:
                with self.assertRaises(AppError) as caught:
                    await operation
                self.assertEqual(caught.exception.status_code, 503)
        self.assertEqual(store._items, {})

    async def test_plaintext_malformed_hash_and_wrong_password_are_rejected(self):
        self.assertFalse(verify_password('legacy-password', 'legacy-password'))
        self.assertFalse(verify_password('secret', 'pbkdf2:invalid$broken$hash'))
        hashed = hash_password('correct password')
        self.assertTrue(verify_password('correct password', hashed))
        self.assertFalse(verify_password('wrong password', hashed))

    async def test_revoked_and_malformed_tokens_are_unauthorized(self):
        request = Request({'type': 'http', 'headers': []})
        db = SimpleNamespace(scalar=AsyncMock(return_value=SimpleNamespace(id=1, token_version=2)))
        for token in [create_access_token(1, 'user', 1),
                      jwt.encode({'sub': 'bad-id', 'ver': 2}, settings.secret_key, algorithm=settings.jwt_algorithm),
                      jwt.encode({'sub': '1'}, settings.secret_key, algorithm=settings.jwt_algorithm)]:
            with self.assertRaises(UnauthorizedError):
                await get_current_user(request, HTTPAuthorizationCredentials(scheme='Bearer', credentials=token), None, db)
        user = await get_current_user(request, HTTPAuthorizationCredentials(scheme='Bearer', credentials=create_access_token(1, 'user', 2)), None, db)
        self.assertEqual(user.id, 1)

    async def test_production_configuration_fails_closed(self):
        valid = dict(_env_file=None, app_env='production', debug=False,
            jwt_secret_key='a' * 48, flask_secret_key=None, redis_url='redis://localhost:6379/0', cors_origins='https://books.example.com')
        self.assertTrue(Settings(**valid).production)
        for change in [dict(debug=True), dict(jwt_secret_key='change-me'), dict(redis_url=None), dict(cors_origins='http://localhost')]:
            with self.assertRaises(ValidationError):
                Settings(**(valid | change))
        config = Settings(_env_file=None, mysql_password='p@ss:/?#word')
        from sqlalchemy.engine import make_url
        self.assertEqual(make_url(config.database_url).password, 'p@ss:/?#word')

    async def test_production_cookie_is_secure_and_http_only(self):
        from fastapi import Response
        from app.routes.auth import _set_token_cookie
        response = Response()
        with patch.object(settings, 'app_env', 'production'):
            _set_token_cookie(response, 'test-token')
        self.assertIn('Secure', response.headers['set-cookie'])
        self.assertIn('HttpOnly', response.headers['set-cookie'])
        self.assertIn('SameSite=lax', response.headers['set-cookie'])

    async def test_otp_is_single_use_hashed_and_limits_guesses(self):
        store = OTPStore()
        token, otp = await store.create(1)
        self.assertNotIn(otp, repr(store._items))
        with self.assertRaises(AppError) as caught:
            await store.create(1)
        self.assertEqual(caught.exception.error_code, 'OTP_COOLDOWN')
        wrong = '999999' if otp != '999999' else '000000'
        for attempt in range(5):
            with self.assertRaises(AppError) as caught:
                await store.consume(token, wrong)
            self.assertEqual(caught.exception.error_code, 'OTP_LOCKED' if attempt == 4 else 'OTP_INVALID')
        with self.assertRaises(AppError):
            await store.consume(token, otp)
        token, otp = await store.create(2)
        results = await asyncio.gather(store.consume(token, otp), store.consume(token, otp), return_exceptions=True)
        self.assertEqual(sum(value == 2 for value in results), 1)

    async def test_expired_and_replaced_otps_cannot_reset_password(self):
        store = OTPStore()
        with patch('app.utils.otp.time.time', return_value=100):
            token, otp = await store.create(1)
        with patch('app.utils.otp.time.time', return_value=161):
            new_token, new_otp = await store.create(1)
            with self.assertRaises(AppError):
                await store.consume(token, otp)
        with patch('app.utils.otp.time.time', return_value=800):
            with self.assertRaises(AppError):
                await store.consume(new_token, new_otp)

    @unittest.skipUnless(os.getenv('BOOKAPP_TEST_REDIS'), 'optional real Redis integration')
    async def test_redis_shares_attempts_and_consumes_atomically_between_workers(self):
        url = os.environ['BOOKAPP_TEST_REDIS']
        first, second = OTPStore(url), OTPStore(url)
        user_id = secrets.randbelow(1_000_000_000) + 1000000
        token, otp = await first.create(user_id)
        wrong = '999999' if otp != '999999' else '000000'
        for attempt in range(5):
            with self.assertRaises(AppError) as caught:
                await (first if attempt % 2 else second).consume(token, wrong)
            self.assertEqual(caught.exception.error_code, 'OTP_LOCKED' if attempt == 4 else 'OTP_INVALID')
        with self.assertRaises(AppError):
            await second.consume(token, otp)
        token, otp = await first.create(user_id + 1)
        results = await asyncio.gather(first.consume(token, otp), second.consume(token, otp), return_exceptions=True)
        self.assertEqual(sum(value == user_id + 1 for value in results), 1)
