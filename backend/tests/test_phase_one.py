"""Run: py -3.12 -m unittest discover -s tests -v (from backend).

Set BOOKAPP_TEST_MYSQL=1 to also exercise the configured MySQL database.
The MySQL test creates temporary rows and rolls the entire transaction back.
"""
import asyncio
import os
import unittest
import uuid
from types import SimpleNamespace
from unittest.mock import AsyncMock, patch

import httpx
from pydantic import ValidationError

from main import create_app
from app.config import settings
from app.middlewares.auth import get_current_user
from app.models import Book, SessionLocal, User, engine
from app.schemas.interaction import ProgressUpdate
from app.services.ai_service import AIService
from app.services.interaction_service import InteractionService
from app.utils.exceptions import AppError


class PhaseOneTests(unittest.TestCase):
    def test_progress_range_validation(self):
        for values in [(-1, 10), (10, 10), (0, 0)]:
            with self.assertRaises(ValidationError):
                ProgressUpdate(page=values[0], total_pages=values[1], updated_at_ms=100)
        self.assertEqual(ProgressUpdate(page=0, total_pages=1, updated_at_ms=100).page, 0)

    def test_api_auth_validation_and_rate_limit(self):
        async def run():
            app = create_app()
            async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url="http://test") as client:
                for path, body in [
                    ("summarize", {"content": "A valid book excerpt"}),
                    ("ask", {"question": "Why?", "context": "A valid book excerpt"}),
                ]:
                    response = await client.post(f"/api/v1/ai/{path}", json=body)
                    self.assertEqual(response.status_code, 401)
                self.assertEqual((await client.get("/api/v1/books/1/progress")).status_code, 401)
                app.dependency_overrides[get_current_user] = lambda: SimpleNamespace(id=1)
                with patch.object(AIService, "summarize_chapter", new=AsyncMock(return_value={"summary": "Summary"})) as ai:
                    response = await client.post("/api/v1/ai/summarize", json={"content": " " * 20})
                    self.assertEqual(response.status_code, 422)
                    ai.assert_not_called()
                    # A separate client IP isolates limiter state from validation calls.
                    async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app, client=("127.0.0.9", 123)), base_url="http://test") as limited:
                        statuses = [(await limited.post("/api/v1/ai/summarize", json={"content": "A valid book excerpt"})).status_code for _ in range(7)]
                        self.assertEqual(statuses, [200] * 6 + [429])
                response = await client.put("/api/v1/books/1/progress", json={"page": 10, "total_pages": 10, "updated_at_ms": 100})
                self.assertEqual(response.status_code, 422)
        asyncio.run(run())

    def test_missing_key_reports_unavailable(self):
        async def run():
            with patch.object(settings, "gemini_api_key", None):
                with self.assertRaises(AppError) as caught:
                    await AIService._call_gemini_api("test")
                self.assertEqual(caught.exception.error_code, "AI_NOT_CONFIGURED")
        asyncio.run(run())

    def test_upstream_errors_are_explicit(self):
        async def run():
            for status, code in [(429, "AI_QUOTA_EXCEEDED"), (403, "AI_UPSTREAM_ERROR")]:
                with patch.object(settings, "gemini_api_key", "test-key"), patch("app.services.ai_service.httpx.AsyncClient") as factory:
                    client = factory.return_value.__aenter__.return_value
                    client.post = AsyncMock(return_value=httpx.Response(status))
                    with self.assertRaises(AppError) as caught:
                        await AIService._call_gemini_api("test")
                    self.assertEqual(caught.exception.error_code, code)
            with patch.object(settings, "gemini_api_key", "test-key"), patch("app.services.ai_service.httpx.AsyncClient") as factory:
                factory.return_value.__aenter__.return_value.post = AsyncMock(side_effect=httpx.ReadTimeout("timeout"))
                with self.assertRaises(AppError) as caught:
                    await AIService._call_gemini_api("test")
                self.assertEqual(caught.exception.error_code, "AI_TIMEOUT")
        asyncio.run(run())

    def test_invalid_summary_never_returns_fabricated_analysis(self):
        async def run():
            for content in ['not json', '{"summary": "", "characters": []}', '{"summary": "ok", "key_points": "wrong type"}']:
                with patch.object(AIService, "_call_gemini_api", new=AsyncMock(return_value=content)):
                    with self.assertRaises(AppError) as caught:
                        await AIService.summarize_chapter("A valid excerpt")
                    self.assertEqual(caught.exception.error_code, "AI_INVALID_RESPONSE")
            with patch.object(AIService, "_call_gemini_api", new=AsyncMock(return_value='```json\n{"summary": "Valid summary"}\n```')):
                result = await AIService.summarize_chapter("A valid excerpt")
                self.assertEqual(result["summary"], "Valid summary")
                self.assertFalse(result["is_mock"])
        asyncio.run(run())

    @unittest.skipUnless(os.getenv("BOOKAPP_TEST_MYSQL") == "1", "optional MySQL integration")
    def test_mysql_progress_isolation_and_stale_writes(self):
        async def run():
            try:
                async with SessionLocal() as db:
                    try:
                        suffix = uuid.uuid4().hex[:8]
                        user = User(username="phase-one-test", email=f"{suffix}@example.test", sdt=suffix, password="test-only")
                        db.add(user)
                        await db.flush()
                        book = Book(title="Phase one integration test", uploaded_by=user.id)
                        db.add(book)
                        await db.flush()
                        service = InteractionService(db)
                        self.assertIsNone(await service.get_progress(user.id, book.id))
                        first = await service.save_progress(user.id, book.id, ProgressUpdate(page=8, total_pages=10, updated_at_ms=9007199254740990, base_revision=0, mutation_id='first'))
                        self.assertEqual(first.revision, 1)
                        self.assertLess(first.updated_at_ms, 9007199254740990)
                        with self.assertRaises(AppError) as caught:
                            await service.save_progress(user.id, book.id, ProgressUpdate(page=1, total_pages=3, updated_at_ms=100, base_revision=0, mutation_id='stale'))
                        self.assertEqual(caught.exception.error_code, 'PROGRESS_CONFLICT')
                        self.assertEqual(caught.exception.details['page'], 8)
                        replay = await service.save_progress(user.id, book.id, ProgressUpdate(page=8, total_pages=10, updated_at_ms=1, base_revision=0, mutation_id='first'))
                        self.assertEqual(replay.revision, 1)
                        # Returning to the start is a valid newer position.
                        newer = await service.save_progress(user.id, book.id, ProgressUpdate(page=0, total_pages=10, updated_at_ms=1, base_revision=1, mutation_id='newer'))
                        self.assertEqual(newer.page, 0)
                        self.assertEqual(newer.revision, 2)
                        self.assertIsNone(await service.get_progress(user.id + 1000000, book.id))
                    finally:
                        await db.rollback()
            finally:
                await engine.dispose()
        asyncio.run(run())


if __name__ == "__main__":
    unittest.main()
