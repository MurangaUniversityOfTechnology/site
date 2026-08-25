import uuid

from pydantic import BaseModel


class GithubStatus(BaseModel):
    linked: bool
    login: str | None
    invite_status: str


class RosterRow(BaseModel):
    user_id: uuid.UUID
    name: str
    email: str
    github_login: str | None
    invite_status: str
