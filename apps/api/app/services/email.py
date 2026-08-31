import logging
import smtplib
from email.message import EmailMessage
from typing import NamedTuple

from app.core.config import get_settings

settings = get_settings()
logger = logging.getLogger(__name__)


class InlineImage(NamedTuple):
    """An image attached to the message and referenced from `html` via
    `<img src="cid:{cid}">` — travels with the email itself (unlike a
    hosted-URL image), so it's visible even when the recipient has no
    network access when they open it."""

    cid: str
    data: bytes
    subtype: str = "png"


def _from_address() -> str:
    # Gmail SMTP rejects (or flags) a From header that doesn't match the
    # authenticated account, so fall back to the SMTP username rather than
    # trusting an EMAIL_FROM that was never explicitly set to match it.
    if settings.email_from and "@example.com" not in settings.email_from:
        return settings.email_from
    return settings.smtp_username


def send_email(
    *, to: str, subject: str, html: str, text: str | None = None, inline_images: list[InlineImage] | None = None
) -> None:
    if settings.environment != "production":
        # Dev/test data is full of fake @example.com addresses (seed data,
        # manual testing) — a real send to one bounces straight back to the
        # club's real Gmail account. Outside production this only logs, so
        # the flow is still verifiable without spamming a real mailbox.
        logger.info("send_email skipped (environment=%s): to=%s subject=%r", settings.environment, to, subject)
        return

    if not settings.smtp_username or not settings.smtp_password:
        raise RuntimeError("SMTP credentials are not configured")

    message = EmailMessage()
    message["Subject"] = subject
    message["From"] = _from_address()
    message["To"] = to
    message.set_content(text or "This email requires an HTML-capable client to view.")
    message.add_alternative(html, subtype="html")
    if inline_images:
        # add_related() must be called on the html subpart itself (not the
        # top-level message) — that's what nests it as multipart/related
        # under the alternative, the standard structure for a "cid:"-
        # referenced inline image.
        html_part = message.get_payload()[-1]
        for image in inline_images:
            html_part.add_related(image.data, maintype="image", subtype=image.subtype, cid=f"<{image.cid}>")

    with smtplib.SMTP(settings.smtp_host, settings.smtp_port) as smtp:
        smtp.starttls()
        smtp.login(settings.smtp_username, settings.smtp_password)
        smtp.send_message(message)
