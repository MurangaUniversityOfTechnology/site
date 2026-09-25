from datetime import timedelta

import pytest
from fastapi.testclient import TestClient

from app.models.game import GameSession
from app.models.membership import MembershipStatus
from app.services import games as game_service

pytestmark = pytest.mark.integration

QUESTIONS = [
    {"prompt": "What does `git clone` do?", "choices": ["Copies a repo", "Deletes a repo"], "correct": [0], "time_limit": 20},
    {
        "prompt": "Which are version control systems?",
        "choices": ["Git", "Mercurial", "Docker", "Postgres"],
        "correct": [0, 1],
        "time_limit": 20,
    },
]
TERMS = [f"term {i}" for i in range(30)]


@pytest.fixture
def host(make_user, login_as):
    user = make_user(is_staff=True, membership_status=MembershipStatus.active)
    login_as(user)
    return user


@pytest.fixture
def guest_client(client):
    # Same app (and so the same get_db override) as `client`, but its own
    # cookie jar — i.e. a phone that has never signed in.
    with TestClient(client.app) as c:
        yield c


def _quiz_session(client):
    quiz = client.post("/admin/games/quizzes", json={"title": "Git warm-up", "questions": QUESTIONS})
    assert quiz.status_code == 201, quiz.text
    session = client.post("/admin/games/sessions", json={"quiz_id": quiz.json()["id"]})
    assert session.status_code == 201, session.text
    return session.json()


def _join(guest_client, pin, nickname):
    res = guest_client.post("/games/join", json={"pin": pin, "nickname": nickname})
    assert res.status_code == 200, res.text
    return {"X-Game-Token": res.json()["token"]}


# ── access ───────────────────────────────────────────────────────────────


def test_admin_game_routes_reject_non_staff(client, make_user, login_as):
    login_as(make_user(membership_status=MembershipStatus.active))
    assert client.get("/admin/games/quizzes").status_code == 403
    assert client.post("/admin/games/sessions", json={}).status_code == 403


def test_join_unknown_pin_404s(guest_client):
    assert guest_client.post("/games/join", json={"pin": "000000", "nickname": "x"}).status_code == 404


def test_state_requires_a_valid_token(client, host, guest_client):
    session = _quiz_session(client)
    assert guest_client.get(f"/games/{session['pin']}/state").status_code == 404
    assert guest_client.get(f"/games/{session['pin']}/state", headers={"X-Game-Token": "nope"}).status_code == 404


# ── content validation ───────────────────────────────────────────────────


@pytest.mark.parametrize(
    "question",
    [
        {"prompt": "", "choices": ["a", "b"], "correct": [0]},
        {"prompt": "q", "choices": ["a"], "correct": [0]},
        {"prompt": "q", "choices": ["a", "b"], "correct": []},
        {"prompt": "q", "choices": ["a", "b"], "correct": [0, 1]},
        {"prompt": "q", "choices": ["a", "b"], "correct": [5]},
    ],
)
def test_quiz_rejects_bad_questions(client, host, question):
    res = client.post("/admin/games/quizzes", json={"title": "Bad", "questions": [question]})
    assert res.status_code == 400


def test_deck_needs_24_distinct_terms(client, host):
    res = client.post("/admin/games/decks", json={"title": "Small", "terms": ["API"] * 30 + ["x"] * 5})
    assert res.status_code == 400
    assert client.post("/admin/games/decks", json={"title": "OK", "terms": TERMS}).status_code == 201


# ── quiz flow ────────────────────────────────────────────────────────────


