"""add arms and course arms tables

Revision ID: 0c9594141e39
Revises: 81235720ee14
Create Date: 2026-09-03 11:16:49.298157

"""
import uuid
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision: str = '0c9594141e39'
down_revision: Union[str, Sequence[str], None] = '81235720ee14'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

# Initial set the Chairperson asked for — position order is deliberate
# ("Others" stays last) and stays admin-editable afterward (rename/reorder/
# add/delete via /admin/arms), this just seeds a usable starting set.
SEED_ARMS = [
    ("Web Development & UI/UX Design", "web-development-and-ui-ux-design"),
    ("Artificial Intelligence & Robotics", "artificial-intelligence-and-robotics"),
    ("IoT / Network / Hardware", "iot-network-hardware"),
    ("Cybersecurity & Digital Forensics", "cybersecurity-and-digital-forensics"),
    ("Mobile Application Development", "mobile-application-development"),
    ("Augmented & Virtual Reality", "augmented-and-virtual-reality"),
    ("Blockchain", "blockchain"),
    ("Others", "others"),
]


def upgrade() -> None:
    """Upgrade schema."""
    op.create_table(
        'arms',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('slug', sa.String(), nullable=False),
        sa.Column('name', sa.String(), nullable=False),
        sa.Column('position', sa.Integer(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('slug'),
        sa.UniqueConstraint('name'),
    )
    op.create_index(op.f('ix_arms_slug'), 'arms', ['slug'])

    op.create_table(
        'course_arms',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('course_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('arm_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(['course_id'], ['courses.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['arm_id'], ['arms.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('course_id', 'arm_id', name='ux_course_arms_course_arm'),
    )
    op.create_index(op.f('ix_course_arms_course_id'), 'course_arms', ['course_id'])
    op.create_index(op.f('ix_course_arms_arm_id'), 'course_arms', ['arm_id'])

    arms_table = sa.table(
        'arms',
        sa.column('id', postgresql.UUID(as_uuid=True)),
        sa.column('slug', sa.String()),
        sa.column('name', sa.String()),
        sa.column('position', sa.Integer()),
    )
    op.bulk_insert(
        arms_table,
        [
            {"id": uuid.uuid4(), "name": name, "slug": slug, "position": i}
            for i, (name, slug) in enumerate(SEED_ARMS, start=1)
        ],
    )


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_index(op.f('ix_course_arms_arm_id'), table_name='course_arms')
    op.drop_index(op.f('ix_course_arms_course_id'), table_name='course_arms')
    op.drop_table('course_arms')
    op.drop_index(op.f('ix_arms_slug'), table_name='arms')
    op.drop_table('arms')
