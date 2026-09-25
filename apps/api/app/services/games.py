"""Live games — a Kahoot-style quiz and tech-term bingo — played by PIN.

State lives entirely in Postgres and clients poll it (see routers/games.py):
a game night is a few dozen phones for an hour, which polling handles fine,
and it survives flaky campus wifi and API restarts in a way an in-memory
websocket room wouldn't. Time-sensitive transitions (a question's timer
running out) are applied lazily on the next read via _advance_if_due(),
so nothing depends on the host's screen staying open.
"""

import hashlib
import random
import secrets
from datetime import UTC, datetime, timedelta

from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.models.game import (
    BingoDeck,
    GameAnswer,
    GameKind,
    GamePlayer,
    GameQuiz,
    GameSession,
    GameSessionStatus,
)
from app.models.user import User
from app.services import audit

BINGO_FREE = "FREE"
BINGO_CARD_TERMS = 24  # 5×5 minus the free centre square
MAX_PLAYERS = 200
# A lobby nobody started (or a game nobody ended) stops holding its PIN
# after this — PINs are only unique among live sessions.
STALE_AFTER = timedelta(hours=12)
# Answers that were in flight when the timer hit zero still count.
ANSWER_GRACE = timedelta(seconds=1)
MAX_POINTS = 1000


class GameError(Exception):
    pass


class GameNotFound(GameError):
    pass


def _now() -> datetime:
    return datetime.now(UTC)


def _hash_token(token: str) -> str:
    return hashlib.sha256(token.encode()).hexdigest()


def display_name(user: User) -> str:
    return user.profile.display_name if user.profile and user.profile.display_name else user.email.split("@")[0]


# ── content validation ───────────────────────────────────────────────────


def _clean_questions(questions: list[dict]) -> list[dict]:
    cleaned = []
    for n, q in enumerate(questions, start=1):
        prompt = (q.get("prompt") or "").strip()
        choices = [c.strip() for c in q.get("choices", []) if c and c.strip()]
        correct = sorted(set(q.get("correct", [])))
        if not prompt:
            raise GameError(f"Question {n} needs a prompt")
        if not 2 <= len(choices) <= 4:
            raise GameError(f"Question {n} needs 2–4 answer choices")
        if not correct or any(i < 0 or i >= len(choices) for i in correct):
            raise GameError(f"Question {n} needs at least one correct choice")
        if len(correct) == len(choices):
            raise GameError(f"Question {n} can't have every choice correct")
        time_limit = int(q.get("time_limit") or 20)
        cleaned.append(
            {"prompt": prompt, "choices": choices, "correct": correct, "time_limit": max(5, min(time_limit, 120))}
        )
    return cleaned


def _clean_terms(terms: list[str]) -> list[str]:
    seen: dict[str, str] = {}
    for term in terms:
        term = term.strip()
        if term and term.upper() != BINGO_FREE and term.lower() not in seen:
            seen[term.lower()] = term
    return list(seen.values())


# ── quizzes / decks (admin content) ──────────────────────────────────────


def list_quizzes(db: Session) -> list[GameQuiz]:
    return db.query(GameQuiz).order_by(GameQuiz.updated_at.desc()).all()


def get_quiz(db: Session, quiz_id) -> GameQuiz:
    quiz = db.get(GameQuiz, quiz_id)
    if not quiz:
        raise GameNotFound("Unknown quiz")
    return quiz


def save_quiz(db: Session, admin: User, quiz: GameQuiz | None, *, title: str, description: str | None, questions: list[dict]) -> GameQuiz:
    cleaned = _clean_questions(questions)
    if quiz is None:
        quiz = GameQuiz(created_by_id=admin.id)
        db.add(quiz)
        verb = "Created"
    else:
        verb = "Updated"
    quiz.title = title.strip()
    quiz.description = (description or "").strip() or None
    quiz.questions = cleaned
    audit.log(db, admin, "game", f"{verb} game quiz '{quiz.title}'")
    db.commit()
    db.refresh(quiz)
    return quiz


