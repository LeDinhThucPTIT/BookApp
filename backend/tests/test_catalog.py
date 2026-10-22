import asyncio
import os
import unittest
import uuid
from types import SimpleNamespace
from unittest.mock import AsyncMock
from unittest.mock import patch

import httpx

from main import create_app
from app.models import Book, Comment, Favorite, Rating, Save, SessionLocal, User, engine, get_db
from app.middlewares.auth import get_current_user
from app.routes.deps import get_book_service


class CatalogTests(unittest.TestCase):
    def test_readiness_checks_database_and_does_not_expose_failures(self):
        from app.config import settings
        async def run():
            app = create_app()
            db = SimpleNamespace(execute=AsyncMock())
            session = AsyncMock()
            session.__aenter__.return_value = db
            with patch('app.models.SessionLocal', return_value=session), patch.object(settings, 'redis_url', None):
                async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url='http://test') as client:
                    self.assertEqual((await client.get('/health/ready')).status_code, 200)
                    db.execute.side_effect = RuntimeError('private connection details')
                    response = await client.get('/health/ready')
                    self.assertEqual(response.status_code, 503)
                    self.assertNotIn('private connection', response.text)
        asyncio.run(run())

    def test_catalog_rejects_unbounded_or_invalid_queries(self):
        async def run():
            app = create_app()
            service = SimpleNamespace(catalog=AsyncMock(return_value={'items': [], 'total': 0, 'page': 1, 'page_size': 12}))
            app.dependency_overrides[get_book_service] = lambda: service
            async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url='http://test') as client:
                for params in [{'page': 0}, {'page_size': 101}, {'sort': 'random'}, {'search': 'a' * 201}]:
                    self.assertEqual((await client.get('/api/v1/books/catalog', params=params)).status_code, 422)
                service.catalog.assert_not_called()
                response = await client.get('/api/v1/books/catalog', params={'search': 'River', 'sort': 'favorites'})
                self.assertEqual(response.status_code, 200)
                service.catalog.assert_awaited_once_with(1, 12, 'River', 'favorites')
                self.assertIn('x-request-id', response.headers)
                response = await client.post('/api/v1/auth/login', headers={'Origin': 'https://untrusted.example'}, json={})
                self.assertEqual(response.status_code, 403)
        asyncio.run(run())

    @unittest.skipUnless(os.getenv('BOOKAPP_TEST_MYSQL') == '1', 'optional MySQL integration')
    def test_mysql_search_pagination_and_real_favorite_ranking(self):
        async def run():
            try:
                async with SessionLocal() as db:
                    try:
                        prefix = 'catalog-' + uuid.uuid4().hex[:10]
                        users = [User(username=prefix, email=f'{prefix}-{i}@example.test', sdt=f'c{i}{prefix[-7:]}', password='unused') for i in range(2)]
                        db.add_all(users); await db.flush()
                        books = [Book(title=f'{prefix} {title}', author='Catalog author') for title in ['A', 'B', '100% literal']]
                        db.add_all(books); await db.flush()
                        db.add_all([Favorite(user_id=user.id, book_id=books[0].id) for user in users])
                        db.add(Favorite(user_id=users[0].id, book_id=books[1].id))
                        db.add_all([Rating(user_id=users[0].id, book_id=books[0].id, stars=2), Rating(user_id=users[0].id, book_id=books[1].id, stars=5)])
                        db.add_all([Save(user_id=users[0].id, book_id=book.id) for book in books])
                        db.add_all([Comment(user_id=users[0].id, book_id=books[0].id, content=f'Comment {i}') for i in range(25)])
                        await db.flush()
                        app = create_app()
                        async def test_db():
                            yield db
                        app.dependency_overrides[get_db] = test_db
                        app.dependency_overrides[get_current_user] = lambda: users[0]
                        async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url='http://test') as client:
                            async def query(**params):
                                response = await client.get('/api/v1/books/catalog', params={'search': prefix, **params})
                                self.assertEqual(response.status_code, 200, response.text)
                                return response.json()['data']
                            first = await query(sort='favorites', page_size=1)
                            self.assertEqual(first['total'], 3)
                            self.assertEqual(first['items'][0]['id'], books[0].id)
                            self.assertEqual(first['items'][0]['favorite_count'], 2)
                            self.assertEqual((await query(sort='favorites', page_size=1, page=2))['items'][0]['id'], books[1].id)
                            self.assertEqual((await query(sort='rating'))['items'][0]['id'], books[1].id)
                            literal = await query(search=prefix + ' 100%')
                            self.assertEqual(literal['total'], 1)
                            self.assertEqual((await query(page=50))['items'], [])
                            response = await client.get('/api/v1/library', params={'page_size': 2})
                            library = response.json()['data']
                            self.assertEqual(library['total'], 3)  # Saved+favorite is still one book.
                            self.assertEqual(len(library['items']), 2)
                            second = (await client.get('/api/v1/library', params={'page_size': 2, 'page': 2})).json()['data']
                            self.assertEqual(len(second['items']), 1)
                            self.assertFalse({item['book_id'] for item in library['items']} & {item['book_id'] for item in second['items']})
                            app.dependency_overrides[get_current_user] = lambda: users[1]
                            other = (await client.get('/api/v1/library')).json()['data']
                            self.assertEqual(other['total'], 1)
                            self.assertEqual(other['items'][0]['book_id'], books[0].id)
                            url = f'/api/v1/books/{books[0].id}/comments/page'
                            first_comments = (await client.get(url)).json()['data']
                            next_comments = (await client.get(url, params={'page': 2})).json()['data']
                            self.assertEqual(first_comments['total'], 25)
                            self.assertEqual(len(first_comments['items']), 20)
                            self.assertEqual(len(next_comments['items']), 5)
                            self.assertFalse({item['id'] for item in first_comments['items']} & {item['id'] for item in next_comments['items']})
                            self.assertEqual((await client.post(f'/api/v1/books/{books[0].id}/comments', json={'content': '   '})).status_code, 422)
                    finally:
                        await db.rollback()
            finally:
                await engine.dispose()
        asyncio.run(run())
