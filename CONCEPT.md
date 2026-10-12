# Ethical Sourcing Tracer — Build Spec

> Instructions for a coding agent (e.g. Claude Code). Drop this file in the repo root (or rename to `CLAUDE.md`) and ask the agent to build from it.
> **Current data access:** Tavily only. **Planned:** Sayari (and optionally Tradeverifyd). The system must run fully today on Tavily and switch on Sayari automatically when credentials are added — no code changes required.

---

## 1. What the product does

A user uploads a source document — a sanctions notice, court filing, suspicious KYC file, customs record, NGO report, or similar. The system:

1. Extracts the companies, people, addresses, identifiers and goods named in it.
2. Resolves those names to real-world entities.
3. Expands outward to find the supply chain connected to them (suppliers, buyers, owners, affiliates), tier by tier.
4. Scores every company for relevance and risk.
5. Renders an interactive graph showing **all tiers**, with the most relevant companies visually prioritized.

Every node and edge must trace back to the document or data source that produced it.

---

## 2. Tech stack

- **Backend:** Python 3.11+, FastAPI, Pydantic v2
- **Storage:** SQLite via SQLAlchemy for the MVP (tables below model a graph). Keep the data layer behind a repository interface so it can move to Postgres or Neo4j later.
- **Extraction:** Anthropic API (Claude) with structured JSON output validated by Pydantic
- **Documents:** `pypdf` / `pdfplumber` for text PDFs, `pytesseract` for scanned pages, `python-docx`, `openpyxl` for spreadsheets
- **Web discovery:** `tavily-python`
- **Frontend:** React + Vite + TypeScript, Cytoscape.js for the graph (with `cytoscape-dagre` for tiered layout)
- **Config:** `.env` loaded with `python-dotenv`

Verify current SDK method signatures against each vendor's docs before writing adapter code — do not rely on memory for API shapes.

---

## 3. Environment variables

```
ANTHROPIC_API_KEY=          # required
TAVILY_API_KEY=             # required (current access)

# Optional — leave blank until access is granted. Providers auto-enable when set.
SAYARI_CLIENT_ID=
SAYARI_CLIENT_SECRET=
TRADEVERIFYD_API_KEY=

MAX_TIER_DEPTH=3
MAX_NODES_PER_TIER=25
```

On startup, log which providers are active, e.g. `Providers active: tavily | inactive: sayari, tradeverifyd`.

---

## 4. Provider architecture (the key design requirement)

All external data goes through a common interface so Sayari can be dropped in later.

```python
class DataProvider(Protocol):
    name: str
    capabilities: set[Capability]   # RESOLVE, OWNERSHIP, TRADE, SANCTIONS, NEWS
    reliability: float              # 0–1, used in confidence scoring

    def is_configured(self) -> bool: ...
    def resolve(self, mention: EntityMention) -> list[ResolutionCandidate]: ...
    def neighbors(self, entity: Entity, kinds: set[EdgeType]) -> list[EdgeCandidate]: ...
```

- `providers/registry.py` loads every provider, keeps the ones where `is_configured()` is true, and routes each request to the highest-reliability provider that has the needed capability.
- Results from multiple providers are merged, not overwritten. If two providers support the same edge, keep both sources on the edge and raise its confidence.

### 4a. TavilyProvider — active now

Capabilities: `RESOLVE` (weak), `TRADE` (inferred), `OWNERSHIP` (inferred), `NEWS`. Reliability: `0.4`.

How it works:
- **Resolve:** search `"<company name>" <country> company registration` and similar; pass top results to Claude to pull out legal name, country, address, registration number, website. Return candidates with confidence based on how many identifiers match the mention.
- **Neighbors:** run targeted queries such as:
  - `"<company>" supplier OR supplies OR "sourced from"`
  - `"<company>" subsidiary OR "parent company" OR "owned by"`
  - `"<company>" shipments importer exporter`
  - `"<company>" forced labor OR sanctions OR "entity list"`
  Use advanced search depth and request raw page content where available. Send each page to Claude with the extraction schema (Section 6) and keep only relationships that explicitly name both parties.