def delete_quiz(db: Session, admin: User, quiz: GameQuiz) -> None:
    audit.log(db, admin, "game", f"Deleted game quiz '{quiz.title}'")
    db.delete(quiz)
    db.commit()


def list_decks(db: Session) -> list[BingoDeck]:
    return db.query(BingoDeck).order_by(BingoDeck.updated_at.desc()).all()


def get_deck(db: Session, deck_id) -> BingoDeck:
    deck = db.get(BingoDeck, deck_id)
    if not deck:
        raise GameNotFound("Unknown bingo deck")
    return deck


def save_deck(db: Session, admin: User, deck: BingoDeck | None, *, title: str, terms: list[str]) -> BingoDeck:
    cleaned = _clean_terms(terms)
    if len(cleaned) < BINGO_CARD_TERMS:
        raise GameError(f"A bingo deck needs at least {BINGO_CARD_TERMS} different terms (has {len(cleaned)})")
    if deck is None:
        deck = BingoDeck(created_by_id=admin.id)
        db.add(deck)
        verb = "Created"
    else:
        verb = "Updated"
    deck.title = title.strip()
    deck.terms = cleaned
    audit.log(db, admin, "game", f"{verb} bingo deck '{deck.title}'")
    db.commit()
    db.refresh(deck)
    return deck


def delete_deck(db: Session, admin: User, deck: BingoDeck) -> None:
    audit.log(db, admin, "game", f"Deleted bingo deck '{deck.title}'")
    db.delete(deck)
    db.commit()


# ── sessions (host side) ─────────────────────────────────────────────────


def _live_filter(query):
    return query.filter(
        GameSession.status != GameSessionStatus.finished,
        GameSession.created_at > _now() - STALE_AFTER,
    )


def _new_pin(db: Session) -> str:
    for _ in range(50):
        pin = f"{secrets.randbelow(900000) + 100000}"
        if not _live_filter(db.query(GameSession).filter(GameSession.pin == pin)).first():
            return pin
    raise GameError("Couldn't allocate a game PIN — try again")


def create_session(db: Session, host: User, *, quiz_id=None, deck_id=None) -> GameSession:
    if quiz_id:
        quiz = get_quiz(db, quiz_id)
        if not quiz.questions:
            raise GameError("This quiz has no questions yet")
        session = GameSession(kind=GameKind.quiz, title=quiz.title, content=quiz.questions, quiz_id=quiz.id)
    elif deck_id:
        deck = get_deck(db, deck_id)
        session = GameSession(kind=GameKind.bingo, title=deck.title, content=deck.terms, deck_id=deck.id)
    else:
        raise GameError("Pick a quiz or a bingo deck")
    session.pin = _new_pin(db)
    session.host_id = host.id
    session.called = []
    db.add(session)
    audit.log(db, host, "game", f"Started a {session.kind.value} game '{session.title}' (PIN {session.pin})")
    db.commit()
    db.refresh(session)
    return session


def list_live_sessions(db: Session) -> list[GameSession]:
    return _live_filter(db.query(GameSession)).order_by(GameSession.created_at.desc()).all()


def get_session(db: Session, session_id) -> GameSession:
    session = db.get(GameSession, session_id)
    if not session:
        raise GameNotFound("Unknown game")
    _advance_if_due(db, session)
    return session


def active_players(session: GameSession) -> list[GamePlayer]:
    return [p for p in session.players if p.kicked_at is None]


def leaderboard(session: GameSession) -> list[GamePlayer]:
    return sorted(active_players(session), key=lambda p: (-p.score, p.joined_at))


def bingo_winners(session: GameSession) -> list[GamePlayer]:
    return sorted((p for p in active_players(session) if p.bingo_at), key=lambda p: p.bingo_at)


