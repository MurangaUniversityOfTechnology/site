"""add event_payments table

Revision ID: a3d9e5c7f214
Revises: f2a7c4e9b1d6
Create Date: 2026-09-02 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = 'a3d9e5c7f214'
down_revision: Union[str, Sequence[str], None] = 'f2a7c4e9b1d6'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

# Same enum type payments.status already uses — reused, not recreated.
payment_status_enum = postgresql.ENUM(
    'initiated', 'pending', 'completed', 'failed', 'cancelled', 'unknown',
    name='paymentstatus', create_type=False,
)


def upgrade() -> None:
    """Upgrade schema."""
    op.create_table(
        'event_payments',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('registration_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('amount', sa.Numeric(10, 2), nullable=False),
        sa.Column('phone', sa.String(), nullable=False),
        sa.Column('checkout_request_id', sa.String(), nullable=True),
        sa.Column('merchant_request_id', sa.String(), nullable=True),
        sa.Column('mpesa_receipt', sa.String(), nullable=True),
        sa.Column('status', payment_status_enum, server_default='initiated', nullable=False),
        sa.Column('raw_callback', postgresql.JSONB(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(['registration_id'], ['event_registrations.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('registration_id'),
        sa.UniqueConstraint('checkout_request_id'),
    )
    op.create_index(op.f('ix_event_payments_checkout_request_id'), 'event_payments', ['checkout_request_id'])


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_index(op.f('ix_event_payments_checkout_request_id'), table_name='event_payments')
    op.drop_table('event_payments')