- Every Tavily-derived edge is marked `basis = "web_inferred"` and stores the URL and a short supporting snippet (under 25 words).

### 4b. SayariProvider — stub now, activates later

Capabilities: `RESOLVE`, `OWNERSHIP`, `TRADE`, `SANCTIONS`. Reliability: `0.9`.

- Build the class with full method signatures, auth handling (OAuth client-credentials token, cached until expiry), retry/backoff, and response-to-model mapping functions.
- `is_configured()` returns false while credentials are blank, so the app runs without it.
- Map Sayari concepts to our models: entity resolution → `resolve`; ownership/control relationships → `OWNS`/`CONTROLS` edges; shipment/trade relationships → `SUPPLIES` edges; risk flags → entity `risk_flags`.
- **Endpoint paths and response fields must be confirmed against Sayari's API documentation once access is granted.** Leave clearly marked `# TODO(sayari-docs)` comments where paths or field names are assumed, and write unit tests with recorded fixtures so the mapping can be checked the moment real responses are available.
- When Sayari is active, Tavily is demoted to `NEWS` and corroboration only; it should no longer be the primary source for ownership or trade edges.

### 4c. TradeverifydProvider — optional stub

Same pattern as Sayari: capability `TRADE`, reliability `0.8`, inactive until `TRADEVERIFYD_API_KEY` is set.

### 4d. Free supplementary source (optional, no key needed)

- **OpenSanctions bulk data** (consolidated sanctions/PEP dataset): download the default dataset on a schedule and match locally for `SANCTIONS` flags. Check its license terms for the intended use.

---

## 5. Data model

```
documents(id, filename, doc_type, uploaded_at, raw_text, page_map_json)
entities(id, canonical_name, entity_type, country, identifiers_json,
         addresses_json, risk_flags_json, priority_score, tier, is_seed)
mentions(id, document_id, entity_id NULL, surface_text, page, char_start,
         char_end, extracted_attrs_json, resolution_confidence, user_confirmed NULL)
edges(id, source_entity_id, target_entity_id, edge_type, basis,
      confidence, first_seen, last_seen)
evidence(id, edge_id NULL, entity_id NULL, provider, source_ref,
         snippet, retrieved_at)
investigations(id, document_id, status, created_at, params_json)
```

- `entity_type`: company | person | vessel | address
- `edge_type`: SUPPLIES | BUYS_FROM | OWNS | CONTROLS | DIRECTOR_OF | SHARES_ADDRESS | NAMED_TOGETHER | SANCTIONED_BY
- `basis`: `document_stated` (in the uploaded file) | `registry` (structured provider like Sayari) | `web_inferred` (Tavily + LLM)

---

## 6. Pipeline

### Stage 1 — Ingest
- Accept PDF, DOCX, XLSX/CSV, TXT, images. Detect scanned PDFs (little or no extractable text) and OCR them.
- Store raw text plus a page/offset map so any snippet can be located in the original.
- Classify `doc_type`: sanctions_notice | court_filing | kyc_file | customs_record | ngo_report | other.

### Stage 2 — Extract
- Chunk text (~3,000 tokens with overlap). For each chunk, call Claude with a doc-type-specific prompt and this output schema:

```json
{
  "entities": [
    {"surface_text": "", "type": "company|person|vessel|address",
     "country": null, "identifiers": {"registration_no": null, "tax_id": null, "imo": null},
     "address": null, "role_in_document": "", "page": 0}
  ],
  "relationships": [
    {"source": "", "target": "", "type": "SUPPLIES|OWNS|...", "quote": "", "page": 0}
  ],
  "goods": [{"description": "", "hs_code": null}]
}
```

- Deduplicate mentions across chunks. Relationships found here get `basis = document_stated` and high confidence.

### Stage 3 — Resolve
- For each mention, ask all providers with `RESOLVE` for candidates.
- Score candidates: exact identifier match (strong) > address match > country match > fuzzy name similarity (weak; use `rapidfuzz`).
- Auto-accept above 0.85, queue 0.5–0.85 for user review in the UI, discard below 0.5.
- **Never auto-merge two entities on name similarity alone.**

