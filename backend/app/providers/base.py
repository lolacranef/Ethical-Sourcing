from dataclasses import dataclass
from typing import Protocol

from ..domain import Capability, EdgeType, EntityMention, EvidenceBasis


@dataclass
class ResolutionCandidate:
    mention: EntityMention
    confidence: float
    provider: str
    source_ref: str = ""
    snippet: str = ""


@dataclass
class EdgeCandidate:
    target: EntityMention
    edge_type: EdgeType
    confidence: float
    provider: str
    source_ref: str
    snippet: str
    basis: EvidenceBasis = EvidenceBasis.WEB_INFERRED


class DataProvider(Protocol):
    name: str
    capabilities: set[Capability]
    reliability: float

    def is_configured(self) -> bool: ...

    def resolve(self, mention: EntityMention) -> list[ResolutionCandidate]: ...

    def neighbors(self, entity: EntityMention, kinds: set[EdgeType]) -> list[EdgeCandidate]: ...
