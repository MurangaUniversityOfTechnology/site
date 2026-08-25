import base64
import re
from datetime import datetime

import httpx

from app.core.config import get_settings

settings = get_settings()


class MpesaError(Exception):
    pass


def normalize_phone(phone: str) -> str:
    """Daraja requires 2547XXXXXXXX / 2541XXXXXXXX — no '+', no leading 0."""
    digits = re.sub(r"\D", "", phone)
    if digits.startswith("0"):
        digits = "254" + digits[1:]
    elif digits.startswith(("7", "1")):
        digits = "254" + digits
    if not re.fullmatch(r"254(7|1)\d{8}", digits):
        raise MpesaError(f"'{phone}' is not a valid Safaricom number")
    return digits


def _get_access_token() -> str:
    credentials = base64.b64encode(
        f"{settings.mpesa_consumer_key}:{settings.mpesa_consumer_secret}".encode()
    ).decode()
    res = httpx.get(
        f"{settings.mpesa_base_url}/oauth/v1/generate",
        params={"grant_type": "client_credentials"},
        headers={"Authorization": f"Basic {credentials}"},
        timeout=15,
    )
    res.raise_for_status()
    return res.json()["access_token"]


def initiate_stk_push(*, phone: str, amount: int, account_reference: str, transaction_desc: str) -> dict:
    """Returns the raw Daraja response, containing MerchantRequestID/CheckoutRequestID on success."""
    if not settings.mpesa_callback_base_url:
        raise MpesaError("MPESA_CALLBACK_BASE_URL is not configured")

    normalized_phone = normalize_phone(phone)
    # Naive local time on purpose, not UTC — Daraja's STK push expects the
    # server's own local timestamp here (it's hashed into Password below and
    # echoed back in the request), and every real Daraja integration example
    # uses naive local time for exactly this reason. Switching to UTC would
    # shift this by Kenya's +3 offset and risk failing Safaricom's own
    # timestamp validation on a path already verified against their sandbox.
    timestamp = datetime.now().strftime("%Y%m%d%H%M%S")  # noqa: DTZ005
    password = base64.b64encode(
        f"{settings.mpesa_shortcode}{settings.mpesa_passkey}{timestamp}".encode()
    ).decode()

    token = _get_access_token()
    res = httpx.post(
        f"{settings.mpesa_base_url}/mpesa/stkpush/v1/processrequest",
        headers={"Authorization": f"Bearer {token}"},
        json={
            "BusinessShortCode": settings.mpesa_shortcode,
            "Password": password,
            "Timestamp": timestamp,
            "TransactionType": settings.mpesa_transaction_type,
            "Amount": amount,
            "PartyA": normalized_phone,
            "PartyB": settings.mpesa_shortcode,
            "PhoneNumber": normalized_phone,
            "CallBackURL": f"{settings.mpesa_callback_base_url}/mpesa/callback",
            "AccountReference": account_reference,
            "TransactionDesc": transaction_desc,
        },
        timeout=20,
    )
    body = res.json()
    if res.status_code >= 400 or body.get("errorCode"):
        raise MpesaError(body.get("errorMessage", "STK push request failed"))
    return body


# ResultCode values Safaricom documents for the STK callback.
CANCELLED_RESULT_CODES = {1032}


def parse_stk_callback(payload: dict) -> dict:
    """
    Normalizes the Daraja STK callback body into
    {checkout_request_id, merchant_request_id, result_code, cancelled, amount, mpesa_receipt, phone}.
    """
    callback = payload["Body"]["stkCallback"]
    result_code = callback["ResultCode"]

    items = {}
    for item in callback.get("CallbackMetadata", {}).get("Item", []):
        items[item["Name"]] = item.get("Value")

    return {
        "checkout_request_id": callback["CheckoutRequestID"],
        "merchant_request_id": callback["MerchantRequestID"],
        "result_code": result_code,
        "result_desc": callback["ResultDesc"],
        "cancelled": result_code in CANCELLED_RESULT_CODES,
        "amount": items.get("Amount"),
        "mpesa_receipt": items.get("MpesaReceiptNumber"),
        "phone": items.get("PhoneNumber"),
    }
