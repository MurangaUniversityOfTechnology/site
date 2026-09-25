import enum
import uuid
from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import (
    JSON,
    Boolean,
    DateTime,
    Enum,
    ForeignKey,
    Integer,
    String,
    Text,
    UniqueConstraint,
    func,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.db import Base

if TYPE_CHECKING:
    from app.models.user import User


class GameKind(str, enum.Enum):
    quiz = "quiz"
    bingo = "bingo"


class GameSessionStatus(str, enum.Enum):
    lobby = "lobby"
    # quiz only: a question is open for answers / its answer is on screen
    question = "question"
    reveal = "reveal"
    # bingo only: terms are being called
    playing = "playing"
    finished = "finished"


class GameQuiz(Base):
    """
    A Kahoot-style quiz authored in /admin/games. Questions are stored whole
    as a JSON list — [{prompt, choices: [str], correct: [int], time_limit}]
    — since they're only ever edited and played as one unit, never queried
    individually. More than one index in `correct` makes it a "select all
    that apply" question.
    """

    __tablename__ = "game_quizzes"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    title: Mapped[str] = mapped_column(String, nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    questions: Mapped[list[dict]] = mapped_column(JSON, nullable=False, default=list)
    created_by_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    created_by: Mapped["User"] = relationship()


class BingoDeck(Base):
    """The pool of tech terms a bingo game deals cards from and calls out."""

    __tablename__ = "bingo_decks"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    title: Mapped[str] = mapped_column(String, nullable=False)
    terms: Mapped[list[str]] = mapped_column(JSON, nullable=False, default=list)
    created_by_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    created_by: Mapped["User"] = relationship()


class GameSession(Base):
    """
    One live run of a quiz or bingo deck, joined by PIN. `content` is a
    snapshot of the quiz's questions / the deck's terms taken at creation,
    so editing the quiz mid-game can't change what players are answering.
    """

    __tablename__ = "game_sessions"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    kind: Mapped[GameKind] = mapped_column(Enum(GameKind), nullable=False)
    # Unique only among unfinished sessions — enforced in services/games.py,
    # so a 6-digit PIN can be reused once its old game is over.
    pin: Mapped[str] = mapped_column(String(6), nullable=False, index=True)
    title: Mapped[str] = mapped_column(String, nullable=False)
    status: Mapped[GameSessionStatus] = mapped_column(Enum(GameSessionStatus), nullable=False, default=GameSessionStatus.lobby)
    content: Mapped[list] = mapped_column(JSON, nullable=False, default=list)
    quiz_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("game_quizzes.id", ondelete="SET NULL"), nullable=True
    )
    deck_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("bingo_decks.id", ondelete="SET NULL"), nullable=True
    )
    # quiz: index into content of the current question (-1 before the first)
    current_index: Mapped[int] = mapped_column(Integer, nullable=False, default=-1)
    question_started_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    # bingo: terms called so far, in call order
    called: Mapped[list[str]] = mapped_column(JSON, nullable=False, default=list)
    host_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    finished_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    host: Mapped["User"] = relationship()
    players: Mapped[list["GamePlayer"]] = relationship(
        back_populates="session", cascade="all, delete-orphan", passive_deletes=True, order_by="GamePlayer.joined_at"
    )


class GamePlayer(Base):
    """Anyone who joined with the PIN — a signed-in user or a guest with just
    a nickname. `token_hash` is how a guest's browser proves it's them on
    every poll/answer (the raw token only ever lives in their localStorage)."""

    __tablename__ = "game_players"
    __table_args__ = (UniqueConstraint("session_id", "nickname", name="ux_game_players_session_nickname"),)

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    session_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("game_sessions.id", ondelete="CASCADE"), nullable=False, index=True
    )
    user_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    nickname: Mapped[str] = mapped_column(String(24), nullable=False)
    token_hash: Mapped[str] = mapped_column(String, nullable=False, unique=True)
    score: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    # bingo: the dealt 5×5 card, row-major, "FREE" in the centre
    card: Mapped[list[str] | None] = mapped_column(JSON, nullable=True)
    bingo_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    kicked_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    joined_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    session: Mapped["GameSession"] = relationship(back_populates="players")
    answers: Mapped[list["GameAnswer"]] = relationship(cascade="all, delete-orphan", passive_deletes=True)


class GameAnswer(Base):
    __tablename__ = "game_answers"
    __table_args__ = (UniqueConstraint("player_id", "question_index", name="ux_game_answers_player_question"),)

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    player_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("game_players.id", ondelete="CASCADE"), nullable=False, index=True
    )
    question_index: Mapped[int] = mapped_column(Integer, nullable=False)
    choices: Mapped[list[int]] = mapped_column(JSON, nullable=False)
    correct: Mapped[bool] = mapped_column(Boolean, nullable=False)
    points: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    answered_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
