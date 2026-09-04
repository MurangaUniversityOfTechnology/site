from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status

from app.core.deps import require_staff
from app.schemas.upload import FileUploadResponse
from app.services import uploads as uploads_service

# Generic file upload (course covers, event images, form assets, …) — no
# funds/member data involved, so staff (courses/events/forms) needs it too.
router = APIRouter(prefix="/admin/uploads", tags=["admin-uploads"], dependencies=[Depends(require_staff)])


@router.post("", response_model=FileUploadResponse)
def upload_file(file: UploadFile = File(...)):
    try:
        url = uploads_service.upload_file(file.file.read(), file.content_type)
    except uploads_service.UploadError as exc:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, str(exc)) from exc
    return FileUploadResponse(url=url)