def test_full_quiz_flow(client, host, guest_client, db_session):
    session = _quiz_session(client)
    pin, sid = session["pin"], session["id"]
    assert len(pin) == 6 and session["status"] == "lobby"

    alice = _join(guest_client, pin, "Alice")
    bob = _join(guest_client, pin, "Bob")
    assert guest_client.post("/games/join", json={"pin": pin, "nickname": "alice"}).status_code == 400  # taken

    # Q1 opens
    state = client.post(f"/admin/games/sessions/{sid}/advance").json()
    assert state["status"] == "question" and state["question_number"] == 1

    player = guest_client.get(f"/games/{pin}/state", headers=alice).json()
    assert player["question"]["prompt"] == QUESTIONS[0]["prompt"]
    assert player["correct"] is None  # not revealed yet

    res = guest_client.post(f"/games/{pin}/answer", json={"choices": [0]}, headers=alice)
    assert res.status_code == 200
    assert res.json()["my_answer"]["correct"] is None  # still hidden until reveal
    assert guest_client.post(f"/games/{pin}/answer", json={"choices": [1]}, headers=alice).status_code == 400  # no re-answer

    guest_client.post(f"/games/{pin}/answer", json={"choices": [1]}, headers=bob)
    # everyone answered → reveals itself without the host pressing anything
    host_state = client.get(f"/admin/games/sessions/{sid}").json()
    assert host_state["status"] == "reveal"
    assert host_state["choice_counts"] == [1, 1]

    alice_state = guest_client.get(f"/games/{pin}/state", headers=alice).json()
    assert alice_state["my_answer"]["correct"] is True
    assert 500 <= alice_state["score"] <= 1000
    assert alice_state["rank"] == 1
    assert alice_state["correct"] == [0]
    assert guest_client.get(f"/games/{pin}/state", headers=bob).json()["score"] == 0

    # Q2 — multi-select: must match the full set
    client.post(f"/admin/games/sessions/{sid}/advance")
    assert guest_client.get(f"/games/{pin}/state", headers=alice).json()["question"]["multi"] is True
    guest_client.post(f"/games/{pin}/answer", json={"choices": [0]}, headers=alice)
    guest_client.post(f"/games/{pin}/answer", json={"choices": [1, 0]}, headers=bob)
    bob_state = guest_client.get(f"/games/{pin}/state", headers=bob).json()
    assert bob_state["my_answer"]["correct"] is True

    final = client.post(f"/admin/games/sessions/{sid}/advance").json()
    assert final["status"] == "finished"
    scores = [p["score"] for p in final["players"]]
    assert scores == sorted(scores, reverse=True) and all(s >= 500 for s in scores)


def test_single_answer_question_rejects_multiple_picks(client, host, guest_client):
    session = _quiz_session(client)
    alice = _join(guest_client, session["pin"], "Alice")
    client.post(f"/admin/games/sessions/{session['id']}/advance")
    res = guest_client.post(f"/games/{session['pin']}/answer", json={"choices": [0, 1]}, headers=alice)
    assert res.status_code == 400


def test_timer_closes_the_question(client, host, guest_client, db_session):
    session = _quiz_session(client)
    alice = _join(guest_client, session["pin"], "Alice")
    _join(guest_client, session["pin"], "Bob")
    client.post(f"/admin/games/sessions/{session['id']}/advance")

    row = db_session.get(GameSession, session["id"])
    row.question_started_at -= timedelta(seconds=30)
    db_session.commit()

    assert guest_client.post(f"/games/{session['pin']}/answer", json={"choices": [0]}, headers=alice).status_code == 400
    assert client.get(f"/admin/games/sessions/{session['id']}").json()["status"] == "reveal"


def test_faster_correct_answers_score_more(client, host, guest_client, db_session):
    session = _quiz_session(client)
    fast = _join(guest_client, session["pin"], "Fast")
    slow = _join(guest_client, session["pin"], "Slow")
    _join(guest_client, session["pin"], "Idle")  # keeps the question open
    client.post(f"/admin/games/sessions/{session['id']}/advance")
    guest_client.post(f"/games/{session['pin']}/answer", json={"choices": [0]}, headers=fast)

    row = db_session.get(GameSession, session["id"])
    row.question_started_at -= timedelta(seconds=15)
    db_session.commit()
    guest_client.post(f"/games/{session['pin']}/answer", json={"choices": [0]}, headers=slow)

    client.post(f"/admin/games/sessions/{session['id']}/advance")  # reveal
    fast_score = guest_client.get(f"/games/{session['pin']}/state", headers=fast).json()["score"]
    slow_score = guest_client.get(f"/games/{session['pin']}/state", headers=slow).json()["score"]
    assert fast_score > slow_score >= 500


