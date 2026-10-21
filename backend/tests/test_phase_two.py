import asyncio
import os
import unittest
import uuid
from types import SimpleNamespace
from unittest.mock import AsyncMock, patch

import httpx

from main import create_app
from app.middlewares.auth import get_current_user
from app.models import SessionLocal, User, engine, get_db
from app.services.ai_service import AIService
from app.utils.reader import html_to_text, paginate_text, utf16_slice, locate_quote


class PhaseTwoTests(unittest.TestCase):
    def test_reader_preserves_text_and_removes_active_content(self):
        text = html_to_text('<p>Hello<br>world</p><script>bad()</script><style>bad</style>')
        self.assertEqual(paginate_text(text), ['Hello\n\nworld'])
        pages = paginate_text('word ' * 2000)
        self.assertTrue(all(len(page) <= 1800 for page in pages))
        self.assertEqual(' '.join(pages), ('word ' * 2000).strip())
        self.assertEqual(utf16_slice('a😀b', 1, 3), '😀')
        self.assertIsNone(locate_quote(['same same'], 'same'))
        self.assertEqual(locate_quote(['prefix 😀 quote'], 'quote'), (0, 10, 15))

    def test_ai_filters_invented_citations_and_keeps_history(self):
        async def run():
            mock = AsyncMock(return_value='{"answer":"A supported explanation", "citations":[{"quote":"Exact evidence", "book_id":999},{"quote":"Invented evidence"}], "suggested_questions":[]}')
            with patch.object(AIService, '_call_gemini_api', new=mock):
                result = await AIService.ask_question('Why?', 'Exact evidence in the book.', history=[{'role': 'user', 'content': 'Earlier question'}])
                self.assertEqual([item['quote'] for item in result['citations']], ['Exact evidence'])
                self.assertIsNone(result['citations'][0]['book_id'])
                self.assertIn('Earlier question', mock.call_args.args[0])
        asyncio.run(run())

    @unittest.skipUnless(os.getenv('BOOKAPP_TEST_MYSQL') == '1', 'optional MySQL integration')
    def test_mysql_stories_annotations_and_ai_sources(self):
        async def run():
            try:
                async with SessionLocal() as db:
                    try:
                        suffix = uuid.uuid4().hex[:7]
                        owner = User(username='phase-two-owner', email=f'{suffix}@example.test', sdt=f'a{suffix}', password='test-only')
                        other = User(username='phase-two-other', email=f'x{suffix}@example.test', sdt=f'b{suffix}', password='test-only')
                        db.add_all([owner, other]); await db.flush()
                        app = create_app()
                        app.dependency_overrides[get_current_user] = lambda: owner
                        async def test_db():
                            yield db
                        app.dependency_overrides[get_db] = test_db
                        async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app, client=('127.0.0.12', 111)), base_url='http://test') as client:
                            response = await client.post('/api/v1/stories', json={'title': 'Integration story', 'author': 'Test'})
                            self.assertEqual(response.status_code, 201, response.text)
                            book_id = response.json()['data']['id']
                            story_url = f'/api/v1/stories/{book_id}'
                            chapter = {'number': 2, 'title': 'Arrival', 'content': 'A😀 hero follows the river.\nA new journey begins.'}
                            response = await client.post(f'{story_url}/chapters', json=chapter)
                            self.assertEqual(response.status_code, 201, response.text)
                            chapter_id = response.json()['data']['id']
                            self.assertEqual((await client.post(f'{story_url}/chapters', json=chapter)).status_code, 409)
                            listing = (await client.get('/api/v1/stories')).json()['data']
                            self.assertEqual(next(item for item in listing if item['id'] == book_id)['chapter_count'], 1)
                            content = (await client.get(f'/api/v1/books/{book_id}/content')).json()['data']
                            self.assertTrue(content['is_story'])
                            self.assertEqual(content['pages'][0]['chapter_id'], chapter_id)
                            self.assertIn('A😀 hero', content['pages'][0]['text'])
                            metadata = (await client.get(f'{story_url}/chapters')).json()['data']
                            self.assertNotIn('content', metadata[0])
                            base = f'/api/v1/books/{book_id}/annotations'
                            selection = {'page': 0, 'quote': 'A😀', 'start_offset': 0, 'end_offset': 3, 'note': 'My note'}
                            response = await client.post(base, json=selection)
                            self.assertEqual(response.status_code, 201, response.text)
                            annotation_id = response.json()['data']['id']
                            self.assertEqual((await client.post(base, json={**selection, 'quote': 'Fake'})).status_code, 409)
                            app.dependency_overrides[get_current_user] = lambda: other
                            self.assertEqual((await client.get(base)).json()['data'], [])
                            self.assertEqual((await client.patch(f'/api/v1/annotations/{annotation_id}', json={'note': 'stolen'})).status_code, 404)
                            self.assertEqual((await client.delete(f'{story_url}/chapters/{chapter_id}')).status_code, 403)
                            app.dependency_overrides[get_current_user] = lambda: owner
                            with patch.object(AIService, '_call_gemini_api', new=AsyncMock(return_value='{"answer":"The hero follows a river.","citations":[{"quote":"follows the river"},{"quote":"invented"}]}')):
                                response = await client.post('/api/v1/ai/ask', json={'book_id': book_id, 'page': 0, 'context': 'An untrusted made-up page', 'question': 'Where?', 'selected_text': 'follows the river'})
                                self.assertEqual(response.status_code, 200, response.text)
                                cites = response.json()['data']['citations']
                                self.assertEqual(len(cites), 1)
                                self.assertEqual((cites[0]['book_id'], cites[0]['page'], cites[0]['chapter_title']), (book_id, 0, 'Arrival'))
                            response = await client.patch(f'/api/v1/annotations/{annotation_id}', json={'note': 'Updated', 'color': 'pink'})
                            self.assertEqual(response.json()['data']['note'], 'Updated')
                            earlier = await client.post(f'{story_url}/chapters', json={'number': 1, 'title': 'Before', 'content': 'A new earlier chapter.'})
                            self.assertEqual(earlier.status_code, 201)
                            notes = (await client.get(base)).json()['data']
                            self.assertEqual(notes[0]['page'], 1)
                            self.assertEqual(notes[0]['chapter_id'], chapter_id)
                            self.assertFalse(notes[0]['source_missing'])
                            lazy = (await client.get(f'/api/v1/books/{book_id}/content')).json()['data']
                            self.assertEqual(lazy['total_pages'], 2)
                            self.assertEqual(len(lazy['pages']), 1)
                            self.assertNotIn('hero', lazy['pages'][0]['text'])
                            target = (await client.get(f'/api/v1/books/{book_id}/content', params={'chapter_id': chapter_id})).json()['data']
                            self.assertEqual(target['page_offset'], 1)
                            self.assertEqual(target['pages'][0]['chapter_id'], chapter_id)
                            response = await client.put(f'{story_url}/chapters/{chapter_id}', json={**chapter, 'content': 'Intro A😀 hero follows the river.'})
                            self.assertEqual(response.status_code, 200)
                            notes = (await client.get(base)).json()['data']
                            self.assertEqual(notes[0]['start_offset'], 6)
                            self.assertFalse(notes[0]['source_missing'])
                            await client.put(f'{story_url}/chapters/{chapter_id}', json={**chapter, 'content': 'An entirely different passage.'})
                            self.assertTrue((await client.get(base)).json()['data'][0]['source_missing'])
                            self.assertEqual((await client.put(f'{story_url}/chapters/{chapter_id}', json={**chapter, 'title': 'New title'})).status_code, 200)
                            self.assertEqual((await client.delete(f'{story_url}/chapters/{chapter_id}')).status_code, 200)
                            self.assertEqual((await client.get(base)).json()['data'], [])
                    finally:
                        await db.rollback()
            finally:
                await engine.dispose()
        asyncio.run(run())


if __name__ == '__main__':
    unittest.main()
