from ..domain import Capability, EdgeType, EntityMention


class TradeverifydProvider:
    name = "tradeverifyd"
    capabilities = {Capability.TRADE}
    reliability = 0.8

    def __init__(self, api_key: str | None):
        self.api_key = api_key

    def is_configured(self) -> bool:
        # TODO(tradeverifyd-docs): verify the API contract before enabling this adapter.
        return False

    def resolve(self, mention: EntityMention):
        raise NotImplementedError("TODO(tradeverifyd-docs): provider integration is not implemented.")

    def neighbors(self, entity: EntityMention, kinds: set[EdgeType]):
        raise NotImplementedError("TODO(tradeverifyd-docs): provider integration is not implemented.")
