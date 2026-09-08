import uuid
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, LargeBinary, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.core.db import Base


class OrgSignature(Base):
    """The Dean/Club Patron's signature, captured and kept up to date by
    whoever currently holds the 'Chairperson' tag (see
    app.core.deps.require_chairperson), for reuse on official documents
    later (certificates, letters, ...). Distinct from Signature, which
    belongs to one member's own account — this one belongs to the
    organization, so it outlives any single chairperson. Encrypted at rest
    the same way (app.core.security.encrypt_bytes/decrypt_bytes). Singleton:
    at most one row exists; saving again replaces it."""

    __tablename__ = "org_signatures"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    ciphertext: Mapped[bytes] = mapped_column(LargeBinary, nullable=False)
    # Who last captured/replaced it — SET NULL so the row survives that
    # chairperson's account being removed later.
    updated_by_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )
