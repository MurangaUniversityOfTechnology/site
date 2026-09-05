"""drop video_url from course_lessons

Revision ID: b1c4d8e2a9f0
Revises: d4e1f6a2b8c9
Create Date: 2026-09-05 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'b1c4d8e2a9f0'
down_revision: Union[str, Sequence[str], None] = 'd4e1f6a2b8c9'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.drop_column('course_lessons', 'video_url')


def downgrade() -> None:
    """Downgrade schema."""
    op.add_column('course_lessons', sa.Column('video_url', sa.String(), nullable=True))
