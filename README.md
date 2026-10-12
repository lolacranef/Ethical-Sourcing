# Ethical Sourcing Tracer

Evidence-first supply-chain research workspace. The repository's full product requirements are preserved in [CONCEPT.md](CONCEPT.md).

## Local setup

Requirements: Python 3.11+ with `uv`, Node.js 20+ with npm, and API keys for Anthropic and Tavily to run live investigations. Copy `.env.example` to `.env` and set keys locally; never commit `.env`.

```sh
uv sync --extra test
uv run uvicorn app.main:app --app-dir backend --reload --host 127.0.0.1 --port 8000
```

In another terminal:

```sh
cd frontend
npm install
npm run dev
```

Open `http://127.0.0.1:5173`. The API docs are at `http://127.0.0.1:8000/docs`.

Run backend tests with `uv run --extra test pytest backend/tests -q`; build the UI with `cd frontend && npm run build`.

## MVP behavior

- Upload text PDFs, DOCX, XLSX, CSV, TXT, or Markdown. Extracted text and page/offset metadata are stored in local SQLite.
- Claude performs schema-validated extraction. Source-document relationships are retained only when their quoted text occurs verbatim and names both parties.
- Tavily search results are cached in SQLite. Claude validates any proposed web relationship against a direct quote naming both parties; these edges remain unverified web-inferred leads.
- The graph displays tier, confidence, evidence basis, scores, entity details, evidence, filters, CSV and Markdown exports, and PNG export.
- Provider status is logged at startup. Tavily is enabled only with `TAVILY_API_KEY`.

## Known limits

- `ANTHROPIC_API_KEY` is required to run extraction; `TAVILY_API_KEY` and Anthropic are both needed for web expansion. Without them, upload and health checks work but investigation processing reports the missing configuration.
- Scanned-PDF OCR and image ingestion are not implemented. PDFs need an extractable text layer.
- Sayari and Tradeverifyd are typed inactive stubs. Credentials do not activate them until their vendor API contracts are verified and the adapters are implemented. Adding Sayari credentials alone will not enable it yet.
- There is no authentication or multi-user isolation. Run bound to loopback for a local, single-user workspace; do not expose this MVP to a network or upload sensitive records to a shared deployment.
- Entity resolution remains review-only; name similarity never automatically merges entities. Sanctions, sector/region risk, shell signals, person privacy filtering, hidden-neighbor expansion, and country filtering are not yet implemented. No provider output should be treated as a verified allegation.
- No sample dataset is bundled. All demo names, if added later, must be clearly fictional.