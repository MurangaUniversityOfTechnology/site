from datetime import UTC, datetime, timedelta

import jwt
import pytest

from app.core.security import (
    MAX_PASSWORD_BYTES,
    create_session_token,
    decode_session_token,
    hash_password,
    settings,
    verify_password,
)

pytestmark = pytest.mark.unit


def test_hash_and_verify_round_trip():
    hashed = hash_password("correct horse battery staple")
    assert verify_password("correct horse battery staple", hashed) is True


def test_verify_rejects_wrong_password():
    hashed = hash_password("correct horse battery staple")
    assert verify_password("wrong password", hashed) is False


def test_hash_password_rejects_over_72_bytes():
    too_long = "x" * (MAX_PASSWORD_BYTES + 1)
    with pytest.raises(ValueError):
        hash_password(too_long)


def test_hash_password_accepts_exactly_72_bytes():
    exactly_72 = "x" * MAX_PASSWORD_BYTES
    hashed = hash_password(exactly_72)
    assert verify_password(exactly_72, hashed) is True


def test_verify_password_returns_false_not_exception_for_over_72_bytes():
    hashed = hash_password("some normal password")
    too_long = "x" * (MAX_PASSWORD_BYTES + 1)
    assert verify_password(too_long, hashed) is False


def test_session_token_round_trip():
    token = create_session_token("user-123")
    assert decode_session_token(token) == "user-123"


def test_decode_session_token_rejects_garbage():
    assert decode_session_token("not.a.jwt") is None


def test_decode_session_token_rejects_wrong_secret():
    token = jwt.encode(
        {"sub": "user-123", "exp": datetime.now(UTC) + timedelta(days=1)},
        "a-different-secret-that-is-long-enough-to-avoid-hmac-warnings",
        algorithm="HS256",
    )
    assert decode_session_token(token) is None


def test_decode_session_token_rejects_expired():
    token = jwt.encode(
        {"sub": "user-123", "exp": datetime.now(UTC) - timedelta(minutes=1)},
        settings.secret_key,
        algorithm="HS256",
    )
    assert decode_session_token(token) is None
