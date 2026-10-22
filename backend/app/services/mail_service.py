from email.message import EmailMessage

import aiosmtplib

from app.config import settings
from app.utils.exceptions import AppError


async def send_email(to_email: str, subject: str, body: str) -> None:
    if not settings.mail_username or not settings.mail_password:
        raise AppError("Chưa cấu hình SMTP!", 500, "MAIL_NOT_CONFIGURED")

    message = EmailMessage()
    message["From"] = settings.mail_default_sender or settings.mail_username
    message["To"] = to_email
    message["Subject"] = subject
    message.set_content(body)

    try:
        await aiosmtplib.send(
            message,
            hostname=settings.mail_server,
            port=settings.mail_port,
            start_tls=True,
            username=settings.mail_username,
            password=settings.mail_password.replace(" ", ""),
        )
    except Exception as exc:
        raise AppError(
            "Không thể gửi email. Vui lòng thử lại sau!",
            500,
            "MAIL_SEND_FAILED",
        ) from exc
