import logging

from ..config import Settings
from ..domain import Capability, EdgeType, EntityMention
from ..extraction import ClaudeExtractor
from .base import DataProvider, EdgeCandidate, ResolutionCandidate
from .sayari import SayariProvider
from .tavily import TavilyProvider
from .tradeverifyd import TradeverifydProvider

logger = logging.getLogger(__name__)


class ProviderRegistry:
    def __init__(self, providers: list[DataProvider]):
        self.providers = providers
        active = [provider.name for provider in providers if provider.is_configured()]
        inactive = [provider.name for provider in providers if not provider.is_configured()]
        logger.info(
            "Providers active: %s | inactive: %s",
            ", ".join(active) or "none",
            ", ".join(inactive) or "none",
        )

    def configured_for(self, capability: Capability) -> list[DataProvider]:
        return sorted(
            (
                provider for provider in self.providers
                if provider.is_configured() and capability in provider.capabilities
            ),
            key=lambda provider: provider.reliability,
            reverse=True,
        )

    def resolve(self, mention: EntityMention) -> list[ResolutionCandidate]:
        candidates = []
        for provider in self.configured_for(Capability.RESOLVE):
            candidates.extend(provider.resolve(mention))
        return sorted(candidates, key=lambda candidate: candidate.confidence, reverse=True)

    def neighbors(self, entity: EntityMention, kinds: set[EdgeType]) -> list[EdgeCandidate]:
        needed = set()
        if kinds & {EdgeType.SUPPLIES, EdgeType.BUYS_FROM}:
            needed.add(Capability.TRADE)
        if kinds & {EdgeType.OWNS, EdgeType.CONTROLS}:
            needed.add(Capability.OWNERSHIP)
        if EdgeType.SANCTIONED_BY in kinds:
            needed.update({Capability.SANCTIONS, Capability.NEWS})
        selected = {
            provider.name: provider
            for capability in needed
            for provider in self.configured_for(capability)
        }
        candidates = []
        for provider in sorted(selected.values(), key=lambda item: item.reliability, reverse=True):
            candidates.extend(provider.neighbors(entity, kinds))
        return candidates

    def status(self) -> dict[str, list[str]]:
        return {
            "active": [provider.name for provider in self.providers if provider.is_configured()],
            "inactive": [provider.name for provider in self.providers if not provider.is_configured()],
        }


def build_registry(settings: Settings, extractor: ClaudeExtractor) -> ProviderRegistry:
    return ProviderRegistry([
        TavilyProvider(settings, extractor),
        SayariProvider(settings.sayari_client_id, settings.sayari_client_secret),
        TradeverifydProvider(settings.tradeverifyd_api_key),
    ])
