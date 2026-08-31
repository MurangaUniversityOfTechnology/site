import httpx
import pytest
import respx


@pytest.fixture
def mock_mpesa_success():
    with respx.mock(assert_all_called=False) as m:
        m.get(url__regex=r".*/oauth/v1/generate").mock(
            return_value=httpx.Response(200, json={"access_token": "test-access-token"})
        )
        m.post(url__regex=r".*/mpesa/stkpush/v1/processrequest").mock(
            return_value=httpx.Response(
                200,
                json={
                    "MerchantRequestID": "mr-1",
                    "CheckoutRequestID": "ws_CO_1",
                    "ResponseCode": "0",
                    "ResponseDescription": "Success. Request accepted for processing",
                    "CustomerMessage": "Success. Request accepted for processing",
                },
            )
        )
        yield m


@pytest.fixture
def mock_github_invite_success():
    with respx.mock(assert_all_called=False) as m:
        m.post(url__regex=r".*/orgs/.*/invitations").mock(return_value=httpx.Response(201, json={"id": 1}))
        yield m


@pytest.fixture
def mock_email(monkeypatch):
    """Records every send_email(...) call instead of hitting real SMTP.
    Patched at the source module (app.services.email) rather than per-caller
    since every caller does `from app.services import email as email_service`
    and calls email_service.send_email(...) — an attribute lookup at call
    time, so patching the one shared module object covers all of them."""
    sent = []

    def _fake_send(*, to, subject, html, text=None, inline_images=None):
        sent.append({"to": to, "subject": subject, "html": html, "inline_images": inline_images})

    monkeypatch.setattr("app.services.email.send_email", _fake_send)
    return sent
