import cloudinary
import cloudinary.uploader

from app.core.config import get_settings

# Generous for a cover image or a small lesson attachment, not for abuse —
# same "guard, not a real limit" reasoning as MAX_SIGNATURE_BYTES in
# services/signature.py.
MAX_UPLOAD_BYTES = 5_000_000
ALLOWED_CONTENT_TYPES = {
    "image/jpeg",
    "image/png",
    "image/webp",
    "image/gif",
    "application/pdf",
    "application/zip",
    "text/plain",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
}

# Community post/comment attachments — images plus short video clips.
# Deliberately its own set rather than extending ALLOWED_CONTENT_TYPES: that
# one gates the staff-only admin uploads endpoint (course covers, etc.), and
# there's no reason to open video there too.
COMMUNITY_ALLOWED_CONTENT_TYPES = {
    "image/jpeg",
    "image/png",
    "image/webp",
    "image/gif",
    "video/mp4",
    "video/webm",
    "video/quicktime",
}


# Form file-upload fields (e.g. a design competition entry). Bigger than a
# cover image, but still Cloudinary's free-plan per-file ceiling. No PSD/AI:
# browsers send those as generic octet-stream, so they can't be told apart —
# people zip them or export to PNG/PDF instead.
FORM_MAX_UPLOAD_BYTES = 10_000_000
FORM_ALLOWED_CONTENT_TYPES = {
    "image/jpeg",
    "image/png",
    "image/webp",
    "image/gif",
    "application/pdf",
    "application/zip",
    "application/x-zip-compressed",
}


class UploadError(Exception):
    pass


def upload_file(
    content: bytes,
    content_type: str | None,
    folder: str = "mut-tech",
    allowed_types: set[str] | None = None,
    max_bytes: int = MAX_UPLOAD_BYTES,
) -> str:
    if content_type not in (allowed_types or ALLOWED_CONTENT_TYPES):
        raise UploadError("That file type isn't allowed")
    if len(content) > max_bytes:
        raise UploadError(f"File is too large (max {max_bytes // 1_000_000}MB)")

    settings = get_settings()
    if not (settings.cloudinary_cloud_name and settings.cloudinary_api_key and settings.cloudinary_api_secret):
        raise UploadError("Uploads aren't configured yet")

    cloudinary.config(
        cloud_name=settings.cloudinary_cloud_name,
        api_key=settings.cloudinary_api_key,
        api_secret=settings.cloudinary_api_secret,
        secure=True,
    )
    # resource_type="auto" lets Cloudinary correctly store both images and
    # raw files (pdf/zip/docx/etc.) through this one generic endpoint.
    result = cloudinary.uploader.upload(content, folder=folder, resource_type="auto")
    return result["secure_url"]


def is_hosted_upload(url: str) -> bool:
    """True if url points at our Cloudinary account — what upload_file returns.
    Keeps a form answer from smuggling in an arbitrary link."""
    cloud = get_settings().cloudinary_cloud_name
    return url.startswith(f"https://res.cloudinary.com/{cloud}/" if cloud else "https://res.cloudinary.com/")
