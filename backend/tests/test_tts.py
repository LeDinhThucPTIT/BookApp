import asyncio
import os
import tempfile
import unittest
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import AsyncMock, patch

import httpx

from main import create_app
from app.middlewares.auth import get_current_user
from app.routes.deps import get_book_service
from app.services.tts_service import TTSService, VOICES, split_tts_text, tts_service
from app.utils.exceptions import AppError


class TTSTests(unittest.TestCase):
    def test_segments_preserve_words_and_favor_sentence_boundaries(self):
        text = 'Một câu chuyện mới. ' * 150
        chunks = split_tts_text(text)
        self.assertEqual(' '.join(chunks), text.strip())
        self.assertTrue(all(len(chunk) <= 500 for chunk in chunks))
        self.assertTrue(all(chunk.endswith('.') for chunk in chunks))
        self.assertEqual(split_tts_text('  '), [])
        self.assertEqual(''.join(split_tts_text('x' * 1100)), 'x' * 1100)

    def test_cache_deduplication_voice_and_changed_content(self):
        async def run():
            with tempfile.TemporaryDirectory() as directory:
                service = TTSService(Path(directory))
                service._render = AsyncMock(return_value=b'ID3-test-audio')
                voice = next(iter(VOICES))
                results = await asyncio.gather(*(service.audio('A page', voice) for _ in range(3)))
                self.assertTrue(all(item == b'ID3-test-audio' for item in results))
                self.assertEqual(service._render.await_count, 1)
                self.assertEqual(await service.audio('A page', voice), results[0])
                self.assertEqual(service._render.await_count, 1)
                await service.audio('An edited page', voice)
                await service.audio('A page', 'vi-VN-NamMinhNeural')
                self.assertEqual(service._render.await_count, 3)
                self.assertEqual(len(list(Path(directory).glob('*.mp3'))), 3)
                self.assertEqual(list(Path(directory).glob('*.tmp')), [])
        asyncio.run(run())

    def test_failed_generation_and_invalid_inputs_are_not_cached(self):
        async def run():
            with tempfile.TemporaryDirectory() as directory:
                service = TTSService(Path(directory))
                service._render = AsyncMock(side_effect=RuntimeError('upstream unavailable'))
                with self.assertRaises(AppError) as caught:
                    await service.audio('A page', 'vi-VN-HoaiMyNeural')
                self.assertEqual(caught.exception.status_code, 503)
                self.assertEqual(list(Path(directory).glob('*')), [])
                for text, voice in [('A page', 'unknown'), (' ', 'vi-VN-HoaiMyNeural'), ('x' * 4001, 'vi-VN-HoaiMyNeural')]:
                    with self.assertRaises(AppError):
                        await service.audio(text, voice)
                self.assertEqual(service._render.await_count, 1)
        asyncio.run(run())

    def test_audio_api_requires_login_and_resolves_server_story_page(self):
        async def run():
            app = create_app()
            async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url='http://test') as client:
                self.assertEqual((await client.get('/api/v1/books/1/audio')).status_code, 401)
                app.dependency_overrides[get_current_user] = lambda: SimpleNamespace(id=1)
                book_service = SimpleNamespace(get_book_content=AsyncMock(side_effect=[
                    SimpleNamespace(is_story=True, chapters=[SimpleNamespace(id=2, start_page=4, page_count=1)], pages=[], page_offset=0),
                    SimpleNamespace(is_story=True, pages=[SimpleNamespace(text='Trusted chapter text')], page_offset=4),
                ]))
                app.dependency_overrides[get_book_service] = lambda: book_service
                with patch.object(tts_service, 'audio', new=AsyncMock(return_value=b'ID3-audio')) as audio:
                    response = await client.get('/api/v1/books/1/audio?page=4&voice=vi-VN-NamMinhNeural')
                    self.assertEqual(response.status_code, 200, response.text)
                    self.assertEqual(response.headers['content-type'], 'audio/mpeg')
                    self.assertEqual(response.content, b'ID3-audio')
                    audio.assert_awaited_once_with('Trusted chapter text', 'vi-VN-NamMinhNeural')
                    self.assertEqual(book_service.get_book_content.call_args.args, (1, 2))
                self.assertEqual((await client.get('/api/v1/books/1/audio?voice=foreign')).status_code, 422)
                self.assertEqual((await client.get('/api/v1/books/1/audio?page=-1')).status_code, 422)
                book_service.get_book_content = AsyncMock(return_value=SimpleNamespace(is_story=False, pages=[], page_offset=0))
                self.assertEqual((await client.get('/api/v1/books/1/audio?page=999')).status_code, 409)
        asyncio.run(run())

    @unittest.skipUnless(os.getenv('BOOKAPP_TEST_EDGE_TTS') == '1', 'optional live Microsoft Edge service test')
    def test_live_vietnamese_voices(self):
        async def run():
            for voice in VOICES:
                audio = await tts_service.audio('Xin chào. Chúc bạn có một buổi đọc sách thật vui.', voice)
                self.assertGreater(len(audio), 1000)
                self.assertTrue(audio.startswith(b'ID3') or audio[0] == 255)
                print(f'{voice}: {len(audio)} MP3 bytes')
        asyncio.run(run())
