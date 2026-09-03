"""add created_by to courses

Revision ID: 81235720ee14
Revises: 02bb14232269
Create Date: 2026-09-03 10:54:11.956155

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision: str = '81235720ee14'
down_revision: Union[str, Sequence[str], None] = '02bb14232269'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.add_column('courses', sa.Column('created_by_id', postgresql.UUID(as_uuid=True), nullable=False))
    op.create_foreign_key(
        'courses_created_by_id_fkey', 'courses', 'users', ['created_by_id'], ['id']
    )


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_constraint('courses_created_by_id_fkey', 'courses', type_='foreignkey')
    op.drop_column('courses', 'created_by_id')
