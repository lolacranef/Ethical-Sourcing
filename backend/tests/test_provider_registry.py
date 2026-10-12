from app.domain import Capability, EntityMention
from app.providers.base import ResolutionCandidate
from app.providers.registry import ProviderRegistry
from app.providers.sayari import SayariProvider


class FakeProvider:
    capabilities = {Capability.RESOLVE}

    def __init__(self, name, reliability, confidence):
        self.name = name
        self.reliability = reliability
        self.confidence = confidence

    def is_configured(self):
        return True

    def resolve(self, mention):
        return [ResolutionCandidate(mention, self.confidence, self.name)]

    def neighbors(self, entity, kinds):
        return []


def test_registry_merges_and_ranks_all_capable_provider_candidates():
    registry = ProviderRegistry([
        FakeProvider("low", 0.2, 0.2),
        FakeProvider("high", 0.9, 0.9),
    ])

    candidates = registry.resolve(EntityMention(surface_text="Northstar Textiles"))

    assert [candidate.provider for candidate in candidates] == ["high", "low"]
    assert registry.configured_for(Capability.RESOLVE)[0].name == "high"


def test_sayari_credentials_do_not_enable_unverified_adapter():
    assert SayariProvider("client-id", "client-secret").is_configured() is False