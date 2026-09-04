import pytest
from fastapi import HTTPException

from app.core.config import get_settings
from app.core.deps import require_mpesa_ip

pytestmark = pytest.mark.unit


class _FakeClient:
    def __init__(self, host):
        self.host = host


class _FakeRequest:
    """require_mpesa_ip only ever touches request.client.host — a real
    Starlette Request isn't needed to exercise it as a unit."""

    def __init__(self, host):
        self.client = _FakeClient(host) if host is not None else None


@pytest.fixture
def production_env(monkeypatch):
    monkeypatch.setenv("ENVIRONMENT", "production")
    # Settings' _no_localhost_links_in_production validator rejects these
    # while ENVIRONMENT=production — conftest.py's test defaults point both
    # at http://testserver.
    monkeypatch.setenv("WEB_ORIGIN", "https://example.test")
    monkeypatch.setenv("API_BASE_URL", "https://api.example.test")
    get_settings.cache_clear()
    yield
    get_settings.cache_clear()


def test_allows_a_real_safaricom_ip(production_env):
    require_mpesa_ip(_FakeRequest("196.201.214.200"))  # does not raise


def test_rejects_an_unrecognized_ip(production_env):
    with pytest.raises(HTTPException) as exc_info:
        require_mpesa_ip(_FakeRequest("1.2.3.4"))
    assert exc_info.value.status_code == 403


def test_rejects_a_missing_client(production_env):
    with pytest.raises(HTTPException) as exc_info:
        require_mpesa_ip(_FakeRequest(None))
    assert exc_info.value.status_code == 403


def test_skips_the_check_in_development(monkeypatch):
    monkeypatch.setenv("ENVIRONMENT", "development")
    get_settings.cache_clear()
    try:
        require_mpesa_ip(_FakeRequest("1.2.3.4"))  # does not raise — dev bypass
    finally:
        get_settings.cache_clear()
