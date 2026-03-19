import os

from dotenv import load_dotenv
from sqlalchemy import create_engine
from sqlalchemy.orm import DeclarativeBase, sessionmaker

load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL")


def _resolve_database_url(url: str | None) -> str:
    if not url:
        raise RuntimeError("DATABASE_URL is not set")

    # On Windows psycopg (v3) may require extra libpq runtime; fallback to psycopg2.
    if url.startswith("postgresql+psycopg://"):
        try:
            import psycopg  # noqa: F401
        except Exception:
            return url.replace("postgresql+psycopg://", "postgresql+psycopg2://", 1)

    return url


engine = create_engine(_resolve_database_url(DATABASE_URL), echo=True)

SessionLocal = sessionmaker(bind=engine)


class Base(DeclarativeBase):
    pass


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()