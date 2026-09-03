"""add course payments table

Revision ID: 02bb14232269
Revises: 5f6a05f7a6ff
Create Date: 2026-09-03 09:29:52.607412

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision: str = '02bb14232269'
down_revision: Union[str, Sequence[str], None] = '5f6a05f7a6ff'
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
        'course_payments',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('enrollment_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('amount', sa.Numeric(10, 2), nullable=False),
        sa.Column('phone', sa.String(), nullable=False),
        sa.Column('checkout_request_id', sa.String(), nullable=True),
        sa.Column('merchant_request_id', sa.String(), nullable=True),
        sa.Column('mpesa_receipt', sa.String(), nullable=True),
        sa.Column('status', payment_status_enum, server_default='initiated', nullable=False),
        sa.Column('raw_callback', postgresql.JSONB(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(['enrollment_id'], ['course_enrollments.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('enrollment_id'),
        sa.UniqueConstraint('checkout_request_id'),
    )
    op.create_index(op.f('ix_course_payments_checkout_request_id'), 'course_payments', ['checkout_request_id'])


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_index(op.f('ix_course_payments_checkout_request_id'), table_name='course_payments')
    op.drop_table('course_payments')
