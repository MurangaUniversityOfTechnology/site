"""add event_reminder_settings table

Revision ID: c5d2a8e41f93
Revises: eedc126ca683
Create Date: 2026-09-25 12:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'c5d2a8e41f93'
down_revision: Union[str, Sequence[str], None] = 'eedc126ca683'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.create_table('event_reminder_settings',
    sa.Column('id', sa.UUID(), nullable=False),
    sa.Column('day_before_enabled', sa.Boolean(), nullable=False),
    sa.Column('day_before_time', sa.Time(), nullable=False),
    sa.Column('hour_before_enabled', sa.Boolean(), nullable=False),
    sa.Column('hour_before_minutes', sa.Integer(), nullable=False),
    sa.Column('include_pending', sa.Boolean(), nullable=False),
    sa.Column('updated_by_id', sa.UUID(), nullable=True),
    sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.ForeignKeyConstraint(['updated_by_id'], ['users.id'], ondelete='SET NULL'),
    sa.PrimaryKeyConstraint('id')
    )


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_table('event_reminder_settings')
