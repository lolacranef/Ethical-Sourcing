import csv
import io
import logging
from contextlib import asynccontextmanager

from fastapi import BackgroundTasks, Depends, FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.orm import Session

from .config import get_settings
from .database import get_session, initialize_database
from .documents import UnsupportedDocumentError, classify_document, extract_document_text
from .models import Document, Edge, Entity, Evidence, Investigation, Mention
from .pipeline import run_investigation
from .providers.registry import build_registry
from .extraction import ClaudeExtractor
from .repositories import SqlAlchemyGraphRepository

logging.basicConfig(level=logging.INFO, format="%(levelname)s %(name)s: %(message)s")
settings = get_settings()
extractor = ClaudeExtractor(settings)
provider_registry = build_registry(settings, extractor)


@asynccontextmanager
async def lifespan(_: FastAPI):
    initialize_database()
    yield


app = FastAPI(
    title="Ethical Sourcing Tracer",
    version="0.1.0",
    description="Evidence-first supply-chain research. Web links are unverified leads, not findings.",
    lifespan=lifespan,
)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_methods=["*"],
    allow_headers=["*"],
)


class InvestigationCreate(BaseModel):
    document_id: str
    max_tier_depth: int | None = Field(default=None, ge=0, le=3)


class MentionDecision(BaseModel):
    entity_id: str | None = None


@app.get("/health")
def health():
    return {"status": "ok", "providers": provider_registry.status()}


@app.post("/documents", status_code=201)
async def upload_document(
    file: UploadFile = File(...),
    session: Session = Depends(get_session),
):
    filename = (file.filename or "upload").replace("\\", "/").split("/")[-1]
    content = await file.read(settings.max_upload_bytes + 1)
    if len(content) > settings.max_upload_bytes:
        raise HTTPException(status_code=413, detail="Document exceeds the 20 MB upload limit.")
    try:
        text, page_map = extract_document_text(filename, content)
    except UnsupportedDocumentError as error:
        raise HTTPException(status_code=422, detail=str(error)) from error
    if not text.strip():
        raise HTTPException(status_code=422, detail="No text could be extracted from this document.")
    document = Document(
        filename=filename,
        doc_type=classify_document(text),
        raw_text=text,
        page_map_json=page_map,
    )
    session.add(document)
    session.commit()
    return {
        "document_id": document.id,
        "filename": document.filename,
        "doc_type": document.doc_type,
        "characters_extracted": len(text),
    }


@app.post("/investigations", status_code=202)
def create_investigation(
    request: InvestigationCreate,
    background_tasks: BackgroundTasks,
    session: Session = Depends(get_session),
):
    document = session.get(Document, request.document_id)
    if document is None:
        raise HTTPException(status_code=404, detail="Document not found.")
    depth = request.max_tier_depth if request.max_tier_depth is not None else settings.max_tier_depth
    investigation = Investigation(
        document_id=document.id,
        status="queued",
        params_json={
            "max_tier_depth": depth,
            "max_nodes_per_tier": settings.max_nodes_per_tier,
            "providers": provider_registry.status(),
        },
    )
    session.add(investigation)
    session.commit()
    background_tasks.add_task(run_investigation, investigation.id)
    return {"investigation_id": investigation.id, "status": investigation.status}


@app.get("/investigations/{investigation_id}")
def get_investigation(investigation_id: str, session: Session = Depends(get_session)):
    investigation = session.get(Investigation, investigation_id)
    if investigation is None:
        raise HTTPException(status_code=404, detail="Investigation not found.")
    return {
        "investigation_id": investigation.id,
        "document_id": investigation.document_id,
        "status": investigation.status,
        "progress": investigation.progress,
        "error": investigation.error,
        "params": investigation.params_json,
    }


@app.get("/investigations/{investigation_id}/graph")
def get_graph(investigation_id: str, session: Session = Depends(get_session)):
    repository = SqlAlchemyGraphRepository(session)
    investigation = repository.get_investigation(investigation_id)
    if investigation is None:
        raise HTTPException(status_code=404, detail="Investigation not found.")
    entities, edges = repository.graph_rows(investigation_id)
    evidence_by_edge = {}
    for evidence in session.scalars(select(Evidence).where(Evidence.edge_id.in_([edge.id for edge in edges]))):
        evidence_by_edge.setdefault(evidence.edge_id, []).append(_evidence_json(evidence))
    nodes = [{
        "data": {
            "id": entity.id,
            "label": entity.canonical_name,
            "entity_type": entity.entity_type,
            "country": entity.country,
            "tier": entity.tier,
            "priority_score": entity.priority_score,
            "score_factors": entity.score_factors_json,
            "risk_flags": entity.risk_flags_json,
            "is_seed": entity.is_seed,
            "resolution_status": entity.resolution_status,
            "overflow_count": entity.overflow_count,
        }
    } for entity in entities]
    graph_edges = []
    for edge in edges:
        edge_evidence = evidence_by_edge.get(edge.id, [])
        if not edge_evidence:
            continue
        graph_edges.append({
            "data": {
                "id": edge.id,
                "source": edge.source_entity_id,
                "target": edge.target_entity_id,
                "label": edge.edge_type,
                "basis": edge.basis,
                "confidence": edge.confidence,
                "evidence": edge_evidence,
            }
        })
    return {"nodes": nodes, "edges": graph_edges}


