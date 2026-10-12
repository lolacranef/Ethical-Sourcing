from sqlalchemy import create_engine, select
from sqlalchemy.orm import sessionmaker

from app.config import Settings
from app.domain import EdgeType, EntityMention, EvidenceBasis, ExtractedDocument, RelationshipMention
from app.models import Base, Document, Edge, Entity, Evidence, Investigation
from app.pipeline import run_investigation
from app.providers.base import EdgeCandidate


class FakeExtractor:
    def extract_document(self, text, doc_type):
        return ExtractedDocument(
            entities=[EntityMention(surface_text="Northstar Textiles", role_in_document="named company")],
            relationships=[RelationshipMention(
                source="Northstar Textiles",
                target="Riverbend Cotton",
                edge_type=EdgeType.SUPPLIES,
                quote="Riverbend Cotton supplies Northstar Textiles.",
                page=1,
            )],
        )


class FakeRegistry:
    def configured_for(self, capability):
        return [self]

    def resolve(self, mention):
        return []

    def neighbors(self, entity, kinds):
        relationships = {
            "Northstar Textiles": ("Riverside Mill", 0.4, "Riverside Mill supplies Northstar Textiles."),
            "Riverside Mill": ("Delta Fiber", 0.3, "Delta Fiber supplies Riverside Mill."),
        }
        candidate = relationships.get(entity.surface_text)
        if candidate is None:
            return []
        target, confidence, snippet = candidate
        return [EdgeCandidate(
            target=EntityMention(surface_text=target),
            edge_type=EdgeType.SUPPLIES,
            confidence=confidence,
            provider="fixture-provider",
            source_ref="https://example.test/source",
            snippet=snippet,
            basis=EvidenceBasis.WEB_INFERRED,
        )]


def test_pipeline_persists_two_tiers_with_evidence_and_path_confidence(tmp_path, monkeypatch):
    engine = create_engine(f"sqlite:///{tmp_path / 'pipeline.db'}")
    Base.metadata.create_all(engine)
    sessions = sessionmaker(bind=engine, autoflush=False, expire_on_commit=False)
    with sessions() as session:
        document = Document(filename="fictional.txt", doc_type="other", raw_text="fixture")
        session.add(document)
        session.flush()
        investigation = Investigation(
            document_id=document.id,
            params_json={"max_tier_depth": 2, "max_nodes_per_tier": 25},
        )
        session.add(investigation)
        session.commit()
        investigation_id = investigation.id

    monkeypatch.setattr("app.pipeline.SessionLocal", sessions)
    monkeypatch.setattr("app.pipeline.get_settings", lambda: Settings(
        anthropic_api_key="test", tavily_api_key="test", database_url="sqlite://"
    ))
    monkeypatch.setattr("app.pipeline.ClaudeExtractor", lambda settings: FakeExtractor())
    monkeypatch.setattr("app.pipeline.build_registry", lambda settings, extractor: FakeRegistry())

    run_investigation(investigation_id)

    with sessions() as session:
        result = session.get(Investigation, investigation_id)
        assert result.status == "completed"
        entities = list(session.scalars(select(Entity)))
        by_name = {entity.canonical_name: entity for entity in entities}
        assert by_name["Northstar Textiles"].priority_score == 45
        assert by_name["Riverside Mill"].tier == 1
        assert by_name["Delta Fiber"].tier == 2
        assert by_name["Delta Fiber"].priority_score == 1.2
        edges = list(session.scalars(select(Edge).where(Edge.investigation_id == investigation_id)))
        assert len(edges) == 3
        assert all(session.scalar(select(Evidence.id).where(Evidence.edge_id == edge.id)) for edge in edges)
        direct_edge = next(edge for edge in edges if edge.basis == "document_stated")
        assert direct_edge.confidence == 0.95

    engine.dispose()