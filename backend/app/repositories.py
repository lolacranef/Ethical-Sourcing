from typing import Protocol

from sqlalchemy import select
from sqlalchemy.orm import Session

from .models import Document, Edge, Entity, Evidence, Investigation, Mention


class GraphRepository(Protocol):
    def get_document(self, document_id: str) -> Document | None: ...

    def get_investigation(self, investigation_id: str) -> Investigation | None: ...

    def get_entity(self, entity_id: str) -> Entity | None: ...

    def graph_rows(self, investigation_id: str) -> tuple[list[Entity], list[Edge]]: ...

    def entity_evidence(self, entity_id: str) -> list[Evidence]: ...


class SqlAlchemyGraphRepository:
    def __init__(self, session: Session):
        self.session = session

    def get_document(self, document_id: str) -> Document | None:
        return self.session.get(Document, document_id)

    def get_investigation(self, investigation_id: str) -> Investigation | None:
        return self.session.get(Investigation, investigation_id)

    def get_entity(self, entity_id: str) -> Entity | None:
        return self.session.get(Entity, entity_id)

    def graph_rows(self, investigation_id: str) -> tuple[list[Entity], list[Edge]]:
        investigation = self.get_investigation(investigation_id)
        if investigation is None:
            return [], []
        entity_ids = select(Mention.entity_id).where(
            Mention.document_id == investigation.document_id,
            Mention.entity_id.is_not(None),
        )
        entities = list(self.session.scalars(select(Entity).where(Entity.id.in_(entity_ids))))
        graph_entity_ids = {entity.id for entity in entities}
        edges = list(self.session.scalars(
            select(Edge).where(Edge.investigation_id == investigation_id)
        ))
        graph_entity_ids.update(edge.source_entity_id for edge in edges)
        graph_entity_ids.update(edge.target_entity_id for edge in edges)
        if graph_entity_ids:
            entities = list(self.session.scalars(select(Entity).where(Entity.id.in_(graph_entity_ids))))
        return entities, edges

    def entity_evidence(self, entity_id: str) -> list[Evidence]:
        edge_ids = select(Edge.id).where(
            (Edge.source_entity_id == entity_id) | (Edge.target_entity_id == entity_id)
        )
        return list(
            self.session.scalars(
                select(Evidence).where(
                    (Evidence.entity_id == entity_id) | Evidence.edge_id.in_(edge_ids)
                )
            )
        )


def exact_entity(session: Session, canonical_name: str) -> Entity | None:
    normalized = " ".join(canonical_name.casefold().split())
    for entity in session.scalars(select(Entity)):
        if " ".join(entity.canonical_name.casefold().split()) == normalized:
            return entity
    return None