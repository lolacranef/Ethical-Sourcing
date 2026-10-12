from ..domain import Capability, EdgeType, EntityMention
from .base import ResolutionCandidate


class SayariProvider:
    name = "sayari"
    capabilities = {Capability.RESOLVE, Capability.OWNERSHIP, Capability.TRADE, Capability.SANCTIONS}
    reliability = 0.9

    def __init__(self, client_id: str | None, client_secret: str | None):
        self.client_id = client_id
        self.client_secret = client_secret

    def is_configured(self) -> bool:
        # TODO(sayari-docs): confirm API host, OAuth token URL, scopes, and response schema.
        # Credentials alone must not activate an adapter with unverified request contracts.
        return False

    def resolve(self, mention: EntityMention) -> list[ResolutionCandidate]:
        raise NotImplementedError("TODO(sayari-docs): implement after API documentation is available.")

    def neighbors(self, entity: EntityMention, kinds: set[EdgeType]):
        raise NotImplementedError("TODO(sayari-docs): implement after API documentation is available.")
