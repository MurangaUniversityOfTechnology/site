"""add course quizzes and questions tables

Revision ID: e8a77c221ade
Revises: 85f7b9bb618a
Create Date: 2026-09-03 09:29:51.345849

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision: str = 'e8a77c221ade'
down_revision: Union[str, Sequence[str], None] = '85f7b9bb618a'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

quiz_kind_enum = postgresql.ENUM('module_quiz', 'final_exam', name='quizkind', create_type=False)


def upgrade() -> None:
    """Upgrade schema."""
    quiz_kind_enum.create(op.get_bind(), checkfirst=True)
    op.create_table(
        'course_quizzes',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('kind', quiz_kind_enum, nullable=False),
        sa.Column('course_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('module_id', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('title', sa.String(), nullable=False),
        sa.Column('intro_text', sa.Text(), nullable=True),
        sa.Column('pass_threshold_pct', sa.Integer(), server_default='80', nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(['course_id'], ['courses.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['module_id'], ['course_modules.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('module_id'),
    )
    op.create_index(op.f('ix_course_quizzes_course_id'), 'course_quizzes', ['course_id'])
    # "Exactly one final exam per course" — a *partial* unique index, since
    # many module quizzes legitimately share the same course_id.
    op.create_index(
        'ux_course_quizzes_one_final_exam',
        'course_quizzes',
        ['course_id'],
        unique=True,
        postgresql_where=sa.text("kind = 'final_exam'"),
    )

    op.create_table(
        'course_quiz_questions',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('quiz_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('prompt', sa.Text(), nullable=False),
        sa.Column('choices', sa.JSON(), nullable=False),
        sa.Column('correct_choice_id', sa.String(), nullable=False),
        sa.Column('explanation', sa.Text(), nullable=True),
        sa.Column('position', sa.Integer(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(['quiz_id'], ['course_quizzes.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('quiz_id', 'position', name='ux_course_quiz_questions_quiz_position'),
    )
    op.create_index(op.f('ix_course_quiz_questions_quiz_id'), 'course_quiz_questions', ['quiz_id'])


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_index(op.f('ix_course_quiz_questions_quiz_id'), table_name='course_quiz_questions')
    op.drop_table('course_quiz_questions')
    op.drop_index('ux_course_quizzes_one_final_exam', table_name='course_quizzes')
    op.drop_index(op.f('ix_course_quizzes_course_id'), table_name='course_quizzes')
    op.drop_table('course_quizzes')
    quiz_kind_enum.drop(op.get_bind(), checkfirst=True)