### Stage 4 — Expand tiers
- Breadth-first from seed entities (tier 0) up to `MAX_TIER_DEPTH`.
- At each tier, call `neighbors()` on active providers, resolve new counterparties, and record edges with evidence.
- Limit fan-out with `MAX_NODES_PER_TIER`, keeping the highest-confidence neighbors, but store the overflow count on the parent node so the UI can show "+N more".
- Detect shell-pattern signals while expanding: shared addresses across many entities, the same director or legal-person owner across several short-lived companies, and circular ownership. Add `SHARES_ADDRESS` edges and risk flags for these.
- Cache provider responses (SQLite table keyed by provider + request hash) to save Tavily credits and support re-runs.

### Stage 5 — Score and prioritize
Compute `priority_score` (0–100) per entity as a weighted sum, with weights in a config file:

| Factor | Default weight |
|---|---|
| Named directly in source document | 25 |
| Proximity to seed (tier 1 > 2 > 3) | 20 |
| Sanctions / watchlist hit | 20 |
| Strength of trade or ownership link to a flagged entity | 15 |
| High-risk sector or region for the goods involved | 10 |
| Shell-pattern signals | 10 |

Multiply by average edge confidence on the entity's path to the seed. Store the per-factor breakdown so the UI can explain every score.

### Stage 6 — API for the frontend
- `POST /documents` — upload, returns `document_id`
- `POST /investigations` — start pipeline for a document (run as a background task; expose progress)
- `GET /investigations/{id}` — status and progress
- `GET /investigations/{id}/graph` — nodes and edges in Cytoscape JSON format
- `GET /entities/{id}` — details, score breakdown, all evidence
- `POST /mentions/{id}/confirm` and `/reject` — user resolution review

---

## 7. Visualization requirements

- Tiered layout (dagre, left-to-right): tier 0 seeds on the left, then tier 1, 2, 3.
- **All tiers are rendered.** Lower-priority nodes are smaller and faded but still present; any node can be expanded to show its hidden "+N more" neighbors.
- Node size and color = `priority_score`. Seed entities get a distinct outline. Sanctioned entities get a clear badge.
- Edge style by type (solid = trade, dashed = ownership/control, dotted = shared address / co-mention). Edge opacity = confidence.
- Visually distinguish `document_stated`, `registry`, and `web_inferred` edges (legend required).
- Side panel on click: entity details, score breakdown, every piece of evidence with link/page reference, and which provider supplied it.
- Filters: minimum priority, tier depth, edge type, basis, country.
- Ranked table view alongside the graph listing entities by priority.
- Export: graph as PNG, entity table as CSV, and an evidence report as Markdown.

---

## 8. Ethics and accuracy guardrails

- Show the evidence for every claim; never display a relationship without at least one evidence record.
- Label web-inferred links clearly as unverified leads, not findings.
- Store confidence everywhere and surface it in the UI.
- Do not compile or display personal data about private individuals beyond what appears in the uploaded document or a registry record (e.g. a named director). No home addresses or personal contact details for individuals.
- Keep uploaded documents private to the user who uploaded them.

---

## 9. Build order

1. Repo skeleton, config loading, provider registry with active/inactive logging.
2. Ingestion + extraction on a sample sanctions notice; print extracted entities.
3. TavilyProvider resolve + neighbors; run a 2-tier expansion from the CLI.
4. Database models and provenance storage.
5. Scoring.
6. FastAPI endpoints.
7. Frontend graph, side panel, filters, ranked table.
8. SayariProvider and TradeverifydProvider stubs with fixtures and tests.
9. End-to-end test with 2–3 sample documents.

---

## 10. Definition of done (Tavily-only mode)

- Upload a PDF sanctions notice → see seeds extracted, resolved, expanded to at least 2 tiers, scored, and rendered.
- Every edge clicks through to its evidence.
- Adding Sayari credentials to `.env` and restarting changes the startup log to show Sayari active, with no code edits.
- Tests pass for extraction schema validation, scoring, provider routing, and the Sayari mapping fixtures.