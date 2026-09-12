"""add roadmaps and roadmap milestones tables

Revision ID: d9a1e6c3f7b2
Revises: 9b1e4c7d2a6f
Create Date: 2026-09-12 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision: str = 'd9a1e6c3f7b2'
down_revision: Union[str, Sequence[str], None] = '9b1e4c7d2a6f'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

milestone_status_enum = postgresql.ENUM('planned', 'in_progress', 'done', name='milestonestatus', create_type=False)


def upgrade() -> None:
    """Upgrade schema."""
    op.create_table(
        'roadmaps',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('arm_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('title', sa.String(), nullable=False),
        sa.Column('goal_summary', sa.Text(), nullable=True),
        sa.Column('position', sa.Integer(), nullable=False),
        sa.Column('published_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('created_by_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(['arm_id'], ['arms.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['created_by_id'], ['users.id']),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('arm_id', 'position', name='ux_roadmaps_arm_position'),
    )
    op.create_index(op.f('ix_roadmaps_arm_id'), 'roadmaps', ['arm_id'])

    milestone_status_enum.create(op.get_bind(), checkfirst=True)
    op.create_table(
        'roadmap_milestones',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('roadmap_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('title', sa.String(), nullable=False),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('status', milestone_status_enum, nullable=False),
        sa.Column('position', sa.Integer(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(['roadmap_id'], ['roadmaps.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('roadmap_id', 'position', name='ux_roadmap_milestones_roadmap_position'),
    )
    op.create_index(op.f('ix_roadmap_milestones_roadmap_id'), 'roadmap_milestones', ['roadmap_id'])


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_index(op.f('ix_roadmap_milestones_roadmap_id'), table_name='roadmap_milestones')
    op.drop_table('roadmap_milestones')
    milestone_status_enum.drop(op.get_bind(), checkfirst=True)
    op.drop_index(op.f('ix_roadmaps_arm_id'), table_name='roadmaps')
    op.drop_table('roadmaps')
