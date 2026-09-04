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


class UploadError(Exception):
    pass


def upload_file(content: bytes, content_type: str | None, folder: str = "mut-tech") -> str:
    if content_type not in ALLOWED_CONTENT_TYPES:
        raise UploadError("That file type isn't allowed")
    if len(content) > MAX_UPLOAD_BYTES:
        raise UploadError("File is too large (max 5MB)")

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
