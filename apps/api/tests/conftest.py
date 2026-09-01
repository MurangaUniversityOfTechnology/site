import os
from pathlib import Path

import pytest

_pg_container = None


def pytest_configure(config):
    """Runs before test collection/import. Several app modules bind
    get_settings() at import time (core/db.py's engine, services/mpesa.py,
    services/membership.py, services/github.py, routers/auth.py), and
    Settings.database_url/secret_key are required with no default — so env
    vars must exist before the FIRST `app.*` import anywhere in the process.
    A fixture would run too late; this hook is the only reliable place."""
    global _pg_container
    # testcontainers.postgres is deprecated in the installed version — this
    # is the same API under the current import path.
    from testcontainers.community.postgres import PostgresContainer

    _pg_container = PostgresContainer("postgres:16-alpine", driver="psycopg")
    _pg_container.start()

    os.environ["DATABASE_URL"] = _pg_container.get_connection_url()
    os.environ.setdefault("SECRET_KEY", "test-secret-key-do-not-use-in-prod")
    # A real Fernet key (must decode as one — signature tests round-trip a
    # real encrypt/decrypt through it), not just an arbitrary string.
    os.environ.setdefault("SIGNATURE_ENCRYPTION_KEY", "DPmgEHgzhur5ujRgUaHDC05SxuS7AvzYoGdCXm8vBSA=")
    os.environ.setdefault("WEB_ORIGIN", "http://testserver")
    # Not "test" — _set_session_cookie() sets Secure=True for anything other
    # than "development", and TestClient's transport is plain HTTP (matches
    # real local dev, not a TLS-terminated deploy), so a Secure cookie
    # correctly never gets sent back and every authenticated request 401s.
    os.environ.setdefault("ENVIRONMENT", "development")
    # maybe_invite_to_org no-ops unless both of these are non-empty — the
    # idempotency/wiring tests need the guard to pass through to the (mocked)
    # HTTP call, not short-circuit before it.
    os.environ.setdefault("GITHUB_ORG", "mut-tech-test-org")
    os.environ.setdefault("GITHUB_SYNC_TOKEN", "test-gh-token")
    # initiate_stk_push() raises before making any HTTP call at all if this
    # is unset — required even though the call itself gets mocked.
    os.environ.setdefault("MPESA_CALLBACK_BASE_URL", "http://testserver")
    os.environ.setdefault("MPESA_SHORTCODE", "174379")
    os.environ.setdefault("MPESA_PASSKEY", "test-passkey")
    os.environ.setdefault("MPESA_CONSUMER_KEY", "test-consumer-key")
    os.environ.setdefault("MPESA_CONSUMER_SECRET", "test-consumer-secret")

    from alembic import command
    from alembic.config import Config

    api_root = Path(__file__).resolve().parent.parent
    cfg = Config(str(api_root / "alembic.ini"))
    cfg.set_main_option("script_location", str(api_root / "migrations"))
    cfg.set_main_option("sqlalchemy.url", os.environ["DATABASE_URL"])
    command.upgrade(cfg, "head")


def pytest_unconfigure(config):
    if _pg_container is not None:
        _pg_container.stop()


@pytest.fixture(scope="session")
def db_engine():
    # Imported lazily — by fixture-execution time pytest_configure has
    # already run, so core/db.py's module-level engine binds to the
    # testcontainer URL rather than whatever's in a local .env.
    from app.core.db import engine

    yield engine
    engine.dispose()


@pytest.fixture
def db_session(db_engine):
    """One test = one outer transaction, rolled back at teardown. App code's
    own db.commit() calls only commit a SAVEPOINT, not the outer transaction,
    via join_transaction_mode='create_savepoint' (SQLAlchemy 2.0+)."""
    from sqlalchemy.orm import sessionmaker

    connection = db_engine.connect()
    trans = connection.begin()
    SessionLocal = sessionmaker(bind=connection, join_transaction_mode="create_savepoint")
    session = SessionLocal()
    try:
        yield session
    finally:
        session.close()
        trans.rollback()
        connection.close()


@pytest.fixture(autouse=True)
def _reset_rate_limits():
    # slowapi's limiter storage is a process-wide singleton keyed by IP, and
    # every TestClient request appears to come from the same IP — without
    # this, any test using login_as() eats into every other test's login
    # rate budget for the rest of the session, in file/test order.
    from app.core.rate_limit import limiter

    limiter.reset()
    yield


@pytest.fixture
def client(db_session):
    """FastAPI TestClient with get_db overridden to hand out the same
    per-test transactional session the test's own assertions use."""
    from fastapi.testclient import TestClient

    from app.core.db import get_db
    from app.main import app

    def _override_get_db():
        yield db_session

    app.dependency_overrides[get_db] = _override_get_db
    with TestClient(app) as c:
        yield c
    app.dependency_overrides.clear()


@pytest.fixture
def make_user(db_session):
    """make_user(email=None, password="pw12345678", is_admin=False,
    membership_status=MembershipStatus.none, email_verified=True) -> User.
    Wraps the real auth_service.create_user() so Profile+Membership get
    created the same way production code creates them, then optionally
    fast-forwards membership status for tests that need an already-active/
    -expired member without walking the full payment flow.

    email_verified defaults to True (unlike create_user() itself, which
    defaults an email/password signup to False) — most tests using this
    fixture aren't testing the verify-email gate and shouldn't have to think
    about it; pass email_verified=False explicitly for tests that are."""
    from datetime import date, timedelta

    from app.models.membership import MembershipStatus
    from app.services.auth import create_user

    counter = {"n": 0}

    def _make(
        *,
        email=None,
        password="pw12345678",
        is_admin=False,
        membership_status=MembershipStatus.none,
        email_verified=True,
    ):
        counter["n"] += 1
        email = email or f"user{counter['n']}@example.com"
        user = create_user(db_session, email, password)
        user.email_verified = email_verified
        if is_admin:
            user.is_admin = True
        if membership_status != MembershipStatus.none:
            user.membership.status = membership_status
            if membership_status == MembershipStatus.active:
                # Mirrors services/membership.py's approve() exactly (naive
                # local date, not tz-aware — same as production).
                user.membership.period_start = date.today()  # noqa: DTZ011
                user.membership.period_end = date.today() + timedelta(days=365)  # noqa: DTZ011
        db_session.commit()
        db_session.refresh(user)
        return user

    return _make


@pytest.fixture
def login_as(client):
    """login_as(user, password="pw12345678") signs `client` in via the real
    /auth/login endpoint (rather than hand-crafting a cookie), so session
    correctness gets implicitly re-verified by every test that calls this."""

    def _login(user, password="pw12345678"):
        res = client.post("/auth/login", json={"email": user.email, "password": password})
        assert res.status_code == 200, res.text
        return client

    return _login
