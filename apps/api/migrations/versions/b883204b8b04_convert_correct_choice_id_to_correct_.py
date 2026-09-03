"""convert correct_choice_id to correct_choice_ids array

Revision ID: b883204b8b04
Revises: 05c6e668cf37
Create Date: 2026-09-03 16:38:47.282012

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'b883204b8b04'
down_revision: Union[str, Sequence[str], None] = '05c6e668cf37'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.add_column('course_quiz_questions', sa.Column('correct_choice_ids', sa.JSON(), nullable=True))
    op.execute("UPDATE course_quiz_questions SET correct_choice_ids = json_build_array(correct_choice_id)")
    op.alter_column('course_quiz_questions', 'correct_choice_ids', nullable=False)
    op.drop_column('course_quiz_questions', 'correct_choice_id')


def downgrade() -> None:
    """Downgrade schema."""
    op.add_column('course_quiz_questions', sa.Column('correct_choice_id', sa.String(), nullable=True))
    op.execute("UPDATE course_quiz_questions SET correct_choice_id = correct_choice_ids->>0")
    op.alter_column('course_quiz_questions', 'correct_choice_id', nullable=False)
    op.drop_column('course_quiz_questions', 'correct_choice_ids')
