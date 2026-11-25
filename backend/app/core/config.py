from functools import lru_cache
from urllib.parse import urlsplit

from pydantic import Field, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict
from sqlalchemy.engine import make_url


class Settings(BaseSettings):
    database_url: str = "postgresql+psycopg://senso@localhost:5432/senso"
    secret_key: str = "senso-local-development-secret-change-before-sharing"
    cors_origins: str = "http://localhost:5174,http://127.0.0.1:5174,http://localhost:4173,http://127.0.0.1:4173"
    cookie_secure: bool = False
    app_env: str = "development"
    demo_login_enabled: bool = True
    cookie_name: str = "senso_session"
    simulation_interval_seconds: int = Field(default=1, ge=1, le=60)

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    @model_validator(mode="after")
    def isolate_database_and_secret(self):
        url = make_url(self.database_url)
        backend = url.get_backend_name()
        environment = self.app_env.lower()
        if backend == "sqlite":
            if environment != "test":
                raise ValueError("SQLite só pode ser utilizado em testes isolados; o Sistema Senso exige PostgreSQL.")
        elif backend != "postgresql" or url.database != "senso":
            raise ValueError("O Sistema Senso só pode conectar ao banco PostgreSQL independente 'senso'.")
        if environment not in {"development", "local", "test"}:
            secret_lower = self.secret_key.lower()
            placeholder_secret = any(
                marker in secret_lower
                for marker in ("development", "troque-por", "change-me", "changeme", "placeholder", "example")
            )
            if placeholder_secret or len(self.secret_key) < 32 or not self.cookie_secure:
                raise ValueError("Ambiente compartilhado exige SECRET_KEY próprio e COOKIE_SECURE=true")
            if (url.password or "").lower() in {"senso_dev", "postgres", "password", "change-me", "changeme"}:
                raise ValueError("Ambiente compartilhado exige senha exclusiva para o PostgreSQL.")
            if self.demo_login_enabled:
                raise ValueError("Ambiente compartilhado exige DEMO_LOGIN_ENABLED=false para proteger a conta demonstrativa compartilhada.")
            parsed_origins = [urlsplit(origin) for origin in self.origins]
            if not parsed_origins or any(
                origin.scheme != "https"
                or not origin.netloc
                or not origin.hostname
                or "*" in origin.netloc
                or origin.path
                or origin.query
                or origin.fragment
                or origin.username
                or origin.password
                for origin in parsed_origins
            ):
                raise ValueError("Ambientes compartilhados exigem CORS_ORIGINS com origens HTTPS explícitas e sem caminhos.")
        return self

    @property
    def origins(self) -> list[str]:
        return [origin.strip() for origin in self.cors_origins.split(",") if origin.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()
