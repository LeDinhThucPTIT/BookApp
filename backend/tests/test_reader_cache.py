import tempfile
import unittest
from pathlib import Path
from unittest.mock import PropertyMock, patch

from app.config import settings
from app.services import storage_service


class ReaderCacheTests(unittest.TestCase):
    def test_cache_reuses_parsed_content_and_invalidates_after_edit(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory) / 'static'
            root.mkdir()
            path = root / 'book.html'
            path.write_text('<p>Original text</p>', encoding='utf-8')
            with patch.object(type(settings), 'static_dir', new_callable=PropertyMock, return_value=root), \
                 patch.object(storage_service, 'read_book_html', wraps=storage_service.read_book_html) as read:
                first = storage_service.load_reader_content('/static/book.html')
                second = storage_service.load_reader_content('/static/book.html')
                self.assertEqual(first, second)
                self.assertEqual(read.call_count, 1)
                path.write_text('<p>Changed text with additional words</p>', encoding='utf-8')
                third = storage_service.load_reader_content('/static/book.html')
                self.assertEqual(read.call_count, 2)
                self.assertIn('Changed text', third[1][0])
                self.assertEqual(storage_service.load_reader_content('/static/../outside.html'), (None, ()))
                self.assertEqual(storage_service.load_reader_content('/static/missing.html'), (None, ()))

    def test_oversized_results_are_not_cached(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory) / 'static'
            root.mkdir()
            (root / 'large.html').write_text('<p>Uncached text</p>', encoding='utf-8')
            with patch.object(type(settings), 'static_dir', new_callable=PropertyMock, return_value=root), \
                 patch.object(storage_service, 'MAX_READER_CACHE_BYTES', 1), \
                 patch.object(storage_service, 'read_book_html', wraps=storage_service.read_book_html) as read:
                storage_service.load_reader_content('/static/large.html')
                storage_service.load_reader_content('/static/large.html')
                self.assertEqual(read.call_count, 2)
