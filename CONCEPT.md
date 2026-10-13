# Zenith — Product Concept

> Zenith is a global trade observatory for ethical-sourcing and trade-compliance analysts. It surfaces public-data signals that a product, corridor, or foreign-trade zone (FTZ) deserves a closer look, explains why, and keeps every judgment with a human reviewer.
>
> **Live demo:** https://lolacranef.github.io/Zenith-Ethical-Sourcing-/

---

## 1. Problem

Goods tied to forced labor, sanctions evasion, duty circumvention, or illicit sourcing often move through transshipment hubs and foreign-trade zones, where they can be stored, processed, or relabeled before entering a market. The public data that could reveal those patterns is scattered across national statistics, mirror statistics, enforcement notices, and NGO reporting. It is aggregate, inconsistent across jurisdictions, and easy to over-read.

Analysts need one place to:

1. See where public trade patterns diverge from what would be expected.
2. Understand which products carry a documented history of risk, and why.
3. Turn a pattern into a reviewable lead with its limitations stated up front.
4. Move from a lead to case-level evidence, such as entities, ownership, and shipments, once they have authorized access to that data.

## 2. Users

- Ethical-sourcing and supply-chain due-diligence teams
- Trade-compliance and customs-risk analysts
- Researchers and journalists working on forced labor or illicit trade

## 3. Principles

- **Signals, not findings.** A score orders analyst attention. It is never a probability of wrongdoing and never names a company or country as culpable.
- **Show the evidence and the limits.** Every view states its source, unit, period, and what the data cannot show. For example, aggregate trade statistics cannot identify an FTZ lot.
- **Global frame, local rules.** Trade comparisons can be global, but FTZ definitions, recordkeeping, and access rights differ by jurisdiction.
- **Human decision.** The workflow is Observe → Investigate → Assess, and the last step is always a person.
- **Clear labeling.** Fictional demo content is labeled as fictional, and real data is labeled with its source and retrieval date.

---

## 4. What the demo does today

The demo is a static React app published on GitHub Pages. It has no login, no backend calls, and no uploads.

| Tab | What it shows | Data |
|---|---|---|
| **Overview** | Welcome briefing, headline counts, a world map of zone-linked review leads, and expandable signal families (value, routing, quantity, sourcing context) | Fictional |
| **Signals** | Screening queue with search and filters (signal type, priority, region), plus a lead detail panel: what was flagged, analyst context, public-data context, and a placeholder for authorized record intake | Fictional |
| **Product watch** | Eight products with a documented history of trade anomalies or enforcement, filterable by risk indication, with mirror-statistics trend charts | **Real** UN Comtrade data plus real public enforcement context |
| **Trade flows** | How reporter, product, and partner comparisons work, with example charts | Synthetic |
| **Saved leads** | Leads saved during the session (not persisted) | Fictional |
| **Data & method** | Source register, method (public screening → review signal → confirm locally), and evidence-discipline notes | Real source links |

The region selector filters the fictional leads. The reporting-period selector is visual only.

### 4a. Product watch method

- **Products and risk indications.** Each product is listed because of public enforcement or guidance, with references shown in the panel:
  - **Solar modules (HS 8541.43):** UFLPA high-priority sector; 2023 U.S. AD/CVD circumvention ruling
  - **Unwrought aluminum (HS 7601):** UFLPA high-priority sector; EAPA duty-evasion investigations
  - **Cotton T-shirts (HS 6109.10):** UFLPA high-priority sector; 2021 Xinjiang Withhold Release Order
  - **Frozen shrimp (HS 0306.17):** UFLPA high-priority sector; AD/CVD orders
  - **Natural honey (HS 0409):** AD duties; transshipment prosecutions
  - **Gold (HS 7108):** FATF trade-based money laundering typology; 3TG conflict mineral
  - **Tin (HS 8001):** 3TG conflict mineral
  - **Tropical sawn timber (HS 4407.29):** Lacey Act
- **Mirror statistics.** For each product, the partner is the largest supplier to the United States in the last full year. Zenith compares what the U.S. reports importing from that partner with what the partner reports exporting to the U.S., month by month over 24 months. The comparison uses the UN Comtrade public API.
- **Gap and flags.** Gap = U.S. imports ÷ partner exports − 1. A month is flagged when the gap is beyond **±25%**.
- **Review band.** **Elevated** means 6 or more of 24 months are flagged, **Review** means 2–5, and **Watch** means 0–1. The band comes from the data, not from editorial judgment.
- **Caveats shown in the UI.** Valuation basis differs (U.S. customs value vs. partner FOB). Shipments cross month boundaries. Re-exports, confidential trade, and classification differences all create gaps. A flag is a reconciliation prompt, not evidence of wrongdoing.
- **Coverage.** Products appear once their data has been fetched. Some partners don't report monthly data to Comtrade, so the script falls back to the next-largest supplier that does.

