from rapidfuzz.fuzz import ratio
from tavily import TavilyClient

from ..config import Settings
from ..domain import Capability, EdgeType, EntityMention, EvidenceBasis
from ..extraction import ClaudeExtractor
from .base import EdgeCandidate, ResolutionCandidate
from .cache import get_cached, set_cached


class TavilyProvider:
    name = "tavily"
    capabilities = {Capability.RESOLVE, Capability.TRADE, Capability.OWNERSHIP, Capability.NEWS}
    reliability = 0.4

    def __init__(self, settings: Settings, extractor: ClaudeExtractor, client=None):
        self.settings = settings
        self.extractor = extractor
        self.client = client or (
            TavilyClient(api_key=settings.tavily_api_key) if settings.tavily_api_key else None
        )

    def is_configured(self) -> bool:
        return self.client is not None

    def resolve(self, mention: EntityMention) -> list[ResolutionCandidate]:
        if not self.is_configured():
            return []
        query = f'"{mention.surface_text}" {mention.country or ""} company registration'.strip()
        response = self._search(query)
        candidates = []
        for result in response.get("results", []):
            title = (result.get("title") or "").strip()
            if not title:
                continue
            similarity = ratio(mention.surface_text.casefold(), title.casefold()) / 100
            confidence = min(
                0.49,
                round(similarity * float(result.get("score", 0.5)) * self.reliability, 3),
            )
            candidates.append(ResolutionCandidate(
                mention=mention.model_copy(update={"surface_text": title}),
                confidence=confidence,
                provider=self.name,
                source_ref=result.get("url", ""),
                snippet=" ".join((result.get("content") or "").split()[:24]),
            ))
        return sorted(candidates, key=lambda item: item.confidence, reverse=True)

    def neighbors(self, entity: EntityMention, kinds: set[EdgeType]) -> list[EdgeCandidate]:
        if not self.is_configured() or not kinds:
            return []
        queries = []
        if kinds & {EdgeType.SUPPLIES, EdgeType.BUYS_FROM}:
            queries.append((
                f'"{entity.surface_text}" supplier OR supplies OR "sourced from"',
                {EdgeType.SUPPLIES, EdgeType.BUYS_FROM},
            ))
            queries.append((
                f'"{entity.surface_text}" shipments importer exporter',
                {EdgeType.SUPPLIES, EdgeType.BUYS_FROM},
            ))
        if kinds & {EdgeType.OWNS, EdgeType.CONTROLS}:
            queries.append((
                f'"{entity.surface_text}" subsidiary OR "parent company" OR "owned by"',
                {EdgeType.OWNS, EdgeType.CONTROLS},
            ))
        if kinds & {EdgeType.SANCTIONED_BY}:
            queries.append((
                f'"{entity.surface_text}" sanctions OR "entity list"',
                {EdgeType.SANCTIONED_BY},
            ))
        candidates = []
        for query, permitted_types in queries:
            response = self._search(query)
            for result in response.get("results", []):
                page_text = result.get("raw_content") or result.get("content") or ""
                if not page_text:
                    continue
                relationships = self.extractor.extract_web_relationships(
                    entity.surface_text,
                    page_text,
                )
                for relationship in relationships:
                    if relationship.edge_type not in permitted_types:
                        continue
                    if relationship.source.casefold() != entity.surface_text.casefold():
                        continue
                    if relationship.target.casefold() == entity.surface_text.casefold():
                        continue
                    score = max(0.0, min(1.0, float(result.get("score", 0.4))))
                    candidates.append(EdgeCandidate(
                        target=EntityMention(surface_text=relationship.target),
                        edge_type=relationship.edge_type,
                        confidence=round(score * self.reliability, 3),
                        provider=self.name,
                        source_ref=result.get("url", ""),
                        snippet=" ".join(relationship.quote.split()[:24]),
                        basis=EvidenceBasis.WEB_INFERRED,
                    ))
        return candidates

    def _search(self, query: str) -> dict:
        request = {
            "query": query[:390],
            "search_depth": "advanced",
            "max_results": 5,
            "include_raw_content": "markdown",
        }
        cached = get_cached(self.name, request)
        if cached is not None:
            return cached
        response = self.client.search(**request)
        set_cached(self.name, request, response)
        return response
