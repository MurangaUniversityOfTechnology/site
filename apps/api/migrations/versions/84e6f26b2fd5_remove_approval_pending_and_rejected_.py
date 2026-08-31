"""remove approval_pending and rejected from membership status

Revision ID: 84e6f26b2fd5
Revises: 7f16a40fd3e6
Create Date: 2026-08-31 09:22:51.099166

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '84e6f26b2fd5'
down_revision: Union[str, Sequence[str], None] = '7f16a40fd3e6'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    # Membership now auto-activates on successful payment — approval_pending
    # and rejected are dead states nothing produces anymore. Postgres can't
    # drop enum values in place, so swap the type: any existing
    # approval_pending row becomes active (payment already succeeded — that
    # was always the intended next step), and rejected becomes none (a
    # rejected applicant could always just start over anyway).
    op.execute("ALTER TABLE memberships ALTER COLUMN status DROP DEFAULT")
    op.execute("ALTER TYPE membershipstatus RENAME TO membershipstatus_old")
    op.execute(
        "CREATE TYPE membershipstatus AS ENUM "
        "('none', 'payment_pending', 'payment_received', 'active', 'expired', 'suspended')"
    )
    op.execute(
        """
        ALTER TABLE memberships ALTER COLUMN status TYPE membershipstatus
        USING (
            CASE status::text
                WHEN 'approval_pending' THEN 'active'
                WHEN 'rejected' THEN 'none'
                ELSE status::text
            END
        )::membershipstatus
        """
    )
    op.execute("ALTER TABLE memberships ALTER COLUMN status SET DEFAULT 'none'::membershipstatus")
    op.execute("DROP TYPE membershipstatus_old")


def downgrade() -> None:
    """Downgrade schema."""
    # Lossy: rows that were approval_pending/rejected before upgrade() now
    # read as active/none, indistinguishable from rows that were always
    # active/none — this restores the enum's shape, not the original data.
    op.execute("ALTER TABLE memberships ALTER COLUMN status DROP DEFAULT")
    op.execute("ALTER TYPE membershipstatus RENAME TO membershipstatus_new")
    op.execute(
        "CREATE TYPE membershipstatus AS ENUM "
        "('none', 'payment_pending', 'payment_received', 'approval_pending', 'active', 'rejected', 'expired', 'suspended')"
    )
    op.execute("ALTER TABLE memberships ALTER COLUMN status TYPE membershipstatus USING status::text::membershipstatus")
    op.execute("ALTER TABLE memberships ALTER COLUMN status SET DEFAULT 'none'::membershipstatus")
    op.execute("DROP TYPE membershipstatus_new")