---

## 5. Data sources

| Source | Status | Role |
|---|---|---|
| UN Comtrade (public API) | **In use** | Monthly mirror statistics for Product watch |
| ITC Trade Map | Referenced | Country/product comparisons. No public API, so it needs account exports to integrate |
| U.S. Census FTZ statistics, USITC DataWeb | Referenced | U.S. aggregate trade and FTZ context |
| 19 CFR Part 146 | Referenced | U.S. FTZ recordkeeping rules |
| DHS UFLPA, CBP EAPA, FATF, OECD, EU Conflict Minerals Regulation, Lacey Act | Referenced | Why a product is on watch |
| **Sayari** | **Planned** | Entity resolution, ownership and control, trade relationships, and risk flags behind each lead |
| Tavily + Claude | Backend only | Web discovery and document extraction in the investigation engine |
| Tradeverifyd | Stub | Optional future trade-verification provider |

---

## 6. Architecture

```
frontend/                 React + Vite + TypeScript static app (the Zenith demo)
  src/App.tsx             Tabs, fictional leads, map, signal workflow
  src/ProductWatch.tsx    Product watch tab and charts (SVG, no chart library)
  src/data/               Committed UN Comtrade snapshot (comtrade-mirror.json)
  scripts/fetch-comtrade.mjs   Builds the snapshot; respects the API quota
docs/                     Built site served by GitHub Pages (npm run build:pages)
backend/                  FastAPI investigation engine (local only, not yet connected to Zenith)
```

Trade data is fetched at build time and committed, so the published site stays static and needs no API keys.

### 6a. Investigation engine (backend)

The backend is the case-level layer that a Zenith lead will eventually hand off to. It runs locally and is not called by the current UI. It:

1. Ingests an uploaded document (sanctions notice, court filing, KYC file, customs record, NGO report) and stores text with page and offset provenance.
2. Extracts companies, people, addresses, identifiers, and goods with Claude, using schema-validated output.
3. Resolves entities and expands the supply chain tier by tier through a provider registry. Tavily is active today, and Sayari and Tradeverifyd are inactive stubs.
4. Scores entities for relevance and risk, with an explainable per-factor breakdown.
5. Serves a tiered graph (Cytoscape JSON) where every node and edge traces back to evidence.

Providers share one interface (capabilities and reliability). When Sayari is implemented and configured, it becomes the primary source for ownership and trade edges, and web search is demoted to news and corroboration. The original detailed build spec for this engine is in git history (commit `cc0f8bf`, `CONCEPT.md`).

---

## 7. Guardrails

- Never present a pattern, score, or flag as an allegation. Use "lead", "signal", and "reconciliation prompt".
- Label fictional, synthetic, and real data distinctly, with source and retrieval date on real data.
- Don't name companies in the demo. Country pairs appear only as factual descriptions of public statistics.
- Case-level records (FTZ admissions, inventory, withdrawals, entries) require authorization and are not uploaded or analyzed in the demo.
- Don't compile personal data about private individuals beyond what appears in an uploaded document or a registry record.
- Keep uploaded documents private to the uploader. The backend has no multi-user isolation yet, so run it on loopback only.

---

## 8. Roadmap

1. **Complete Product watch coverage.** Finish fetching all eight products, then add unit-value checks (value ÷ quantity) and third-country route-shift detection.
2. **Sayari integration.** Implement the provider against Sayari's verified API contract, then attach entity, ownership, and trade-relationship context to leads and products.
3. **Connect the investigation engine.** Let a lead open a backend investigation, and bring the tiered evidence graph (`GraphView.tsx`, currently unused) back into the Zenith UI.
4. **Real leads.** Replace fictional leads with signals generated from real data, keeping the same caveats.
5. **ITC Trade Map imports.** Load account CSV exports for comparisons the Comtrade preview API can't cover.
6. **Working period filter.** Make the reporting-period selector filter data, and persist saved leads.
7. **Authorized record intake.** Access-controlled upload for case records, with jurisdiction-specific FTZ rules.
