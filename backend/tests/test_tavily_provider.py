from app.config import Settings
from app.domain import EdgeType, EntityMention, RelationshipMention
from app.providers.tavily import TavilyProvider


class FakeTavilyClient:
    def __init__(self):
        self.requests = []

    def search(self, **request):
        self.requests.append(request)
        return {"results": [{
            "title": "Trade register excerpt",
            "url": "https://example.test/source",
            "score": 0.8,
            "content": "Northstar Textiles sources yarn from Riverbend Cotton.",
            "raw_content": "Northstar Textiles sources yarn from Riverbend Cotton.",
        }]}


class FakeExtractor:
    def extract_web_relationships(self, company, text):
        return [RelationshipMention(
            source="Northstar Textiles",
            target="Riverbend Cotton",
            type="SUPPLIES",
            quote="Northstar Textiles sources yarn from Riverbend Cotton.",
        )]


def test_tavily_uses_verified_advanced_search_arguments(monkeypatch):
    client = FakeTavilyClient()
    monkeypatch.setattr("app.providers.tavily.get_cached", lambda provider, request: None)
    monkeypatch.setattr("app.providers.tavily.set_cached", lambda provider, request, response: None)
    provider = TavilyProvider(Settings(tavily_api_key="test"), FakeExtractor(), client=client)

    candidates = provider.neighbors(
        EntityMention(surface_text="Northstar Textiles"),
        {EdgeType.SUPPLIES},
    )

    assert candidates
    assert candidates[0].basis.value == "web_inferred"
    assert candidates[0].source_ref == "https://example.test/source"
    assert len(client.requests) == 2
    assert all(request["search_depth"] == "advanced" for request in client.requests)
    assert all(request["include_raw_content"] == "markdown" for request in client.requests)
    assert all(request["max_results"] == 5 for request in client.requests)