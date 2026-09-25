from fastapi import APIRouter, Depends, Header, HTTPException, Request, status
from sqlalchemy.orm import Session

from app.core.db import get_db
from app.core.deps import get_current_user_optional
from app.core.rate_limit import limiter
from app.models.game import GameKind, GamePlayer, GameSessionStatus
from app.models.user import User
from app.schemas.game import (
    AnswerRequest,
    BingoClaimResponse,
    JoinRequest,
    JoinResponse,
    LeaderboardRow,
    PlayerAnswer,
    PlayerQuestion,
    PlayerState,
)
from app.services import games as game_service

router = APIRouter(prefix="/games", tags=["games"])

# Guests have no session cookie, so every player call carries the token
# /games/join handed out instead.
TOKEN_HEADER = "X-Game-Token"


def _call(fn, *args, **kwargs):
    try:
        return fn(*args, **kwargs)
    except game_service.GameNotFound as exc:
        raise HTTPException(status.HTTP_404_NOT_FOUND, str(exc)) from exc
    except game_service.GameError as exc:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, str(exc)) from exc


def _player_state(db: Session, player: GamePlayer) -> PlayerState:
    session = player.session
    board = game_service.leaderboard(session)
    revealed = session.status in (GameSessionStatus.reveal, GameSessionStatus.finished)

    question = game_service.current_question(session)
    player_question = None
    if question and session.status != GameSessionStatus.finished:
        player_question = PlayerQuestion(
            number=session.current_index + 1,
            count=len(session.content),
            prompt=question["prompt"],
            choices=question["choices"],
            multi=len(question["correct"]) > 1,
            time_limit=question["time_limit"],
        )

    my_answer = None
    if question:
        record = game_service.my_answer(db, player)
        if record:
            my_answer = PlayerAnswer(
                choices=record.choices,
                correct=record.correct if revealed else None,
                points=record.points if revealed else None,
            )

    return PlayerState(
        pin=session.pin,
        kind=session.kind.value,
        title=session.title,
        status=session.status.value,
        nickname=player.nickname,
        score=player.score,
        rank=next((i for i, p in enumerate(board, start=1) if p.id == player.id), len(board)),
        player_count=len(board),
        question=player_question,
        seconds_left=game_service.seconds_left(session),
        my_answer=my_answer,
        correct=question["correct"] if question and revealed else None,
        leaderboard=[LeaderboardRow(nickname=p.nickname, score=p.score) for p in board[:5]] if revealed else [],
        card=player.card,
        called=session.called if session.kind == GameKind.bingo else [],
        winners=[p.nickname for p in game_service.bingo_winners(session)],
        has_bingo=player.bingo_at is not None,
    )


@router.post("/join", response_model=JoinResponse)
# Generous on purpose: a whole onsite room joins at once, usually from
# behind the same campus wifi address.
@limiter.limit("120/minute")
def join(
    request: Request,
    payload: JoinRequest,
    user: User | None = Depends(get_current_user_optional),
    db: Session = Depends(get_db),
):
    player, token = _call(game_service.join, db, payload.pin, payload.nickname, user)
    return JoinResponse(token=token, pin=player.session.pin, kind=player.session.kind.value, nickname=player.nickname)


@router.get("/{pin}/state", response_model=PlayerState)
def state(pin: str, token: str | None = Header(default=None, alias=TOKEN_HEADER), db: Session = Depends(get_db)):
    return _player_state(db, _call(game_service.player_for_token, db, pin, token))


@router.post("/{pin}/answer", response_model=PlayerState)
def answer(
    pin: str,
    payload: AnswerRequest,
    token: str | None = Header(default=None, alias=TOKEN_HEADER),
    db: Session = Depends(get_db),
):
    player = _call(game_service.player_for_token, db, pin, token)
    _call(game_service.answer, db, player, payload.choices)
    return _player_state(db, player)


@router.post("/{pin}/bingo", response_model=BingoClaimResponse)
def claim_bingo(pin: str, token: str | None = Header(default=None, alias=TOKEN_HEADER), db: Session = Depends(get_db)):
    player = _call(game_service.player_for_token, db, pin, token)
    return BingoClaimResponse(line=_call(game_service.claim_bingo, db, player))