def current_question(session: GameSession) -> dict | None:
    if session.kind != GameKind.quiz or not 0 <= session.current_index < len(session.content):
        return None
    return session.content[session.current_index]


def seconds_left(session: GameSession) -> int | None:
    question = current_question(session)
    if session.status != GameSessionStatus.question or not question or not session.question_started_at:
        return None
    ends = session.question_started_at + timedelta(seconds=question["time_limit"])
    return max(0, int((ends - _now()).total_seconds() + 0.999))


def answers_for_current(db: Session, session: GameSession) -> list[GameAnswer]:
    return (
        db.query(GameAnswer)
        .join(GamePlayer, GameAnswer.player_id == GamePlayer.id)
        .filter(
            GamePlayer.session_id == session.id,
            GamePlayer.kicked_at.is_(None),
            GameAnswer.question_index == session.current_index,
        )
        .all()
    )


def _advance_if_due(db: Session, session: GameSession) -> None:
    """Closes the current question once its timer is up or everyone still in
    the game has answered — whichever comes first."""
    if session.status != GameSessionStatus.question:
        return
    everyone_answered = len(answers_for_current(db, session)) >= len(active_players(session)) > 0
    if seconds_left(session) == 0 or everyone_answered:
        session.status = GameSessionStatus.reveal
        db.commit()


def _require_live(session: GameSession) -> None:
    if session.status == GameSessionStatus.finished:
        raise GameError("This game has already ended")


def advance(db: Session, session: GameSession) -> GameSession:
    """The host's one big "next" button. Quiz: lobby → Q1 → reveal → Q2 →
    … → finished. Bingo: lobby → playing, then each press calls a term."""
    _require_live(session)
    if session.kind == GameKind.quiz:
        if session.status == GameSessionStatus.question:
            session.status = GameSessionStatus.reveal
        elif session.current_index + 1 >= len(session.content):
            session.status = GameSessionStatus.finished
            session.finished_at = _now()
        else:
            session.current_index += 1
            session.status = GameSessionStatus.question
            session.question_started_at = _now()
    else:
        if session.status == GameSessionStatus.lobby:
            session.status = GameSessionStatus.playing
        else:
            remaining = [t for t in session.content if t not in session.called]
            if not remaining:
                raise GameError("Every term has been called")
            # Reassign rather than append in place — a mutated JSON list
            # isn't picked up by SQLAlchemy's change tracking.
            session.called = [*session.called, random.choice(remaining)]
    db.commit()
    db.refresh(session)
    return session


def end_session(db: Session, session: GameSession) -> GameSession:
    if session.status != GameSessionStatus.finished:
        session.status = GameSessionStatus.finished
        session.finished_at = _now()
        db.commit()
    return session


def kick_player(db: Session, session: GameSession, player_id) -> None:
    player = next((p for p in session.players if str(p.id) == str(player_id)), None)
    if not player:
        raise GameNotFound("Unknown player")
    player.kicked_at = _now()
    db.commit()


# ── players ──────────────────────────────────────────────────────────────


def _live_session_by_pin(db: Session, pin: str) -> GameSession:
    session = _live_filter(db.query(GameSession).filter(GameSession.pin == pin.strip())).first()
    if not session:
        raise GameNotFound("No live game with that PIN")
    return session


def _deal_card(terms: list[str]) -> list[str]:
    card = random.sample(terms, BINGO_CARD_TERMS)
    return card[:12] + [BINGO_FREE] + card[12:]


