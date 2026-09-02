"""add donations table

Revision ID: f2a7c4e9b1d6
Revises: e4b6c2f19a0d
Create Date: 2026-09-02 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = 'f2a7c4e9b1d6'
down_revision: Union[str, Sequence[str], None] = 'e4b6c2f19a0d'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

# Same enum type payments.status already uses — reused, not recreated.
payment_status_enum = postgresql.ENUM(
    'initiated', 'pending', 'completed', 'failed', 'cancelled', 'unknown',
    name='paymentstatus', create_type=False,
)
donation_reason_enum = postgresql.ENUM(
    'alumni', 'general', 'sponsorship', 'scholarship', 'other',
    name='donationreason', create_type=False,
)


def upgrade() -> None:
    """Upgrade schema."""
    postgresql.ENUM(
        'alumni', 'general', 'sponsorship', 'scholarship', 'other', name='donationreason',
    ).create(op.get_bind(), checkfirst=True)
    op.create_table(
        'donations',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('user_id', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('amount', sa.Numeric(10, 2), nullable=False),
        sa.Column('phone', sa.String(), nullable=False),
        sa.Column('reason', donation_reason_enum, nullable=False),
        sa.Column('donor_name', sa.String(), nullable=True),
        sa.Column('is_anonymous', sa.Boolean(), server_default=sa.text('false'), nullable=False),
        sa.Column('message', sa.Text(), nullable=True),
        sa.Column('checkout_request_id', sa.String(), nullable=True),
        sa.Column('merchant_request_id', sa.String(), nullable=True),
        sa.Column('mpesa_receipt', sa.String(), nullable=True),
        sa.Column('status', payment_status_enum, server_default='initiated', nullable=False),
        sa.Column('raw_callback', postgresql.JSONB(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(['user_id'], ['users.id']),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('checkout_request_id'),
    )
    op.create_index(op.f('ix_donations_user_id'), 'donations', ['user_id'])
    op.create_index(op.f('ix_donations_checkout_request_id'), 'donations', ['checkout_request_id'])


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_index(op.f('ix_donations_checkout_request_id'), table_name='donations')
    op.drop_index(op.f('ix_donations_user_id'), table_name='donations')
    op.drop_table('donations')
    donation_reason_enum.drop(op.get_bind(), checkfirst=True)
