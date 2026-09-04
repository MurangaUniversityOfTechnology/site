"""add difficulty to courses

Revision ID: c8d1abef7ecc
Revises: b883204b8b04
Create Date: 2026-09-04 15:59:47.774451

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'c8d1abef7ecc'
down_revision: Union[str, Sequence[str], None] = 'b883204b8b04'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.add_column('courses', sa.Column('difficulty', sa.Integer(), server_default='1', nullable=False))


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_column('courses', 'difficulty')
