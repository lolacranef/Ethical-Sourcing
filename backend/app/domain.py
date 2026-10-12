from enum import StrEnum
from typing import Any

from pydantic import BaseModel, ConfigDict, Field


class EntityType(StrEnum):
    COMPANY = "company"
    PERSON = "person"
    VESSEL = "vessel"
    ADDRESS = "address"


class EdgeType(StrEnum):
    SUPPLIES = "SUPPLIES"
    BUYS_FROM = "BUYS_FROM"
    OWNS = "OWNS"
    CONTROLS = "CONTROLS"
    DIRECTOR_OF = "DIRECTOR_OF"
    SHARES_ADDRESS = "SHARES_ADDRESS"
    NAMED_TOGETHER = "NAMED_TOGETHER"
    SANCTIONED_BY = "SANCTIONED_BY"


class EvidenceBasis(StrEnum):
    DOCUMENT_STATED = "document_stated"
    REGISTRY = "registry"
    WEB_INFERRED = "web_inferred"


class Capability(StrEnum):
    RESOLVE = "resolve"
    OWNERSHIP = "ownership"
    TRADE = "trade"
    SANCTIONS = "sanctions"
    NEWS = "news"


class EntityMention(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    surface_text: str = Field(min_length=1)
    entity_type: EntityType = Field(default=EntityType.COMPANY, alias="type")
    country: str | None = None
    identifiers: dict[str, str | None] = Field(default_factory=dict)
    address: str | None = None
    role_in_document: str = ""
    page: int | None = None
    char_start: int | None = None
    char_end: int | None = None


class RelationshipMention(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    source: str
    target: str
    edge_type: EdgeType = Field(alias="type")
    quote: str = Field(min_length=1)
    page: int | None = None


class ExtractedDocument(BaseModel):
    entities: list[EntityMention] = Field(default_factory=list)
    relationships: list[RelationshipMention] = Field(default_factory=list)
    goods: list[dict[str, Any]] = Field(default_factory=list)


class ScoreInput(BaseModel):
    named_in_document: bool = False
    tier: int = Field(ge=0)
    sanctions_hit: bool = False
    linked_to_flagged_entity: bool = False
    high_risk_sector_or_region: bool = False
    shell_pattern: bool = False
    path_confidence: float = Field(default=1.0, ge=0, le=1)


class ScoreResult(BaseModel):
    priority_score: float = Field(ge=0, le=100)
    factors: dict[str, float]
    path_confidence: float