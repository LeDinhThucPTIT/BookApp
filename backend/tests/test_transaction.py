import unittest
from unittest.mock import AsyncMock, patch

import httpx
from fastapi import Depends, FastAPI
from sqlalchemy.exc import SQLAlchemyError

from app.middlewares.error_handler import register_error_handlers
from app.models.database import get_db


class TransactionTests(unittest.IsolatedAsyncioTestCase):
    async def test_commit_finishes_before_success_response_starts(self):
        order = []
        db = AsyncMock()
        db.info = {}
        db.commit.side_effect = lambda: order.append('commit')
        context = AsyncMock()
        context.__aenter__.return_value = db
        app = FastAPI()

        @app.post('/write', status_code=201)
        async def write(session=Depends(get_db, scope='function')):
            return {'saved': True}

        async def observed(scope, receive, send):
            async def capture(message):
                if message['type'] == 'http.response.start':
                    order.append('response')
                await send(message)
            await app(scope, receive, capture)

        with patch('app.models.database.SessionLocal', return_value=context):
            async with httpx.AsyncClient(transport=httpx.ASGITransport(app=observed), base_url='http://test') as client:
                self.assertEqual((await client.post('/write')).status_code, 201)
        self.assertEqual(order, ['commit', 'response'])

    async def test_commit_failure_returns_error_instead_of_false_success(self):
        db = AsyncMock()
        db.info = {}
        db.commit.side_effect = SQLAlchemyError('private database details')
        context = AsyncMock()
        context.__aenter__.return_value = db
        app = FastAPI()
        register_error_handlers(app)

        @app.post('/write', status_code=201)
        async def write(session=Depends(get_db, scope='function')):
            return {'saved': True}

        with patch('app.models.database.SessionLocal', return_value=context), patch('app.middlewares.error_handler.logger'):
            async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url='http://test') as client:
                response = await client.post('/write')
        self.assertEqual(response.status_code, 500)
        self.assertEqual(response.json()['error_code'], 'DATABASE_ERROR')
        self.assertNotIn('private database details', response.text)
        db.rollback.assert_awaited_once()
