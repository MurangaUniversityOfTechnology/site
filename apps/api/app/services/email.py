import smtplib
from email.message import EmailMessage

from app.core.config import get_settings

settings = get_settings()


def _from_address() -> str:
    # Gmail SMTP rejects (or flags) a From header that doesn't match the
    # authenticated account, so fall back to the SMTP username rather than
    # trusting an EMAIL_FROM that was never explicitly set to match it.
    if settings.email_from and "@example.com" not in settings.email_from:
        return settings.email_from
    return settings.smtp_username


def send_email(*, to: str, subject: str, html: str, text: str | None = None) -> None:
    if not settings.smtp_username or not settings.smtp_password:
        raise RuntimeError("SMTP credentials are not configured")

    message = EmailMessage()
    message["Subject"] = subject
    message["From"] = _from_address()
    message["To"] = to
    message.set_content(text or "This email requires an HTML-capable client to view.")
    message.add_alternative(html, subtype="html")

    with smtplib.SMTP(settings.smtp_host, settings.smtp_port) as smtp:
        smtp.starttls()
        smtp.login(settings.smtp_username, settings.smtp_password)
        smtp.send_message(message)
