"""add forms, form fields, and form responses tables

Revision ID: aab8d21decc3
Revises: c8d1abef7ecc
Create Date: 2026-09-04 16:41:21.007015

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'aab8d21decc3'
down_revision: Union[str, Sequence[str], None] = 'c8d1abef7ecc'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.create_table(
        'forms',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('slug', sa.String(), nullable=False),
        sa.Column('title', sa.String(), nullable=False),
        sa.Column('description', sa.Text(), nullable=False),
        sa.Column('require_login', sa.Boolean(), nullable=False),
        sa.Column('closes_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('created_by_id', sa.UUID(), nullable=False),
        sa.Column('published_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('archived_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(['created_by_id'], ['users.id']),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(op.f('ix_forms_slug'), 'forms', ['slug'], unique=True)

    op.create_table(
        'form_fields',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('form_id', sa.UUID(), nullable=False),
        sa.Column('type', sa.String(), nullable=False),
        sa.Column('prompt', sa.Text(), nullable=False),
        sa.Column('help_text', sa.String(), nullable=True),
        sa.Column('required', sa.Boolean(), nullable=False),
        sa.Column('choices', sa.JSON(), nullable=False),
        sa.Column('position', sa.Integer(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(['form_id'], ['forms.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('form_id', 'position', name='ux_form_fields_form_position'),
    )
    op.create_index(op.f('ix_form_fields_form_id'), 'form_fields', ['form_id'], unique=False)

    op.create_table(
        'form_responses',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('form_id', sa.UUID(), nullable=False),
        sa.Column('user_id', sa.UUID(), nullable=True),
        sa.Column('answers', sa.JSON(), nullable=False),
        sa.Column('submitted_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(['form_id'], ['forms.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('form_id', 'user_id', name='ux_form_responses_form_user'),
    )
    op.create_index(op.f('ix_form_responses_form_id'), 'form_responses', ['form_id'], unique=False)
    op.create_index(op.f('ix_form_responses_user_id'), 'form_responses', ['user_id'], unique=False)


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_index(op.f('ix_form_responses_user_id'), table_name='form_responses')
    op.drop_index(op.f('ix_form_responses_form_id'), table_name='form_responses')
    op.drop_table('form_responses')
    op.drop_index(op.f('ix_form_fields_form_id'), table_name='form_fields')
    op.drop_table('form_fields')
    op.drop_index(op.f('ix_forms_slug'), table_name='forms')
    op.drop_table('forms')
