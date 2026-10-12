import logging

from sqlalchemy import select

from .config import get_settings
from .database import SessionLocal
from .domain import Capability, EdgeType, EntityMention, EvidenceBasis, ScoreInput
from .extraction import ClaudeExtractor
from .models import Document, Edge, Entity, Evidence, Investigation, Mention
from .providers.registry import build_registry
from .repositories import exact_entity
from .scoring import score_entity

logger = logging.getLogger(__name__)
EXPANSION_EDGE_TYPES = {
    EdgeType.SUPPLIES,
    EdgeType.BUYS_FROM,
    EdgeType.OWNS,
    EdgeType.CONTROLS,
    EdgeType.SANCTIONED_BY,
}


def _entity_for(session, mention: EntityMention, tier: int, is_seed: bool = False) -> Entity:
    entity = exact_entity(session, mention.surface_text)
    if entity is None:
        entity = Entity(
            canonical_name=mention.surface_text.strip(),
            entity_type=mention.entity_type.value,
            country=mention.country,
            identifiers_json={} if mention.entity_type.value == "person" else mention.identifiers,
            addresses_json=[mention.address] if mention.address and mention.entity_type.value != "person" else [],
            tier=tier,
            is_seed=is_seed,
        )
        session.add(entity)
        session.flush()
    else:
        entity.tier = min(entity.tier, tier)
        entity.is_seed = entity.is_seed or is_seed
    return entity


def _save_edge(session, investigation_id: str, source: Entity, target: Entity, candidate) -> Edge:
    edge = session.scalar(select(Edge).where(
        Edge.investigation_id == investigation_id,
        Edge.source_entity_id == source.id,
        Edge.target_entity_id == target.id,
        Edge.edge_type == candidate.edge_type.value,
    ))
    if edge is None:
        edge = Edge(
            investigation_id=investigation_id,
            source_entity_id=source.id,
            target_entity_id=target.id,
            edge_type=candidate.edge_type.value,
            basis=candidate.basis.value,
            confidence=candidate.confidence,
        )
        session.add(edge)
        session.flush()
    else:
        existing_providers = set(session.scalars(
            select(Evidence.provider).where(Evidence.edge_id == edge.id)
        ))
        if candidate.provider not in existing_providers:
            edge.confidence = 1 - (1 - edge.confidence) * (1 - candidate.confidence)
        else:
            edge.confidence = max(edge.confidence, candidate.confidence)
        if candidate.basis == EvidenceBasis.DOCUMENT_STATED:
            edge.basis = candidate.basis.value
    session.add(Evidence(
        edge_id=edge.id,
        provider=candidate.provider,
        source_ref=candidate.source_ref,
        snippet=candidate.snippet,
    ))
    return edge


def _record_document_extraction(session, investigation: Investigation, document, extracted):
    entity_by_name = {}
    for mention_data in extracted.entities:
        key = " ".join(mention_data.surface_text.casefold().split())
        if key in entity_by_name:
            continue
        entity = _entity_for(session, mention_data, tier=0, is_seed=True)
        entity_by_name[key] = entity
        snippet = mention_data.surface_text
        if mention_data.entity_type.value != "person" and mention_data.char_start is not None and mention_data.char_end is not None:
            snippet = document.raw_text[max(0, mention_data.char_start - 100):mention_data.char_end + 100]
        session.add(Mention(
            document_id=document.id,
            entity_id=entity.id,
            surface_text=mention_data.surface_text,
            page=mention_data.page,
            char_start=mention_data.char_start,
            char_end=mention_data.char_end,
            extracted_attrs_json={
                "entity_type": mention_data.entity_type.value,
                "country": mention_data.country,
                "identifiers": mention_data.identifiers,
                "address": None if mention_data.entity_type.value == "person" else mention_data.address,
                "role_in_document": mention_data.role_in_document,
            },
        ))
        session.add(Evidence(
            entity_id=entity.id,
            provider="document",
            source_ref=f"document:{document.id}#page={mention_data.page or 'unknown'}",
            snippet=snippet,
        ))

    for relation in extracted.relationships:
        source_key = " ".join(relation.source.casefold().split())
        target_key = " ".join(relation.target.casefold().split())
        source = entity_by_name.get(source_key)
        target = entity_by_name.get(target_key)
        if source is None:
            source = _entity_for(session, EntityMention(surface_text=relation.source), 0, True)
            entity_by_name[source_key] = source
        if target is None:
            target = _entity_for(session, EntityMention(surface_text=relation.target), 0, True)
            entity_by_name[target_key] = target
        _save_edge(session, investigation.id, source, target, _DocumentEdgeCandidate(relation, document.id))
    session.commit()
    return list(entity_by_name.values())


