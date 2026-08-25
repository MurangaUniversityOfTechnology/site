from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    # Core
    environment: str = "development"
    secret_key: str
    database_url: str
    web_origin: str = "http://localhost:3000"

    # Google OAuth
    google_client_id: str = ""
    google_client_secret: str = ""
    google_redirect_uri: str = ""

    # M-Pesa Daraja
    mpesa_env: str = "sandbox"  # sandbox | production
    mpesa_consumer_key: str = ""
    mpesa_consumer_secret: str = ""
    mpesa_shortcode: str = ""
    mpesa_passkey: str = ""
    mpesa_callback_base_url: str = ""
    mpesa_transaction_type: str = "CustomerPayBillOnline"  # or CustomerBuyGoodsOnline for a Till
    membership_fee_kes: int = 500

    @property
    def mpesa_base_url(self) -> str:
        return "https://api.safaricom.co.ke" if self.mpesa_env == "production" else "https://sandbox.safaricom.co.ke"

    # Email (Gmail SMTP)
    smtp_host: str = "smtp.gmail.com"
    smtp_port: int = 587
    smtp_username: str = ""
    smtp_password: str = ""  # Gmail App Password, not the account password
    email_from: str = "MUT Tech Community <noreply@example.com>"

    # GitHub
    github_client_id: str = ""
    github_client_secret: str = ""
    github_redirect_uri: str = ""
    github_sync_token: str = ""
    github_org: str = ""


@lru_cache
def get_settings() -> Settings:
    return Settings()
