"""add community comment votes and attachments

Revision ID: e2f8a1c4d9b6
Revises: c7a9e2f4b1d3
Create Date: 2026-09-05 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision: str = 'e2f8a1c4d9b6'
down_revision: Union[str, Sequence[str], None] = 'c7a9e2f4b1d3'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.add_column('community_posts', sa.Column('attachments', sa.JSON(), server_default='[]', nullable=False))
    op.add_column('community_comments', sa.Column('attachments', sa.JSON(), server_default='[]', nullable=False))

    op.create_table(
        'community_comment_votes',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('comment_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('user_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('value', sa.SmallInteger(), nullable=False),
        sa.ForeignKeyConstraint(['comment_id'], ['community_comments.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('comment_id', 'user_id', name='ux_community_comment_votes_comment_user'),
    )
    op.create_index('ix_community_comment_votes_comment_id', 'community_comment_votes', ['comment_id'])
    op.create_index('ix_community_comment_votes_user_id', 'community_comment_votes', ['user_id'])


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_index('ix_community_comment_votes_user_id', table_name='community_comment_votes')
    op.drop_index('ix_community_comment_votes_comment_id', table_name='community_comment_votes')
    op.drop_table('community_comment_votes')

    op.drop_column('community_comments', 'attachments')
    op.drop_column('community_posts', 'attachments')
