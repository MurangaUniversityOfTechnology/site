"""add event reminder sent timestamps to event_registrations

Revision ID: b3e1d9c47a20
Revises: f3b7c2a9d1e4
Create Date: 2026-09-25 10:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'b3e1d9c47a20'
down_revision: Union[str, Sequence[str], None] = 'f3b7c2a9d1e4'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.add_column('event_registrations', sa.Column('reminder_day_before_sent_at', sa.DateTime(timezone=True), nullable=True))
    op.add_column('event_registrations', sa.Column('reminder_hour_before_sent_at', sa.DateTime(timezone=True), nullable=True))


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_column('event_registrations', 'reminder_hour_before_sent_at')
    op.drop_column('event_registrations', 'reminder_day_before_sent_at')
