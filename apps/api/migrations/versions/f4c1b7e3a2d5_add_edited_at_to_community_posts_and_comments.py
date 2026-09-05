"""add edited_at to community posts and comments

Revision ID: f4c1b7e3a2d5
Revises: e2f8a1c4d9b6
Create Date: 2026-09-05 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'f4c1b7e3a2d5'
down_revision: Union[str, Sequence[str], None] = 'e2f8a1c4d9b6'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.add_column('community_posts', sa.Column('edited_at', sa.DateTime(timezone=True), nullable=True))
    op.add_column('community_comments', sa.Column('edited_at', sa.DateTime(timezone=True), nullable=True))


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_column('community_comments', 'edited_at')
    op.drop_column('community_posts', 'edited_at')
