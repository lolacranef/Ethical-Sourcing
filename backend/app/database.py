from pathlib import Path

from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker

from .config import get_settings
from .models import Base


def make_engine(database_url: str | None = None):
    url = database_url or get_settings().database_url
    if url.startswith("sqlite:///") and url != "sqlite:///:memory:":
        database_path = Path(url.removeprefix("sqlite:///"))
        database_path.parent.mkdir(parents=True, exist_ok=True)
    options = {"check_same_thread": False} if url.startswith("sqlite") else {}
    return create_engine(url, connect_args=options, future=True)


engine = make_engine()
SessionLocal = sessionmaker(bind=engine, autoflush=False, expire_on_commit=False)


def initialize_database() -> None:
    Base.metadata.create_all(bind=engine)


def get_session():
    session: Session = SessionLocal()
    try:
        yield session
    finally:
        session.close()