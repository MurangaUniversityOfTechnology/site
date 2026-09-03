"""add courses table

Revision ID: 5b23f68ef23d
Revises: a3d9e5c7f214
Create Date: 2026-09-03 09:29:44.716076

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision: str = '5b23f68ef23d'
down_revision: Union[str, Sequence[str], None] = 'a3d9e5c7f214'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.create_table(
        'courses',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('slug', sa.String(), nullable=False),
        sa.Column('title', sa.String(), nullable=False),
        sa.Column('short_description', sa.String(), server_default='', nullable=False),
        sa.Column('description', sa.Text(), server_default='', nullable=False),
        sa.Column('cover_image_url', sa.String(), nullable=True),
        sa.Column('price_kes', sa.Integer(), server_default='0', nullable=False),
        sa.Column('published_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('archived_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('slug'),
    )
    op.create_index(op.f('ix_courses_slug'), 'courses', ['slug'])


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_index(op.f('ix_courses_slug'), table_name='courses')
    op.drop_table('courses')
