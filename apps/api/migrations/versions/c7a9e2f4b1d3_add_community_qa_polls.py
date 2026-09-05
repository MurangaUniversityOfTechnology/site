"""add community q&a/polls tables

Revision ID: c7a9e2f4b1d3
Revises: b1c4d8e2a9f0
Create Date: 2026-09-05 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision: str = 'c7a9e2f4b1d3'
down_revision: Union[str, Sequence[str], None] = 'b1c4d8e2a9f0'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    post_kind = postgresql.ENUM('question', 'poll', name='communitypostkind')

    op.create_table(
        'community_posts',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('kind', post_kind, nullable=False),
        sa.Column('author_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('is_anonymous', sa.Boolean(), nullable=False),
        sa.Column('title', sa.String(), nullable=False),
        sa.Column('body', sa.Text(), nullable=True),
        sa.Column('link_url', sa.String(), nullable=True),
        sa.Column('link_title', sa.String(), nullable=True),
        sa.Column('link_description', sa.Text(), nullable=True),
        sa.Column('link_image_url', sa.String(), nullable=True),
        sa.Column('link_site_name', sa.String(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('is_hidden', sa.Boolean(), nullable=False),
        sa.Column('hidden_reason', sa.Text(), nullable=True),
        sa.ForeignKeyConstraint(['author_id'], ['users.id']),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_community_posts_author_id', 'community_posts', ['author_id'])

    op.create_table(
        'community_poll_options',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('post_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('label', sa.String(), nullable=False),
        sa.Column('position', sa.Integer(), nullable=False),
        sa.ForeignKeyConstraint(['post_id'], ['community_posts.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_community_poll_options_post_id', 'community_poll_options', ['post_id'])

    op.create_table(
        'community_votes',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('post_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('user_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('value', sa.SmallInteger(), nullable=False),
        sa.ForeignKeyConstraint(['post_id'], ['community_posts.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('post_id', 'user_id', name='ux_community_votes_post_user'),
    )
    op.create_index('ix_community_votes_post_id', 'community_votes', ['post_id'])
    op.create_index('ix_community_votes_user_id', 'community_votes', ['user_id'])

    op.create_table(
        'community_poll_votes',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('post_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('option_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('user_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.ForeignKeyConstraint(['post_id'], ['community_posts.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['option_id'], ['community_poll_options.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('post_id', 'user_id', name='ux_community_poll_votes_post_user'),
    )
    op.create_index('ix_community_poll_votes_post_id', 'community_poll_votes', ['post_id'])
    op.create_index('ix_community_poll_votes_option_id', 'community_poll_votes', ['option_id'])
    op.create_index('ix_community_poll_votes_user_id', 'community_poll_votes', ['user_id'])

    op.create_table(
        'community_comments',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('post_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('author_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('is_anonymous', sa.Boolean(), nullable=False),
        sa.Column('body', sa.Text(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('is_hidden', sa.Boolean(), nullable=False),
        sa.Column('hidden_reason', sa.Text(), nullable=True),
        sa.ForeignKeyConstraint(['post_id'], ['community_posts.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['author_id'], ['users.id']),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_community_comments_post_id', 'community_comments', ['post_id'])
    op.create_index('ix_community_comments_author_id', 'community_comments', ['author_id'])


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_index('ix_community_comments_author_id', table_name='community_comments')
    op.drop_index('ix_community_comments_post_id', table_name='community_comments')
    op.drop_table('community_comments')

    op.drop_index('ix_community_poll_votes_user_id', table_name='community_poll_votes')
    op.drop_index('ix_community_poll_votes_option_id', table_name='community_poll_votes')
    op.drop_index('ix_community_poll_votes_post_id', table_name='community_poll_votes')
    op.drop_table('community_poll_votes')

    op.drop_index('ix_community_votes_user_id', table_name='community_votes')
    op.drop_index('ix_community_votes_post_id', table_name='community_votes')
    op.drop_table('community_votes')

    op.drop_index('ix_community_poll_options_post_id', table_name='community_poll_options')
    op.drop_table('community_poll_options')

    op.drop_index('ix_community_posts_author_id', table_name='community_posts')
    op.drop_table('community_posts')

    postgresql.ENUM(name='communitypostkind').drop(op.get_bind())
