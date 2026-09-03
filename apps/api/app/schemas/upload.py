from pydantic import BaseModel


class FileUploadResponse(BaseModel):
    url: str