class _DocumentEdgeCandidate:
    def __init__(self, relation, document_id: str):
        self.edge_type = relation.edge_type
        self.basis = EvidenceBasis.DOCUMENT_STATED
        self.confidence = 0.95
        self.provider = "document"
        self.source_ref = f"document:{document_id}#page={relation.page or 'unknown'}"
        self.snippet = relation.quote


def run_investigation(investigation_id: str) -> None:
    settings = get_settings()
    with SessionLocal() as session:
        investigation = session.get(Investigation, investigation_id)
        if investigation is None:
            return
        document = session.get(Document, investigation.document_id)
        investigation.status = "extracting"
        investigation.progress = 5
        investigation.error = None
        session.commit()
        try:
            extractor = ClaudeExtractor(settings)
            extracted = extractor.extract_document(document.raw_text, document.doc_type)
            seeds = _record_document_extraction(session, investigation, document, extracted)
            registry = build_registry(settings, extractor)
            investigation.progress = 25
            investigation.status = "expanding"
            if settings.tavily_api_key and not settings.anthropic_api_key:
                investigation.params_json["expansion_note"] = "Tavily is configured, but Claude is required to validate web relationships."
            session.commit()

            if registry.configured_for(Capability.RESOLVE):
                for seed in seeds:
                    candidates = registry.resolve(EntityMention(
                        surface_text=seed.canonical_name,
                        entity_type=seed.entity_type,
                        country=seed.country,
                        identifiers=seed.identifiers_json,
                    ))
                    mention_rows = list(session.scalars(select(Mention).where(
                        Mention.document_id == document.id,
                        Mention.entity_id == seed.id,
                    )))
                    if candidates and mention_rows:
                        for row in mention_rows:
                            row.resolution_confidence = candidates[0].confidence
            session.commit()

            frontier = seeds
            path_confidence = {seed.id: 1.0 for seed in seeds}
            max_tier_depth = investigation.params_json.get("max_tier_depth", settings.max_tier_depth)
            for tier in range(max_tier_depth):
                next_frontier = []
                new_node_count = 0
                for parent in frontier:
                    candidates = registry.neighbors(
                        EntityMention(surface_text=parent.canonical_name, entity_type=parent.entity_type),
                        EXPANSION_EDGE_TYPES,
                    )
                    candidates.sort(key=lambda item: item.confidence, reverse=True)
                    accepted_for_parent = 0
                    for candidate in candidates:
                        target = _entity_for(session, candidate.target, tier + 1)
                        is_new_in_investigation = target.id not in path_confidence
                        if is_new_in_investigation and new_node_count >= settings.max_nodes_per_tier:
                            parent.overflow_count += 1
                            continue
                        _save_edge(session, investigation.id, parent, target, candidate)
                        if is_new_in_investigation:
                            new_node_count += 1
                            path_confidence[target.id] = path_confidence[parent.id] * candidate.confidence
                            target.tier = tier + 1
                            next_frontier.append(target)
                        accepted_for_parent += 1
                    if accepted_for_parent == 0 and candidates:
                        parent.overflow_count += len(candidates)
                investigation.progress = min(75, 30 + (tier + 1) * 20)
                session.commit()
                frontier = next_frontier
                if not frontier:
                    break

            investigation.status = "scoring"
            investigation.progress = 85
            session.commit()
            nodes, _ = build_registry_graph(session, investigation.id)
            for entity in nodes:
                score = score_entity(ScoreInput(
                    named_in_document=entity.is_seed,
                    tier=entity.tier,
                    sanctions_hit=any(flag.get("type") == "sanctions" for flag in entity.risk_flags_json if isinstance(flag, dict)),
                    linked_to_flagged_entity=False,
                    high_risk_sector_or_region=False,
                    shell_pattern=any("shell" in str(flag).casefold() for flag in entity.risk_flags_json),
                    path_confidence=path_confidence.get(entity.id, 1.0),
                ))
                entity.priority_score = score.priority_score
                entity.score_factors_json = score.factors
            investigation.status = "completed"
            investigation.progress = 100
            session.commit()
        except Exception as error:
            logger.exception("Investigation %s failed", investigation_id)
            investigation.status = "failed"
            investigation.error = str(error)[:1000]
            session.commit()


def build_registry_graph(session, investigation_id: str):
    from .models import Entity

    edges = list(session.scalars(select(Edge).where(Edge.investigation_id == investigation_id)))
    entity_ids = {edge.source_entity_id for edge in edges} | {edge.target_entity_id for edge in edges}
    investigation = session.get(Investigation, investigation_id)
    if investigation:
        entity_ids.update(session.scalars(select(Mention.entity_id).where(
            Mention.document_id == investigation.document_id,
            Mention.entity_id.is_not(None),
        )))
    return list(session.scalars(select(Entity).where(Entity.id.in_(entity_ids)))), edges