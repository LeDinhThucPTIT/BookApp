import asyncio
from pathlib import Path

from bs4 import BeautifulSoup
from fastapi import UploadFile

from app.config import settings
from app.utils.exceptions import AppError
from app.utils.files import ALLOWED_BOOK_EXT, ALLOWED_COVER_EXT, allowed_file, save_upload


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
    html_file = settings.static_dir.parent / html_path.lstrip("/")
    if not html_file.exists():
        html_file = Path(settings.static_dir.parent, *html_path.lstrip("/").split("/"))
    if not html_file.exists():
        return None
    soup = BeautifulSoup(html_file.read_text(encoding="utf-8"), "html.parser")
    for tag in soup(["style", "script"]):
        tag.decompose()
    return soup.body.decode_contents() if soup.body else soup.decode()
