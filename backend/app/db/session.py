from collections.abc import Generator
from sqlalchemy import create_engine
from sqlalchemy.engine import make_url
from sqlalchemy.orm import Session, sessionmaker
from app.core.config import get_settings


def make_engine(url: str | None = None):
    settings = get_settings()
    db_url = url or settings.database_url
    parsed = make_url(db_url)
    backend = parsed.get_backend_name()
    if backend == "sqlite":
        if settings.app_env.lower() != "test":
            raise ValueError("Conexão bloqueada: SQLite só pode ser utilizado em testes isolados.")
    elif backend != "postgresql" or parsed.database != "senso":
        raise ValueError("Conexão bloqueada: a API só aceita o banco PostgreSQL independente 'senso'.")
    options = {"check_same_thread": False} if db_url.startswith("sqlite") else {}
    return create_engine(db_url, connect_args=options, pool_pre_ping=True)


engine = make_engine()
SessionLocal = sessionmaker(bind=engine, autoflush=False, expire_on_commit=False)


def get_db() -> Generator[Session, None, None]:
    session = SessionLocal()
    try:
        yield session
    finally:
        session.close()
