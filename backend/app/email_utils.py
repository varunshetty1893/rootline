"""Password-reset email delivery with safe defaults.

SMTP is optional for local development. Reset links are never logged unless
the explicit local-only ``LOG_RESET_LINKS=true`` flag is enabled, and that
flag is ignored in production.
"""

import logging
import smtplib
from email.message import EmailMessage

from .config import settings

logger = logging.getLogger("rootline.email")


def send_reset_email(to_email: str, reset_link: str) -> None:
    smtp_ready = all(
        [settings.smtp_host, settings.email_from, settings.smtp_username, settings.smtp_password]
    )
    if smtp_ready:
        message = EmailMessage()
        message["Subject"] = "Reset your Rootline password"
        message["From"] = settings.email_from
        message["To"] = to_email
        message.set_content(
            "Use this link to reset your Rootline password. "
            f"It expires in {settings.reset_token_expire_minutes} minutes.\n\n"
            f"{reset_link}\n"
        )
        with smtplib.SMTP(settings.smtp_host, settings.smtp_port, timeout=10) as smtp:
            smtp.starttls()
            smtp.login(settings.smtp_username, settings.smtp_password)
            smtp.send_message(message)
        return

    if settings.log_reset_links and settings.environment.lower() != "production":
        logger.warning("Local-only password reset link: %s", reset_link)
    else:
        logger.warning(
            "Password reset email is not configured; the reset link was not logged."
        )
