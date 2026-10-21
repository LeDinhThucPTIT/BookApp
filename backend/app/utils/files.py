from pathlib import Path
from uuid import uuid4
import asyncio

from fastapi import UploadFile
from werkzeug.utils import secure_filename
from app.utils.exceptions import AppError


def verify_image(path: Path):
    from PIL import Image, UnidentifiedImageError
    import warnings
    try:
        with warnings.catch_warnings():
            warnings.simplefilter("error", Image.DecompressionBombWarning)
            with Image.open(path) as image:
                if image.width * image.height > 25_000_000:
                    raise ValueError("image is too large")
                image.verify()
    except (UnidentifiedImageError, OSError, ValueError, Image.DecompressionBombError, Image.DecompressionBombWarning):
        raise AppError("Ảnh bị hỏng hoặc có độ phân giải quá lớn.", 400, "INVALID_IMAGE") from None

ALLOWED_COVER_EXT = {"png", "jpg", "jpeg", "webp"}
ALLOWED_BOOK_EXT = {"pdf"}


def allowed_file(filename: str, allowed: set[str]) -> bool:
    return "." in filename and filename.rsplit(".", 1)[1].lower() in allowed


def unique_filename(filename: str) -> str:
    safe = secure_filename(filename) or "file"
    stem, suffix = Path(safe).stem, Path(safe).suffix
    return f"{stem}_{uuid4().hex[:8]}{suffix}"


MAX_BOOK_BYTES = 50 * 1024 * 1024
MAX_IMAGE_BYTES = 5 * 1024 * 1024


async def save_upload(file: UploadFile, dest_dir: Path) -> str:
    dest_dir.mkdir(parents=True, exist_ok=True)
    name = unique_filename(file.filename or "upload.bin")
    path = dest_dir / name
    extension = Path(name).suffix.lower()
    limit = MAX_BOOK_BYTES if extension == ".pdf" else MAX_IMAGE_BYTES
    try:
        if file.size is not None and file.size > limit:
            raise AppError("File vượt dung lượng cho phép (PDF 50 MB, ảnh 5 MB).", 413, "FILE_TOO_LARGE")
        total = 0
        with path.open("wb") as output:
            while chunk := await file.read(1024 * 1024):
                if total == 0:
                    valid = (
                        (extension == ".pdf" and b"%PDF-" in chunk[:1024]) or
                        (extension == ".png" and chunk.startswith(b"\x89PNG\r\n\x1a\n")) or
                        (extension in {".jpg", ".jpeg"} and chunk.startswith(b"\xff\xd8\xff")) or
                        (extension == ".webp" and chunk.startswith(b"RIFF") and chunk[8:12] == b"WEBP")
                    )
                    if not valid:
                        raise AppError("Nội dung file không khớp định dạng PDF/ảnh được hỗ trợ.", 400, "INVALID_FILE_CONTENT")
                total += len(chunk)
                if total > limit:
                    raise AppError("File vượt dung lượng cho phép (PDF 50 MB, ảnh 5 MB).", 413, "FILE_TOO_LARGE")
                await asyncio.to_thread(output.write, chunk)
        if total == 0:
            raise AppError("File trống. Vui lòng chọn file khác.", 400, "EMPTY_FILE")
        if extension != ".pdf":
            await asyncio.to_thread(verify_image, path)
        return name
    except BaseException:
        path.unlink(missing_ok=True)
        raise
    finally:
        await file.seek(0)
