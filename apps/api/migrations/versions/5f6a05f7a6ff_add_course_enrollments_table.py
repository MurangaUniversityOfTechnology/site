"""add course enrollments table

Revision ID: 5f6a05f7a6ff
Revises: e8a77c221ade
Create Date: 2026-09-03 09:29:51.976075

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision: str = '5f6a05f7a6ff'
down_revision: Union[str, Sequence[str], None] = 'e8a77c221ade'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

course_access_type_enum = postgresql.ENUM('free_member', 'paid', name='courseaccesstype', create_type=False)


def upgrade() -> None:
    """Upgrade schema."""
    course_access_type_enum.create(op.get_bind(), checkfirst=True)
    op.create_table(
        'course_enrollments',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('course_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('user_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('access', course_access_type_enum, nullable=False),
        sa.Column('enrolled_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('completed_at', sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(['course_id'], ['courses.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('course_id', 'user_id', name='ux_course_enrollments_course_user'),
    )
    op.create_index(op.f('ix_course_enrollments_course_id'), 'course_enrollments', ['course_id'])
    op.create_index(op.f('ix_course_enrollments_user_id'), 'course_enrollments', ['user_id'])


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_index(op.f('ix_course_enrollments_user_id'), table_name='course_enrollments')
    op.drop_index(op.f('ix_course_enrollments_course_id'), table_name='course_enrollments')
    op.drop_table('course_enrollments')
    course_access_type_enum.drop(op.get_bind(), checkfirst=True)
