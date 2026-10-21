import asyncio
import os
import unittest
import uuid

import httpx
from pydantic import ValidationError

from app.config.settings import Settings
from app.models import SessionLocal, engine, get_db
from app.schemas.auth import LoginRequest, RegisterRequest
from main import create_app


class AuthTests(unittest.TestCase):
    def test_environment_debug_mode(self):
        self.assertFalse(Settings(_env_file=None, debug='release').debug)
        self.assertTrue(Settings(_env_file=None, debug='debug').debug)

    def test_registration_normalizes_phone_email_but_preserves_password(self):
        payload = RegisterRequest(username=' reader ', email=' Reader@Example.com ', sdt='+84 912 345 678', password=' secret ')
        self.assertEqual(payload.sdt, '0912345678')
        self.assertEqual(payload.email, 'reader@example.com')
        self.assertEqual(payload.username, 'reader')
        self.assertEqual(payload.password, ' secret ')
        self.assertEqual(LoginRequest(email=' Reader@Example.com ', password=' secret ').email, 'reader@example.com')
        with self.assertRaises(ValidationError):
            RegisterRequest(username='reader', email='reader@example.com', sdt='abc123', password='secret')

    @unittest.skipUnless(os.getenv('BOOKAPP_TEST_MYSQL') == '1', 'optional MySQL integration')
    def test_register_login_cookie_me_and_logout(self):
        async def run():
            try:
                async with SessionLocal() as db:
                    try:
                        app = create_app()
                        async def test_db():
                            yield db
                        app.dependency_overrides[get_db] = test_db
                        email = f'auth-{uuid.uuid4().hex[:10]}@example.com'
                        async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app, client=('127.0.0.30', 111)), base_url='http://test') as client:
                            payload = {'email': email, 'username': 'New reader', 'name': 'Test reader', 'password': 'test-password-123', 'sdt': ''}
                            response = await client.post('/api/v1/auth/register', json=payload)
                            self.assertEqual(response.status_code, 201, response.text)
                            self.assertNotIn('password', response.json()['data'])
                            self.assertEqual((await client.post('/api/v1/auth/register', json=payload)).status_code, 409)
                            self.assertEqual((await client.post('/api/v1/auth/login', json={'email': email, 'password': 'wrong'})).status_code, 401)
                            response = await client.post('/api/v1/auth/login', json={'email': email.upper(), 'password': payload['password'], 'remember': False})
                            self.assertEqual(response.status_code, 200, response.text)
                            cookie = response.headers.get('set-cookie', '')
                            self.assertIn('HttpOnly', cookie)
                            self.assertNotIn('Max-Age', cookie)
                            # No bearer header: prove the actual returned cookie works.
                            response = await client.get('/api/v1/auth/me')
                            self.assertEqual(response.status_code, 200, response.text)
                            self.assertEqual(response.json()['data']['email'], email)
                            response = await client.post('/api/v1/auth/logout')
                            self.assertIn('Max-Age=0', response.headers.get('set-cookie', ''))
                            self.assertEqual((await client.get('/api/v1/auth/me')).status_code, 401)
                            response = await client.post('/api/v1/auth/login', json={'email': email, 'password': payload['password'], 'remember': True})
                            self.assertIn('Max-Age=', response.headers.get('set-cookie', ''))
                    finally:
                        await db.rollback()
            finally:
                await engine.dispose()
        asyncio.run(run())
