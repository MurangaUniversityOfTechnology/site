"""add onboarded to profiles

Revision ID: c1a9f0e2b7d3
Revises: 92401ae0fce0
Create Date: 2026-09-01 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'c1a9f0e2b7d3'
down_revision: Union[str, Sequence[str], None] = '92401ae0fce0'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.add_column('profiles', sa.Column('onboarded', sa.Boolean(), server_default=sa.text('false'), nullable=False))


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_column('profiles', 'onboarded')
