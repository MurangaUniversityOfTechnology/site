import re

from mpesakit import MpesaClient
from mpesakit.errors import MpesaApiException
from pydantic import ValidationError

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


# mpesakit's TokenManager caches the OAuth token on the client instance and
# refreshes it only once it expires, so this is built once and reused across
# requests rather than per-call.
_client: MpesaClient | None = None


def _get_client() -> MpesaClient:
    global _client
    if _client is None:
        _client = MpesaClient(
            consumer_key=settings.mpesa_consumer_key,
            consumer_secret=settings.mpesa_consumer_secret,
            environment=settings.mpesa_env,
        )
    return _client


def initiate_stk_push(*, phone: str, amount: int, account_reference: str, transaction_desc: str) -> dict:
    """Returns {"CheckoutRequestID": ..., "MerchantRequestID": ...} on success."""
    if not settings.mpesa_callback_base_url:
        raise MpesaError("MPESA_CALLBACK_BASE_URL is not configured")

    normalized_phone = normalize_phone(phone)

    try:
        response = _get_client().stk_push(
            business_short_code=int(settings.mpesa_shortcode),
            passkey=settings.mpesa_passkey,
            transaction_type=settings.mpesa_transaction_type,
            amount=amount,
            party_a=normalized_phone,
            party_b=settings.mpesa_shortcode,
            phone_number=normalized_phone,
            callback_url=f"{settings.mpesa_callback_base_url}/mpesa/callback",
            account_reference=account_reference,
            transaction_desc=transaction_desc,
        )
    except MpesaApiException as exc:
        raise MpesaError(exc.error.error_message or "STK push request failed") from exc
    except ValidationError as exc:
        # Daraja returned its alternate top-level-error shape (e.g. a bad
        # shortcode/passkey) instead of the normal success schema — mpesakit
        # doesn't wrap that case in MpesaApiException, so translate it here.
        raise MpesaError("STK push request failed") from exc

    # StkPushSimulateResponse.is_successful is an unbound *method* reference,
    # not a property — `if response.is_successful:` is always truthy (a bound
    # method is never falsy). Check ResponseCode directly instead.
    if response.ResponseCode != 0:
        raise MpesaError(response.ResponseDescription or "STK push request failed")

    return {
        "CheckoutRequestID": response.CheckoutRequestID,
        "MerchantRequestID": response.MerchantRequestID,
    }


# ResultCode values Safaricom documents for the STK callback.
CANCELLED_RESULT_CODES = {1032}


def _metadata_value(stk_callback, name: str):
    if not stk_callback.CallbackMetadata:
        return None
    for item in stk_callback.CallbackMetadata.Item:
        if item.Name == name:
            return item.Value
    return None


def parse_stk_callback(payload: dict) -> dict:
    """
    Normalizes the Daraja STK callback body into
    {checkout_request_id, merchant_request_id, result_code, cancelled, amount, mpesa_receipt, phone}.
    """
    stk = _get_client().process_stk_callback(payload).Body.stkCallback

    return {
        "checkout_request_id": stk.CheckoutRequestID,
        "merchant_request_id": stk.MerchantRequestID,
        "result_code": stk.ResultCode,
        "result_desc": stk.ResultDesc,
        "cancelled": stk.ResultCode in CANCELLED_RESULT_CODES,
        "amount": _metadata_value(stk, "Amount"),
        "mpesa_receipt": _metadata_value(stk, "MpesaReceiptNumber"),
        "phone": _metadata_value(stk, "PhoneNumber"),
    }


def query_stk_status(checkout_request_id: str) -> dict | None:
    """
    Actively asks Safaricom for a still-pending push's real status — the
    fallback for when their result callback is dropped or delayed rather
    than a replacement for it (this has no CallbackMetadata, so a payment
    resolved this way won't have an mpesa_receipt until/unless the callback
    still arrives later and apply_stk_callback() backfills it).

    Returns None when the query was inconclusive (the transaction is still
    being processed, or the query request itself failed) — callers must
    treat that as "still pending, ask again later", never as a failure.
    """
    try:
        response = _get_client().stk_query(
            business_short_code=int(settings.mpesa_shortcode),
            passkey=settings.mpesa_passkey,
            checkout_request_id=checkout_request_id,
        )
    except (MpesaApiException, ValidationError):
        return None

    # ResultCode is typed int | str in mpesakit's schema — Safaricom doesn't
    # always send it as a JSON number, so this must be coerced before
    # comparing against CANCELLED_RESULT_CODES or checking for 0 (success).
    result_code = int(response.ResultCode)

    return {
        "checkout_request_id": response.CheckoutRequestID,
        "merchant_request_id": response.MerchantRequestID,
        "result_code": result_code,
        "result_desc": response.ResultDesc,
        "cancelled": result_code in CANCELLED_RESULT_CODES,
    }
