import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.db import get_db
from app.core.deps import require_staff
from app.models.game import (
    BingoDeck,
    GameKind,
    GameQuiz,
    GameSession,
    GameSessionStatus,
)
from app.models.user import User
from app.schemas.game import (
    DeckDetail,
    DeckRow,
    DeckWriteRequest,
    HostPlayer,
    HostState,
    LiveSessionRow,
    QuizDetail,
    QuizQuestion,
    QuizRow,
    QuizWriteRequest,
    SessionCreateRequest,
)
from app.services import games as game_service

router = APIRouter(prefix="/admin/games", tags=["admin-games"], dependencies=[Depends(require_staff)])


# ── row shaping ──────────────────────────────────────────────────────────


def _quiz_row(quiz: GameQuiz) -> QuizRow:
    return QuizRow(
        id=quiz.id, title=quiz.title, description=quiz.description, question_count=len(quiz.questions), updated_at=quiz.updated_at
    )


def _quiz_detail(quiz: GameQuiz) -> QuizDetail:
    return QuizDetail(id=quiz.id, title=quiz.title, description=quiz.description, questions=quiz.questions)


def _deck_row(deck: BingoDeck) -> DeckRow:
    return DeckRow(id=deck.id, title=deck.title, term_count=len(deck.terms), updated_at=deck.updated_at)


def _host_state(db: Session, session: GameSession) -> HostState:
    question = game_service.current_question(session)
    answers = game_service.answers_for_current(db, session) if question else []
    answered_ids = {a.player_id for a in answers}
    choice_counts = None
    if question and session.status in (GameSessionStatus.reveal, GameSessionStatus.finished):
        choice_counts = [sum(1 for a in answers if i in a.choices) for i in range(len(question["choices"]))]
    return HostState(
        id=session.id,
        pin=session.pin,
        kind=session.kind.value,
        title=session.title,
        status=session.status.value,
        question_number=session.current_index + 1,
        question_count=len(session.content) if session.kind == GameKind.quiz else 0,
        question=QuizQuestion(**question) if question else None,
        seconds_left=game_service.seconds_left(session),
        answered_count=len(answers),
        choice_counts=choice_counts,
        called=session.called,
        terms_left=len(session.content) - len(session.called) if session.kind == GameKind.bingo else 0,
        winners=[p.nickname for p in game_service.bingo_winners(session)],
        players=[
            HostPlayer(id=p.id, nickname=p.nickname, score=p.score, answered=p.id in answered_ids, bingo_at=p.bingo_at)
            for p in game_service.leaderboard(session)
        ],
    )


# ── error mapping ────────────────────────────────────────────────────────


def _call(fn, *args, **kwargs):
    try:
        return fn(*args, **kwargs)
    except game_service.GameNotFound as exc:
        raise HTTPException(status.HTTP_404_NOT_FOUND, str(exc)) from exc
    except game_service.GameError as exc:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, str(exc)) from exc


# ── quizzes ──────────────────────────────────────────────────────────────


@router.get("/quizzes", response_model=list[QuizRow])
def list_quizzes(db: Session = Depends(get_db)):
    return [_quiz_row(q) for q in game_service.list_quizzes(db)]


@router.post("/quizzes", response_model=QuizDetail, status_code=status.HTTP_201_CREATED)
def create_quiz(payload: QuizWriteRequest, admin: User = Depends(require_staff), db: Session = Depends(get_db)):
    fields = payload.model_dump()
    return _quiz_detail(_call(game_service.save_quiz, db, admin, None, **fields))


@router.get("/quizzes/{quiz_id}", response_model=QuizDetail)
def get_quiz(quiz_id: uuid.UUID, db: Session = Depends(get_db)):
    return _quiz_detail(_call(game_service.get_quiz, db, quiz_id))


