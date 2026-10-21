"""add announcements table

Revision ID: d7b3e19a5c20
Revises: c5d2a8e41f93
Create Date: 2026-10-21 12:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'd7b3e19a5c20'
down_revision: Union[str, Sequence[str], None] = 'c5d2a8e41f93'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.create_table('announcements',
    sa.Column('id', sa.UUID(), nullable=False),
    sa.Column('title', sa.String(length=120), nullable=False),
    sa.Column('body', sa.Text(), nullable=True),
    sa.Column('cta_label', sa.String(length=40), nullable=True),
    sa.Column('cta_url', sa.String(length=500), nullable=True),
    sa.Column('is_active', sa.Boolean(), nullable=False),
    sa.Column('starts_at', sa.DateTime(timezone=True), nullable=True),
    sa.Column('ends_at', sa.DateTime(timezone=True), nullable=True),
    sa.Column('created_by_id', sa.UUID(), nullable=True),
    sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.ForeignKeyConstraint(['created_by_id'], ['users.id'], ondelete='SET NULL'),
    sa.PrimaryKeyConstraint('id')
    )


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_table('announcements')