@app.get("/entities/{entity_id}")
def get_entity(entity_id: str, session: Session = Depends(get_session)):
    repository = SqlAlchemyGraphRepository(session)
    entity = repository.get_entity(entity_id)
    if entity is None:
        raise HTTPException(status_code=404, detail="Entity not found.")
    edges = list(session.scalars(select(Edge).where(
        (Edge.source_entity_id == entity_id) | (Edge.target_entity_id == entity_id)
    )))
    evidence = repository.entity_evidence(entity_id)
    mentions = list(session.scalars(select(Mention).where(Mention.entity_id == entity_id)))
    return {
        "id": entity.id,
        "canonical_name": entity.canonical_name,
        "entity_type": entity.entity_type,
        "country": entity.country,
        "identifiers": entity.identifiers_json,
        "risk_flags": entity.risk_flags_json,
        "priority_score": entity.priority_score,
        "score_factors": entity.score_factors_json,
        "tier": entity.tier,
        "is_seed": entity.is_seed,
        "resolution_status": entity.resolution_status,
        "mentions": [{
            "surface_text": mention.surface_text,
            "page": mention.page,
            "char_start": mention.char_start,
            "char_end": mention.char_end,
            "resolution_confidence": mention.resolution_confidence,
            "user_confirmed": mention.user_confirmed,
        } for mention in mentions],
        "edges": [{
            "id": edge.id,
            "type": edge.edge_type,
            "basis": edge.basis,
            "confidence": edge.confidence,
        } for edge in edges],
        "evidence": [_evidence_json(item) for item in evidence],
    }


@app.post("/mentions/{mention_id}/confirm")
def confirm_mention(
    mention_id: str,
    decision: MentionDecision,
    session: Session = Depends(get_session),
):
    mention = session.get(Mention, mention_id)
    if mention is None:
        raise HTTPException(status_code=404, detail="Mention not found.")
    if decision.entity_id is not None and session.get(Entity, decision.entity_id) is None:
        raise HTTPException(status_code=404, detail="Selected entity not found.")
    if decision.entity_id is not None:
        mention.entity_id = decision.entity_id
    mention.user_confirmed = True
    session.commit()
    return {"mention_id": mention.id, "user_confirmed": True, "entity_id": mention.entity_id}


@app.post("/mentions/{mention_id}/reject")
def reject_mention(mention_id: str, session: Session = Depends(get_session)):
    mention = session.get(Mention, mention_id)
    if mention is None:
        raise HTTPException(status_code=404, detail="Mention not found.")
    mention.user_confirmed = False
    mention.entity_id = None
    session.commit()
    return {"mention_id": mention.id, "user_confirmed": False}


@app.get("/investigations/{investigation_id}/export.csv")
def export_csv(investigation_id: str, session: Session = Depends(get_session)):
    repository = SqlAlchemyGraphRepository(session)
    investigation = repository.get_investigation(investigation_id)
    if investigation is None:
        raise HTTPException(status_code=404, detail="Investigation not found.")
    entities, _ = repository.graph_rows(investigation_id)
    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(["name", "type", "country", "tier", "priority_score", "score_factors", "resolution_status"])
    for entity in sorted(entities, key=lambda item: item.priority_score, reverse=True):
        writer.writerow([
            entity.canonical_name, entity.entity_type, entity.country or "", entity.tier,
            entity.priority_score, entity.score_factors_json, entity.resolution_status,
        ])
    from fastapi.responses import Response
    return Response(output.getvalue(), media_type="text/csv", headers={
        "Content-Disposition": f'attachment; filename="investigation-{investigation_id}.csv"'
    })


@app.get("/investigations/{investigation_id}/export.md")
def export_markdown(investigation_id: str, session: Session = Depends(get_session)):
    repository = SqlAlchemyGraphRepository(session)
    investigation = repository.get_investigation(investigation_id)
    if investigation is None:
        raise HTTPException(status_code=404, detail="Investigation not found.")
    entities, edges = repository.graph_rows(investigation_id)
    names = {entity.id: entity.canonical_name for entity in entities}
    evidence_map = {}
    for item in session.scalars(select(Evidence).where(Evidence.edge_id.in_([edge.id for edge in edges]))):
        evidence_map.setdefault(item.edge_id, []).append(item)
    lines = [
        "# Ethical Sourcing Tracer evidence report",
        "",
        "Web-inferred relationships are unverified leads, not findings. Scores prioritize review and are not legal determinations.",
        "",
        "## Entities",
        "",
    ]
    for entity in sorted(entities, key=lambda item: item.priority_score, reverse=True):
        lines.append(f"- **{entity.canonical_name}** (tier {entity.tier}, priority {entity.priority_score:.1f}/100)")
    lines.extend(["", "## Relationships and evidence", ""])
    for edge in edges:
        citations = evidence_map.get(edge.id, [])
        if not citations:
            continue
        lines.append(f"- **{names.get(edge.source_entity_id, edge.source_entity_id)}** {edge.edge_type} **{names.get(edge.target_entity_id, edge.target_entity_id)}**; basis `{edge.basis}`, confidence {edge.confidence:.2f}.")
        for item in citations:
            lines.append(f"  - {item.provider}: {item.snippet} ({item.source_ref})")
    from fastapi.responses import Response
    return Response("\n".join(lines), media_type="text/markdown; charset=utf-8", headers={
        "Content-Disposition": f'attachment; filename="investigation-{investigation_id}.md"'
    })


def _evidence_json(evidence: Evidence) -> dict:
    return {
        "id": evidence.id,
        "provider": evidence.provider,
        "source_ref": evidence.source_ref,
        "snippet": evidence.snippet,
        "retrieved_at": evidence.retrieved_at,
    }