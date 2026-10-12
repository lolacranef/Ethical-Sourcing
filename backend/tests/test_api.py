from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.database import get_session
from app.main import app
from app.models import Base


def test_health_and_document_upload_work_without_external_credentials(tmp_path, monkeypatch):
    engine = create_engine(f"sqlite:///{tmp_path / 'api-test.db'}", connect_args={"check_same_thread": False})
    Base.metadata.create_all(engine)
    sessions = sessionmaker(bind=engine, autoflush=False, expire_on_commit=False)

    def override_session():
        with sessions() as session:
            yield session

    app.dependency_overrides[get_session] = override_session
    monkeypatch.setattr("app.main.initialize_database", lambda: None)
    try:
        with TestClient(app) as client:
            health = client.get("/health")
            assert health.status_code == 200
            assert health.json()["providers"]["active"] == []
            upload = client.post(
                "/documents",
                files={"file": ("sample.txt", b"Sanctions notice naming Northstar Textiles.", "text/plain")},
            )
            assert upload.status_code == 201
            assert upload.json()["doc_type"] == "sanctions_notice"
            assert upload.json()["characters_extracted"] > 0
    finally:
        app.dependency_overrides.clear()
        engine.dispose()