@router.put("/quizzes/{quiz_id}", response_model=QuizDetail)
def update_quiz(quiz_id: uuid.UUID, payload: QuizWriteRequest, admin: User = Depends(require_staff), db: Session = Depends(get_db)):
    quiz = _call(game_service.get_quiz, db, quiz_id)
    return _quiz_detail(_call(game_service.save_quiz, db, admin, quiz, **payload.model_dump()))


@router.delete("/quizzes/{quiz_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_quiz(quiz_id: uuid.UUID, admin: User = Depends(require_staff), db: Session = Depends(get_db)):
    game_service.delete_quiz(db, admin, _call(game_service.get_quiz, db, quiz_id))


# ── bingo decks ──────────────────────────────────────────────────────────


@router.get("/decks", response_model=list[DeckRow])
def list_decks(db: Session = Depends(get_db)):
    return [_deck_row(d) for d in game_service.list_decks(db)]


@router.post("/decks", response_model=DeckDetail, status_code=status.HTTP_201_CREATED)
def create_deck(payload: DeckWriteRequest, admin: User = Depends(require_staff), db: Session = Depends(get_db)):
    return DeckDetail.model_validate(_call(game_service.save_deck, db, admin, None, **payload.model_dump()), from_attributes=True)


@router.get("/decks/{deck_id}", response_model=DeckDetail)
def get_deck(deck_id: uuid.UUID, db: Session = Depends(get_db)):
    return DeckDetail.model_validate(_call(game_service.get_deck, db, deck_id), from_attributes=True)


@router.put("/decks/{deck_id}", response_model=DeckDetail)
def update_deck(deck_id: uuid.UUID, payload: DeckWriteRequest, admin: User = Depends(require_staff), db: Session = Depends(get_db)):
    deck = _call(game_service.get_deck, db, deck_id)
    return DeckDetail.model_validate(_call(game_service.save_deck, db, admin, deck, **payload.model_dump()), from_attributes=True)


@router.delete("/decks/{deck_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_deck(deck_id: uuid.UUID, admin: User = Depends(require_staff), db: Session = Depends(get_db)):
    game_service.delete_deck(db, admin, _call(game_service.get_deck, db, deck_id))


# ── hosting ──────────────────────────────────────────────────────────────


@router.get("/sessions", response_model=list[LiveSessionRow])
def list_live_sessions(db: Session = Depends(get_db)):
    return [
        LiveSessionRow(
            id=s.id,
            pin=s.pin,
            kind=s.kind.value,
            title=s.title,
            status=s.status.value,
            player_count=len(game_service.active_players(s)),
            created_at=s.created_at,
        )
        for s in game_service.list_live_sessions(db)
    ]


@router.post("/sessions", response_model=HostState, status_code=status.HTTP_201_CREATED)
def create_session(payload: SessionCreateRequest, host: User = Depends(require_staff), db: Session = Depends(get_db)):
    session = _call(game_service.create_session, db, host, quiz_id=payload.quiz_id, deck_id=payload.deck_id)
    return _host_state(db, session)


@router.get("/sessions/{session_id}", response_model=HostState)
def get_session(session_id: uuid.UUID, db: Session = Depends(get_db)):
    return _host_state(db, _call(game_service.get_session, db, session_id))


@router.post("/sessions/{session_id}/advance", response_model=HostState)
def advance(session_id: uuid.UUID, db: Session = Depends(get_db)):
    session = _call(game_service.get_session, db, session_id)
    return _host_state(db, _call(game_service.advance, db, session))


@router.post("/sessions/{session_id}/end", response_model=HostState)
def end_session(session_id: uuid.UUID, db: Session = Depends(get_db)):
    session = _call(game_service.get_session, db, session_id)
    return _host_state(db, game_service.end_session(db, session))


@router.post("/sessions/{session_id}/players/{player_id}/kick", response_model=HostState)
def kick_player(session_id: uuid.UUID, player_id: uuid.UUID, db: Session = Depends(get_db)):
    session = _call(game_service.get_session, db, session_id)
    _call(game_service.kick_player, db, session, player_id)
    return _host_state(db, session)
