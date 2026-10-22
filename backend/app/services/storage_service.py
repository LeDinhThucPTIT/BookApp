import asyncio
from collections import OrderedDict
from pathlib import Path
from threading import Lock

from bs4 import BeautifulSoup
from fastapi import UploadFile

from app.config import settings
from app.utils.exceptions import AppError
from app.utils.files import ALLOWED_BOOK_EXT, ALLOWED_COVER_EXT, allowed_file, save_upload
from app.utils.reader import html_to_text, paginate_text

_reader_cache = OrderedDict()
_reader_cache_lock = Lock()
MAX_READER_CACHE_BYTES = 16 * 1024 * 1024


def load_reader_content(html_path: str | None) -> tuple[str | None, tuple[str, ...]]:
    if not html_path:
        return None, ()
    root = settings.static_dir.resolve()
    path = (root.parent / html_path.lstrip('/')).resolve()
    if not path.is_relative_to(root):
        return None, ()
    try:
        stat = path.stat()
    except FileNotFoundError:
        return None, ()
    key = (str(path), stat.st_mtime_ns, stat.st_size)
    with _reader_cache_lock:
        if key in _reader_cache:
            _reader_cache.move_to_end(key)
            return _reader_cache[key][0]
    content = read_book_html(html_path)
    result = (content, tuple(paginate_text(html_to_text(content or ''))))
    # Account for Python's Unicode representation and object overhead.
    import sys
    size = sys.getsizeof(key) + sys.getsizeof(key[0]) + sys.getsizeof(result) + sys.getsizeof(content) + sys.getsizeof(result[1]) + sum(sys.getsizeof(page) for page in result[1])
    if size <= MAX_READER_CACHE_BYTES:
        with _reader_cache_lock:
            for stale in [item for item in _reader_cache if item[0] == str(path) and item != key]:
                del _reader_cache[stale]
            _reader_cache[key] = (result, size)
            _reader_cache.move_to_end(key)
            while len(_reader_cache) > 64 or sum(item[1] for item in _reader_cache.values()) > MAX_READER_CACHE_BYTES:
                _reader_cache.popitem(last=False)
    return result


async def save_cover(cover_file: UploadFile | None) -> str | None:
    if cover_file is None or not cover_file.filename:
        return None
    if not allowed_file(cover_file.filename, ALLOWED_COVER_EXT):
        raise AppError("Ảnh bìa không hợp lệ!", 400, "INVALID_COVER")
    name = await save_upload(cover_file, settings.upload_cover_dir)
    return f"/static/images/Book/{name}"


async def save_pdf_and_html(book_file: UploadFile) -> tuple[str, str]:
    if not book_file.filename or not allowed_file(book_file.filename, ALLOWED_BOOK_EXT):
        raise AppError("Chỉ hỗ trợ PDF hiện tại!", 400, "INVALID_BOOK_FILE")

    pdf_name = await save_upload(book_file, settings.upload_book_dir)
    pdf_path = settings.upload_book_dir / pdf_name
    html_name = Path(pdf_name).with_suffix(".html").name
    html_path = settings.upload_html_dir / html_name

    try:
        await asyncio.to_thread(_convert_pdf_to_html, pdf_path, html_path)
    except Exception as exc:
        pdf_path.unlink(missing_ok=True)
        html_path.unlink(missing_ok=True)
        raise AppError("Không thể chuyển đổi PDF sang HTML", 500, "PDF_CONVERT_FAILED") from exc

    return f"/static/books/{pdf_name}", f"/static/book_html/{html_name}"


def remove_static_uploads(paths):
    root = settings.static_dir.resolve()
    for url in paths:
        if not url:
            continue
        candidate = (root.parent / url.lstrip("/")).resolve()
        if candidate.is_relative_to(root) and candidate.is_file():
            candidate.unlink(missing_ok=True)


def _convert_pdf_to_html(pdf_path: Path, html_path: Path) -> None:
    try:
        import fitz

        with fitz.open(pdf_path) as doc:
            html_content = "".join(page.get_text("html") for page in doc)
    except Exception:
        from html import escape

        from pypdf import PdfReader

        reader = PdfReader(str(pdf_path))
        blocks = []
        for page in reader.pages:
            text = page.extract_text() or ""
            blocks.append(f"<p>{escape(text).replace(chr(10), '<br/>')}</p>")
        html_content = "".join(blocks)
    html_path.write_text(html_content, encoding="utf-8")


def read_book_html(html_path: str | None) -> str | None:
    if not html_path:
        return None
    root = settings.static_dir.resolve()
    html_file = (root.parent / html_path.lstrip("/")).resolve()
    if not html_file.is_relative_to(root):
        return None
    if not html_file.exists():
        return None
    soup = BeautifulSoup(html_file.read_text(encoding="utf-8"), "html.parser")
    for tag in soup(["style", "script"]):
        tag.decompose()
    return soup.body.decode_contents() if soup.body else soup.decode()
