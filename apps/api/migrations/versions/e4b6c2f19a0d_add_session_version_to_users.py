"""add session_version to users

Revision ID: e4b6c2f19a0d
Revises: c1a9f0e2b7d3
Create Date: 2026-09-01 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'e4b6c2f19a0d'
down_revision: Union[str, Sequence[str], None] = 'c1a9f0e2b7d3'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.add_column('users', sa.Column('session_version', sa.Integer(), server_default=sa.text('0'), nullable=False))


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_column('users', 'session_version')
