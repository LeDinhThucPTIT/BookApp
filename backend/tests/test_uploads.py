import asyncio
import io
import tempfile
import unittest
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import PropertyMock, patch

from fastapi import UploadFile
from PIL import Image

from app.config import settings
from app.schemas.book import BookCreateForm
from app.services.book_service import BookService
from app.utils.exceptions import AppError
from app.utils.files import MAX_BOOK_BYTES, save_upload


class UploadTests(unittest.TestCase):
    def test_rejects_forged_empty_oversized_and_corrupt_files_without_leaks(self):
        async def run():
            with tempfile.TemporaryDirectory() as directory:
                target = Path(directory)
                cases = [
                    (UploadFile(io.BytesIO(b'not a PDF'), filename='fake.pdf'), 'INVALID_FILE_CONTENT'),
                    (UploadFile(io.BytesIO(b''), filename='empty.pdf'), 'EMPTY_FILE'),
                    (UploadFile(io.BytesIO(b'%PDF-test'), filename='huge.pdf', size=MAX_BOOK_BYTES + 1), 'FILE_TOO_LARGE'),
                    (UploadFile(io.BytesIO(b'\x89PNG\r\n\x1a\ninvalid'), filename='corrupt.png'), 'INVALID_IMAGE'),
                ]
                for upload, expected in cases:
                    try:
                        with self.assertRaises(AppError) as caught:
                            await save_upload(upload, target)
                        self.assertEqual(caught.exception.error_code, expected)
                        self.assertEqual(list(target.iterdir()), [])
                    finally:
                        await upload.close()
                # Size must also be checked when Content-Length/UploadFile.size is unknown.
                upload = UploadFile(io.BytesIO(b'%PDF-' + b'x' * 100), filename='stream.pdf')
                with patch('app.utils.files.MAX_BOOK_BYTES', 32):
                    with self.assertRaises(AppError) as caught:
                        await save_upload(upload, target)
                    self.assertEqual(caught.exception.status_code, 413)
                    self.assertEqual(list(target.iterdir()), [])
                await upload.close()
        asyncio.run(run())

    def test_pdf_failure_also_removes_already_saved_cover(self):
        async def run():
            with tempfile.TemporaryDirectory() as directory:
                target = Path(directory)
                cover = io.BytesIO()
                Image.new('RGB', (1, 1)).save(cover, format='PNG')
                cover.seek(0)
                image = UploadFile(cover, filename='cover.png')
                pdf = UploadFile(io.BytesIO(b'%PDF-not-a-real-document'), filename='broken.pdf')
                # Keep /static URL mapping identical to the real storage layout.
                root = target / 'app' / 'static'
                for folder in [root / 'images' / 'Book', root / 'books', root / 'book_html']:
                    folder.mkdir(parents=True)
                with patch.object(type(settings), 'static_dir', new_callable=PropertyMock, return_value=root), \
                     patch.object(type(settings), 'upload_cover_dir', new_callable=PropertyMock, return_value=root / 'images' / 'Book'), \
                     patch.object(type(settings), 'upload_book_dir', new_callable=PropertyMock, return_value=root / 'books'), \
                     patch.object(type(settings), 'upload_html_dir', new_callable=PropertyMock, return_value=root / 'book_html'), \
                     patch('app.services.storage_service._convert_pdf_to_html', side_effect=ValueError('invalid PDF')):
                    with self.assertRaises(AppError):
                        await BookService(SimpleNamespace(info={})).upload_book(SimpleNamespace(id=1), BookCreateForm(title='Book', author='Author'), pdf, image)
                    self.assertEqual([path for path in root.rglob('*') if path.is_file()], [])
                await image.close()
                await pdf.close()
        asyncio.run(run())
