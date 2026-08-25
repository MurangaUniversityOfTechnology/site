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
