import asyncio
import os
import unittest
import uuid
from datetime import datetime, timedelta, timezone

import httpx

from main import create_app
from app.middlewares.auth import get_current_user
from app.models import Book, ReadingHistory, SessionLocal, User, engine, get_db


class AdminAnalyticsTests(unittest.TestCase):
    @unittest.skipUnless(os.getenv('BOOKAPP_TEST_MYSQL') == '1', 'optional MySQL integration')
    def test_admin_analytics_dates_counts_and_access(self):
        async def run():
            try:
                async with SessionLocal() as db:
                    try:
                        suffix = uuid.uuid4().hex[:7]
                        now = datetime.now(timezone.utc).replace(tzinfo=None)
                        actor = User(username='analytics', email=f'{suffix}@example.test', sdt=f'a{suffix}', password='test-only', role='admin', created_at=now)
                        db.add(actor)
                        await db.flush()
                        app = create_app()
                        app.dependency_overrides[get_current_user] = lambda: actor
                        async def test_db():
                            yield db
                        app.dependency_overrides[get_db] = test_db
                        async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url='http://test') as client:
                            url = '/api/v1/admin/stats?days=7'
                            before_response = await client.get(url)
                            self.assertEqual(before_response.status_code, 200, before_response.text)
                            before = before_response.json()['data']
                            first = now.date() - timedelta(days=6)
                            book = Book(title='Analytics fixture', author='Test', genre=f'fixture-{suffix}', created_at=datetime.combine(first, datetime.min.time()))
                            db.add(book)
                            await db.flush()
                            db.add_all([ReadingHistory(user_id=actor.id, book_id=book.id), ReadingHistory(user_id=actor.id, book_id=book.id)])
                            await db.flush()
                            data = (await client.get(url)).json()['data']
                            self.assertEqual(len(data['daily']), 7)
                            self.assertEqual(data['daily'][0]['date'], str(first))
                            self.assertEqual(data['daily'][-1]['date'], str(now.date()))
                            self.assertEqual(data['daily'][0]['books'], before['daily'][0]['books'] + 1)
                            self.assertEqual(data['total_books'], before['total_books'] + 1)
                            self.assertEqual(data['total_reads'], before['total_reads'] + 2)
                            self.assertEqual(sum(g['count'] for g in data['genres']), data['total_books'])
                            self.assertEqual(next(b for b in data['popular_books'] if b['id'] == book.id)['readers'], 1)
                            self.assertEqual((await client.get('/api/v1/admin/stats?days=0')).status_code, 422)
                            self.assertEqual((await client.get('/api/v1/admin/stats?days=91')).status_code, 422)
                            actor.role = 'user'
                            self.assertEqual((await client.get(url)).status_code, 403)
                    finally:
                        await db.rollback()
            finally:
                await engine.dispose()
        asyncio.run(run())
