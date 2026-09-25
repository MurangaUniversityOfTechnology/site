import uuid
from datetime import datetime

from pydantic import BaseModel, Field

# ── admin: content ───────────────────────────────────────────────────────


class QuizQuestion(BaseModel):
    prompt: str = Field(max_length=300)
    choices: list[str] = Field(max_length=4)
    # More than one index = "select all that apply"
    correct: list[int]
    time_limit: int = 20


class QuizWriteRequest(BaseModel):
    title: str = Field(min_length=1, max_length=120)
    description: str | None = Field(default=None, max_length=500)
    questions: list[QuizQuestion] = Field(max_length=50)


class QuizRow(BaseModel):
    id: uuid.UUID
    title: str
    description: str | None
    question_count: int
    updated_at: datetime


class QuizDetail(BaseModel):
    id: uuid.UUID
    title: str
    description: str | None
    questions: list[QuizQuestion]


class DeckWriteRequest(BaseModel):
    title: str = Field(min_length=1, max_length=120)
    terms: list[str] = Field(max_length=300)


class DeckRow(BaseModel):
    id: uuid.UUID
    title: str
    term_count: int
    updated_at: datetime


class DeckDetail(BaseModel):
    id: uuid.UUID
    title: str
    terms: list[str]


# ── admin: hosting ───────────────────────────────────────────────────────


class SessionCreateRequest(BaseModel):
    quiz_id: uuid.UUID | None = None
    deck_id: uuid.UUID | None = None


class LiveSessionRow(BaseModel):
    id: uuid.UUID
    pin: str
    kind: str
    title: str
    status: str
    player_count: int
    created_at: datetime


class HostPlayer(BaseModel):
    id: uuid.UUID
    nickname: str
    score: int
    answered: bool
    bingo_at: datetime | None


class HostState(BaseModel):
    id: uuid.UUID
    pin: str
    kind: str
    title: str
    status: str
    # quiz
    question_number: int
    question_count: int
    question: QuizQuestion | None
    seconds_left: int | None
    answered_count: int
    choice_counts: list[int] | None  # only once the answer is revealed
    # bingo
    called: list[str]
    terms_left: int
    winners: list[str]
    players: list[HostPlayer]  # leaderboard order


# ── players ──────────────────────────────────────────────────────────────


class JoinRequest(BaseModel):
    pin: str = Field(min_length=6, max_length=6)
    nickname: str | None = Field(default=None, max_length=24)


class JoinResponse(BaseModel):
    token: str
    pin: str
    kind: str
    nickname: str


class PlayerQuestion(BaseModel):
    number: int
    count: int
    prompt: str
    choices: list[str]
    multi: bool
    time_limit: int


class PlayerAnswer(BaseModel):
    choices: list[int]
    # Only filled in once the question is revealed — no peeking early.
    correct: bool | None
    points: int | None


class LeaderboardRow(BaseModel):
    nickname: str
    score: int


class PlayerState(BaseModel):
    pin: str
    kind: str
    title: str
    status: str
    nickname: str
    score: int
    rank: int
    player_count: int
    # quiz
    question: PlayerQuestion | None
    seconds_left: int | None
    my_answer: PlayerAnswer | None
    correct: list[int] | None
    leaderboard: list[LeaderboardRow]
    # bingo
    card: list[str] | None
    called: list[str]
    winners: list[str]
    has_bingo: bool


class AnswerRequest(BaseModel):
    choices: list[int] = Field(min_length=1, max_length=4)


class BingoClaimResponse(BaseModel):
    line: list[int]
