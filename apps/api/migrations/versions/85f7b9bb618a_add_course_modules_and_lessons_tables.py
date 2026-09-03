"""add course modules and lessons tables

Revision ID: 85f7b9bb618a
Revises: 5b23f68ef23d
Create Date: 2026-09-03 09:29:50.723574

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision: str = '85f7b9bb618a'
down_revision: Union[str, Sequence[str], None] = '5b23f68ef23d'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.create_table(
        'course_modules',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('course_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('title', sa.String(), nullable=False),
        sa.Column('summary', sa.Text(), nullable=True),
        sa.Column('position', sa.Integer(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(['course_id'], ['courses.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('course_id', 'position', name='ux_course_modules_course_position'),
    )
    op.create_index(op.f('ix_course_modules_course_id'), 'course_modules', ['course_id'])

    op.create_table(
        'course_lessons',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('module_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('title', sa.String(), nullable=False),
        sa.Column('body', sa.Text(), server_default='', nullable=False),
        sa.Column('video_url', sa.String(), nullable=True),
        sa.Column('position', sa.Integer(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(['module_id'], ['course_modules.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('module_id', 'position', name='ux_course_lessons_module_position'),
    )
    op.create_index(op.f('ix_course_lessons_module_id'), 'course_lessons', ['module_id'])


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_index(op.f('ix_course_lessons_module_id'), table_name='course_lessons')
    op.drop_table('course_lessons')
    op.drop_index(op.f('ix_course_modules_course_id'), table_name='course_modules')
    op.drop_table('course_modules')