def join(db: Session, pin: str, nickname: str | None, user: User | None) -> tuple[GamePlayer, str]:
    """Returns (player, raw token). The token is shown to the client once
    and only its hash stored — it's the guest's only credential."""
    session = _live_session_by_pin(db, pin)
    token = secrets.token_urlsafe(24)
    if user:
        existing = next((p for p in session.players if p.user_id == user.id), None)
        if existing:
            if existing.kicked_at:
                raise GameError("The host removed you from this game")
            existing.token_hash = _hash_token(token)
            db.commit()
            return existing, token

    name = " ".join((nickname or "").split())[:24] or (display_name(user)[:24] if user else "")
    if not name:
        raise GameError("Pick a nickname")
    if any(p.nickname.lower() == name.lower() for p in session.players):
        raise GameError(f"'{name}' is taken in this game — try another nickname")
    if len(active_players(session)) >= MAX_PLAYERS:
        raise GameError("This game is full")

    player = GamePlayer(
        session_id=session.id,
        user_id=user.id if user else None,
        nickname=name,
        token_hash=_hash_token(token),
        card=_deal_card(session.content) if session.kind == GameKind.bingo else None,
    )
    db.add(player)
    db.commit()
    db.refresh(player)
    return player, token


def player_for_token(db: Session, pin: str, token: str | None) -> GamePlayer:
    if not token:
        raise GameNotFound("Join the game first")
    player = db.query(GamePlayer).filter(GamePlayer.token_hash == _hash_token(token)).first()
    if not player or player.session.pin != pin:
        raise GameNotFound("Join the game first")
    if player.kicked_at:
        raise GameError("The host removed you from this game")
    _advance_if_due(db, player.session)
    return player


def my_answer(db: Session, player: GamePlayer) -> GameAnswer | None:
    return (
        db.query(GameAnswer)
        .filter(GameAnswer.player_id == player.id, GameAnswer.question_index == player.session.current_index)
        .first()
    )


def answer(db: Session, player: GamePlayer, choices: list[int]) -> GameAnswer:
    session = player.session
    question = current_question(session)
    if session.status != GameSessionStatus.question or not question or not session.question_started_at:
        raise GameError("Time's up for this question")
    elapsed = _now() - session.question_started_at
    limit = timedelta(seconds=question["time_limit"])
    if elapsed > limit + ANSWER_GRACE:
        raise GameError("Time's up for this question")
    if my_answer(db, player):
        raise GameError("You've already answered this one")
    picked = sorted(set(choices))
    if not picked or any(i < 0 or i >= len(question["choices"]) for i in picked):
        raise GameError("Pick an answer")
    if len(question["correct"]) == 1 and len(picked) > 1:
        raise GameError("Pick just one answer")

    correct = picked == question["correct"]
    # Kahoot's curve: a correct answer is worth 500–1000, more the faster
    # it came in; a wrong one is worth nothing.
    fraction = min(elapsed / limit, 1.0)
    points = round(MAX_POINTS * (1 - fraction / 2)) if correct else 0
    record = GameAnswer(player_id=player.id, question_index=session.current_index, choices=picked, correct=correct, points=points)
    player.score += points
    db.add(record)
    try:
        db.commit()
    except IntegrityError as exc:
        # A double-tap that raced past my_answer() above.
        db.rollback()
        raise GameError("You've already answered this one") from exc
    _advance_if_due(db, session)
    return record


BINGO_LINES = (
    [[r * 5 + c for c in range(5)] for r in range(5)]
    + [[r * 5 + c for r in range(5)] for c in range(5)]
    + [[i * 6 for i in range(5)], [i * 4 + 4 for i in range(5)]]
)


def winning_line(card: list[str], called: list[str]) -> list[int] | None:
    called_set = set(called) | {BINGO_FREE}
    for line in BINGO_LINES:
        if all(card[i] in called_set for i in line):
            return line
    return None


def claim_bingo(db: Session, player: GamePlayer) -> list[int]:
    session = player.session
    if session.kind != GameKind.bingo or session.status != GameSessionStatus.playing:
        raise GameError("Bingo isn't running right now")
    if not player.card:
        raise GameError("You don't have a card")
    line = winning_line(player.card, session.called)
    if not line:
        raise GameError("Not a bingo yet — you need a full row, column or diagonal of called terms")
    if not player.bingo_at:
        player.bingo_at = _now()
        db.commit()
    return line