def test_signed_in_user_rejoins_as_the_same_player(client, host, make_user):
    session = _quiz_session(client)
    member = make_user()
    with TestClient(client.app) as phone:
        phone.post("/auth/login", json={"email": member.email, "password": "pw12345678"})
        first = phone.post("/games/join", json={"pin": session["pin"]}).json()
        second = phone.post("/games/join", json={"pin": session["pin"]}).json()
    assert first["nickname"] == second["nickname"]
    assert len(client.get(f"/admin/games/sessions/{session['id']}").json()["players"]) == 1
    # the old token is replaced, not both valid
    assert first["token"] != second["token"]


def test_kicked_player_is_locked_out(client, host, guest_client):
    session = _quiz_session(client)
    rude = _join(guest_client, session["pin"], "RudeName")
    player_id = client.get(f"/admin/games/sessions/{session['id']}").json()["players"][0]["id"]
    res = client.post(f"/admin/games/sessions/{session['id']}/players/{player_id}/kick")
    assert res.json()["players"] == []
    assert guest_client.get(f"/games/{session['pin']}/state", headers=rude).status_code == 400


def test_finished_game_pin_stops_working(client, host, guest_client):
    session = _quiz_session(client)
    client.post(f"/admin/games/sessions/{session['id']}/end")
    assert guest_client.post("/games/join", json={"pin": session["pin"], "nickname": "Late"}).status_code == 404


# ── bingo ────────────────────────────────────────────────────────────────


def _bingo_session(client):
    deck = client.post("/admin/games/decks", json={"title": "Tech bingo", "terms": TERMS}).json()
    return client.post("/admin/games/sessions", json={"deck_id": deck["id"]}).json()


def test_bingo_card_is_dealt_from_the_deck(client, host, guest_client):
    session = _bingo_session(client)
    token = _join(guest_client, session["pin"], "Alice")
    card = guest_client.get(f"/games/{session['pin']}/state", headers=token).json()["card"]
    assert len(card) == 25 and card[12] == "FREE"
    assert len(set(card)) == 25 and set(card) - {"FREE"} <= set(TERMS)


def test_bingo_claims_are_checked_against_called_terms(client, host, guest_client, db_session):
    session = _bingo_session(client)
    token = _join(guest_client, session["pin"], "Alice")
    client.post(f"/admin/games/sessions/{session['id']}/advance")  # lobby → playing
    assert guest_client.post(f"/games/{session['pin']}/bingo", headers=token).status_code == 400

    card = guest_client.get(f"/games/{session['pin']}/state", headers=token).json()["card"]
    # Force-call the top row rather than pressing "call" until it happens.
    row = db_session.get(GameSession, session["id"])
    row.called = card[:5]
    db_session.commit()

    res = guest_client.post(f"/games/{session['pin']}/bingo", headers=token)
    assert res.status_code == 200
    assert res.json()["line"] == [0, 1, 2, 3, 4]
    assert client.get(f"/admin/games/sessions/{session['id']}").json()["winners"] == ["Alice"]


def test_calling_terms_never_repeats(client, host):
    session = _bingo_session(client)
    client.post(f"/admin/games/sessions/{session['id']}/advance")
    for _ in TERMS:
        state = client.post(f"/admin/games/sessions/{session['id']}/advance").json()
    assert sorted(state["called"]) == sorted(TERMS) and state["terms_left"] == 0
    assert client.post(f"/admin/games/sessions/{session['id']}/advance").status_code == 400


def test_winning_line_uses_the_free_centre():
    card = [f"t{i}" for i in range(25)]
    card[12] = game_service.BINGO_FREE
    middle_row = [card[i] for i in (10, 11, 13, 14)]
    assert game_service.winning_line(card, middle_row) == [10, 11, 12, 13, 14]
    assert game_service.winning_line(card, middle_row[:3]) is None
