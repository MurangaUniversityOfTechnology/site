"""add event managers table

Revision ID: f3b7c2a9d1e4
Revises: d9a1e6c3f7b2
Create Date: 2026-09-12 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision: str = 'f3b7c2a9d1e4'
down_revision: Union[str, Sequence[str], None] = 'd9a1e6c3f7b2'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

event_manager_status_enum = postgresql.ENUM('invited', 'active', 'revoked', name='eventmanagerstatus', create_type=False)


def upgrade() -> None:
    """Upgrade schema."""
    event_manager_status_enum.create(op.get_bind(), checkfirst=True)
    op.create_table(
        'event_managers',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('event_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('user_id', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('invited_email', sa.String(), nullable=False),
        sa.Column('invited_by_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('status', event_manager_status_enum, nullable=False),
        sa.Column('token', sa.String(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('accepted_at', sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(['event_id'], ['events.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['invited_by_id'], ['users.id']),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('event_id', 'invited_email', name='ux_event_managers_event_email'),
        sa.UniqueConstraint('token'),
    )
    op.create_index(op.f('ix_event_managers_event_id'), 'event_managers', ['event_id'])
    op.create_index(op.f('ix_event_managers_user_id'), 'event_managers', ['user_id'])
    op.create_index(op.f('ix_event_managers_token'), 'event_managers', ['token'])


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_index(op.f('ix_event_managers_token'), table_name='event_managers')
    op.drop_index(op.f('ix_event_managers_user_id'), table_name='event_managers')
    op.drop_index(op.f('ix_event_managers_event_id'), table_name='event_managers')
    op.drop_table('event_managers')
    event_manager_status_enum.drop(op.get_bind(), checkfirst=True)
