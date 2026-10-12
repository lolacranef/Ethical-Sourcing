from datetime import datetime, timezone
from uuid import uuid4

from sqlalchemy import Boolean, DateTime, Float, ForeignKey, Integer, JSON, String, Text
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


def new_id() -> str:
    return str(uuid4())


class Base(DeclarativeBase):
    pass


class Document(Base):
    __tablename__ = "documents"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_id)
    filename: Mapped[str] = mapped_column(String(255))
    doc_type: Mapped[str] = mapped_column(String(40), default="other")
    uploaded_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now)
    raw_text: Mapped[str] = mapped_column(Text)
    page_map_json: Mapped[list] = mapped_column(JSON, default=list)


class Entity(Base):
    __tablename__ = "entities"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_id)
    canonical_name: Mapped[str] = mapped_column(String(500), index=True)
    entity_type: Mapped[str] = mapped_column(String(30), default="company")
    country: Mapped[str | None] = mapped_column(String(120), nullable=True)
    identifiers_json: Mapped[dict] = mapped_column(JSON, default=dict)
    addresses_json: Mapped[list] = mapped_column(JSON, default=list)
    risk_flags_json: Mapped[list] = mapped_column(JSON, default=list)
    score_factors_json: Mapped[dict] = mapped_column(JSON, default=dict)
    resolution_status: Mapped[str] = mapped_column(String(30), default="unresolved")
    priority_score: Mapped[float] = mapped_column(Float, default=0)
    tier: Mapped[int] = mapped_column(Integer, default=0)
    is_seed: Mapped[bool] = mapped_column(Boolean, default=False)
    overflow_count: Mapped[int] = mapped_column(Integer, default=0)


class Mention(Base):
    __tablename__ = "mentions"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_id)
    document_id: Mapped[str] = mapped_column(ForeignKey("documents.id"), index=True)
    entity_id: Mapped[str | None] = mapped_column(ForeignKey("entities.id"), nullable=True)
    surface_text: Mapped[str] = mapped_column(String(500))
    page: Mapped[int | None] = mapped_column(Integer, nullable=True)
    char_start: Mapped[int | None] = mapped_column(Integer, nullable=True)
    char_end: Mapped[int | None] = mapped_column(Integer, nullable=True)
    extracted_attrs_json: Mapped[dict] = mapped_column(JSON, default=dict)
    resolution_confidence: Mapped[float | None] = mapped_column(Float, nullable=True)
    user_confirmed: Mapped[bool | None] = mapped_column(Boolean, nullable=True)


class Edge(Base):
    __tablename__ = "edges"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_id)
    source_entity_id: Mapped[str] = mapped_column(ForeignKey("entities.id"), index=True)
    target_entity_id: Mapped[str] = mapped_column(ForeignKey("entities.id"), index=True)
    investigation_id: Mapped[str | None] = mapped_column(ForeignKey("investigations.id"), nullable=True, index=True)
    edge_type: Mapped[str] = mapped_column(String(40))
    basis: Mapped[str] = mapped_column(String(30))
    confidence: Mapped[float] = mapped_column(Float)
    first_seen: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now)
    last_seen: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now)


class Evidence(Base):
    __tablename__ = "evidence"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_id)
    edge_id: Mapped[str | None] = mapped_column(ForeignKey("edges.id"), nullable=True, index=True)
    entity_id: Mapped[str | None] = mapped_column(ForeignKey("entities.id"), nullable=True, index=True)
    provider: Mapped[str] = mapped_column(String(80))
    source_ref: Mapped[str] = mapped_column(String(2000), default="")
    snippet: Mapped[str] = mapped_column(Text)
    retrieved_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now)


class Investigation(Base):
    __tablename__ = "investigations"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_id)
    document_id: Mapped[str] = mapped_column(ForeignKey("documents.id"), index=True)
    status: Mapped[str] = mapped_column(String(30), default="queued")
    progress: Mapped[int] = mapped_column(Integer, default=0)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now)
    params_json: Mapped[dict] = mapped_column(JSON, default=dict)
    error: Mapped[str | None] = mapped_column(Text, nullable=True)


class ProviderCache(Base):
    __tablename__ = "provider_cache"

    cache_key: Mapped[str] = mapped_column(String(64), primary_key=True)
    provider: Mapped[str] = mapped_column(String(80))
    response_json: Mapped[dict] = mapped_column(JSON)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))