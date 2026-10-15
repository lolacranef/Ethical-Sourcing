# Zenith · Ethical Sourcing

Zenith is a global trade observatory for ethical-sourcing and trade-compliance analysts. It surfaces public-data signals that a product, corridor, or foreign-trade zone deserves a closer look, and keeps every judgment with a human reviewer. The product concept, method, and roadmap are in [CONCEPT.md](CONCEPT.md).

**Live demo:** https://lolacranef.github.io/Zenith-Ethical-Sourcing-/

## What's in the demo

| Tab | Contents | Data |
|---|---|---|
| Overview | Welcome briefing, world map of review leads by partner country, lead types | **Real**, generated from the data below |
| Signals | Screening queue with filters and a lead detail panel showing each lead's score breakdown | **Real**, generated from the data below |
| Product watch | Eight products with a history of trade anomalies or enforcement, with monthly mirror-statistics charts (U.S. imports vs. partner-reported exports) marked with ruling and tariff dates, plus corridor intelligence: supplier counts and risk-flag exposure, and recent rulings and enforcement news | **Real** UN Comtrade data, Sayari trade-record aggregates, Tavily web search, and public enforcement context |
| Trade flows | Example reporter / product / partner comparisons | Synthetic |
| Saved leads | Leads you saved, kept in this browser | Real |
| Data & method | Source register and evidence-discipline notes | Real source links |

Product watch flags a month when the mirror gap is beyond ±25%. Each product becomes a review lead scored 0–100 from four visible parts: mirror gap, recency, supplier risk, and policy activity. The period selector (24, 12, 6, or 3 months) re-scores leads and redraws the charts. A flag or score is a prompt to reconcile, not evidence of wrongdoing. See [CONCEPT.md §4a](CONCEPT.md#4a-product-watch-method) and [§4b](CONCEPT.md#4b-lead-scoring) for the method and caveats.

## Run the demo locally

Requirements: Node.js 20+ with npm.

```sh
cd frontend
npm install
npm run dev
```

Open `http://127.0.0.1:5173`. The demo needs no backend and no API keys.

## Refresh trade data and publish

GitHub Pages serves the `docs/` folder on `main`.

```sh
cd frontend
npm run data:comtrade   # fetches products missing from src/data/comtrade-mirror.json; add --refresh to refetch all
npm run build:pages     # type-checks and builds into ../docs
```

Then commit and push `docs/` and `frontend/src/data/`.

Sayari and Tavily data have their own refresh scripts. Both read keys from the environment or the repo-root `.env` (see `.env.example`):

```sh
npm run data:sayari   # needs SAYARI_CLIENT_ID and SAYARI_CLIENT_SECRET
npm run data:tavily   # needs TAVILY_API_KEY; --days=N to look back N days
```

`data:sayari` rewrites `sayari-corridors.json` with aggregates only and keeps the existing record-date coverage, which the facets don't provide. It follows Sayari's published API docs but has not yet been run against the live API. If Sayari's facet response differs from the docs, it stops with an error naming the keys it found.

`data:tavily` appends new results to `tavily-developments.json` marked `"reviewed": false`. The site hides them until someone checks the source, sets the date, kind, and summary, and deletes that line. Existing items are never changed.

The current snapshots were pulled through the Sayari and Tavily MCP connectors on October 15, 2026. Keep Sayari data aggregate and name no company. The method and caveats are in [CONCEPT.md §6a](CONCEPT.md#6a-corridor-intelligence-method).

The fetch uses the keyless UN Comtrade preview API. It has a call quota, and the script waits out quota errors automatically, so a full refresh can take an hour or more. For each product, the partner is the largest supplier to the U.S. that reports monthly data.

## Investigation engine (backend, local only)

`backend/` holds a FastAPI engine for case-level investigation. It turns an uploaded document into an evidence-backed supply-chain graph. **The current Zenith UI does not call it.** Connecting it to leads is on the roadmap, along with the unused `frontend/src/GraphView.tsx`.

Requirements: Python 3.11+ with `uv`, plus Anthropic and Tavily API keys for live investigations. Copy `.env.example` to `.env` and set keys locally; never commit `.env`.

```sh
uv sync --extra test
uv run uvicorn app.main:app --app-dir backend --reload --host 127.0.0.1 --port 8000
```

API docs are at `http://127.0.0.1:8000/docs`. Run tests with `uv run --extra test pytest backend/tests -q`.

What it does:

- Ingests text PDFs, DOCX, XLSX, CSV, TXT, or Markdown, storing extracted text with page and offset metadata in local SQLite.
- Uses Claude for schema-validated extraction. A relationship from a source document is kept only when its quoted text occurs verbatim and names both parties.
- Caches Tavily search results in SQLite. Claude validates each proposed web relationship against a direct quote naming both parties, and these edges stay labeled as unverified web-inferred leads.
- Serves graph data with tier, confidence, evidence basis, scores, entity details, and evidence, plus CSV and Markdown exports.
- Logs provider status at startup. Tavily is enabled only with `TAVILY_API_KEY`.

## Known limits

**Demo**

- Trade flows charts are synthetic. Leads, the map, and Product watch use real data.
- Leads are scored per product corridor, not per company, shipment, or FTZ. Map markers sit on the partner country.
- Sayari facet counts span every record Sayari holds for a corridor, not just the charted months. Gold (Switzerland → U.S.) has no shipment records because it moves by air.
- Product watch shows a product only once its data has been fetched. Some partners don't report monthly to Comtrade.
- Saved leads live in this browser's storage only, so they don't sync between devices.
- No company is named. Country pairs describe public statistics and are not allegations.

**Backend**

- `ANTHROPIC_API_KEY` is required for extraction, and web expansion needs both Anthropic and `TAVILY_API_KEY`. Without them, upload and health checks work but investigations report the missing configuration.
- Scanned-PDF OCR and image ingestion are not implemented. PDFs need an extractable text layer.
- Sayari and Tradeverifyd are typed inactive stubs. Adding credentials does not enable them until their API contracts are verified and the adapters are implemented.
- There is no authentication or multi-user isolation. Run it on loopback only, and don't upload sensitive records to a shared deployment.
- Entity resolution is review-only: name similarity never merges entities automatically. Sanctions screening, sector and region risk, shell-company signals, privacy filtering for people, hidden-neighbor expansion, and country filtering are not implemented yet.
- No sample dataset is bundled. Any demo names added later must be clearly fictional.
