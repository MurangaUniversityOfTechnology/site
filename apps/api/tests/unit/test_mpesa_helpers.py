import pytest

from app.services.mpesa import MpesaError, normalize_phone, parse_stk_callback

pytestmark = pytest.mark.unit


@pytest.mark.parametrize(
    "raw,expected",
    [
        ("0712345678", "254712345678"),
        ("+254712345678", "254712345678"),
        ("712345678", "254712345678"),
        ("0112345678", "254112345678"),
        ("0722 345 678", "254722345678"),
    ],
)
def test_normalize_phone_valid(raw, expected):
    assert normalize_phone(raw) == expected


@pytest.mark.parametrize("raw", ["12345", "+256712345678", "not a phone number"])
def test_normalize_phone_invalid(raw):
    with pytest.raises(MpesaError):
        normalize_phone(raw)


def _callback(result_code, result_desc="", items=None):
    body = {
        "MerchantRequestID": "mr-1",
        "CheckoutRequestID": "ws_CO_1",
        "ResultCode": result_code,
        "ResultDesc": result_desc,
    }
    if items is not None:
        body["CallbackMetadata"] = {"Item": items}
    return {"Body": {"stkCallback": body}}


def test_parse_stk_callback_success():
    payload = _callback(
        0,
        "The service request is processed successfully.",
        items=[
            {"Name": "Amount", "Value": 500.0},
            {"Name": "MpesaReceiptNumber", "Value": "NLJ7RT61SV"},
            {"Name": "TransactionDate", "Value": 20260101120000},
            {"Name": "PhoneNumber", "Value": 254712345678},
        ],
    )
    result = parse_stk_callback(payload)
    assert result["cancelled"] is False
    assert result["result_code"] == 0
    assert result["amount"] == 500.0
    assert result["mpesa_receipt"] == "NLJ7RT61SV"
    assert result["phone"] == 254712345678
    assert result["checkout_request_id"] == "ws_CO_1"


def test_parse_stk_callback_cancelled_has_no_callback_metadata_key():
    # Real Daraja cancelled payloads omit CallbackMetadata entirely — this
    # must not KeyError on the missing key.
    payload = _callback(1032, "Request cancelled by user")
    result = parse_stk_callback(payload)
    assert result["cancelled"] is True
    assert result["amount"] is None
    assert result["mpesa_receipt"] is None
    assert result["phone"] is None


def test_parse_stk_callback_generic_failure():
    payload = _callback(1, "The balance is insufficient for the transaction.")
    result = parse_stk_callback(payload)
    assert result["cancelled"] is False
    assert result["result_code"] == 1
    assert result["amount"] is None
