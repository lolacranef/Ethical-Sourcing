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
| **Overview** | Welcome briefing, headline counts, a world map of review leads on each corridor's partner country, and expandable lead types (mirror gap, supplier risk, policy change) | **Real**, generated from Product watch data |
| **Signals** | Screening queue with search and filters (lead type, priority, region), plus a lead detail panel: score breakdown, what was flagged, analyst context, sources, a link into Product watch, and a placeholder for authorized record intake | **Real**, generated from Product watch data |
| **Product watch** | Eight products with a documented history of trade anomalies or enforcement, filterable by risk indication, with mirror-statistics trend charts marked with ruling and tariff dates, plus Sayari and Tavily corridor intelligence | **Real** UN Comtrade, Sayari, and Tavily data plus public enforcement context |
| **Trade flows** | How reporter, product, and partner comparisons work, with example charts | Synthetic |
| **Saved leads** | Leads you saved, kept in browser storage | Real |
| **Data & method** | Source register, method (public screening → review signal → confirm locally), and evidence-discipline notes | Real source links |

The region selector filters leads. The reporting-period selector (24, 12, 6, or 3 months) sets the window for the charts, product bands, and lead scores.

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
- **Review band.** **Elevated** means at least a quarter of the months in the selected window are flagged, **Review** means at least one in twelve, and **Watch** means fewer. Over 24 months that is 6+, 2–5, and 0–1 flagged months. The band comes from the data, not from editorial judgment.
- **Event markers.** Reviewed Tavily developments appear as diamonds on the month they fall in. Developments after the latest trade month are listed under the chart as not yet reflected in trade data.
- **Caveats shown in the UI.** Valuation basis differs (U.S. customs value vs. partner FOB). Shipments cross month boundaries. Re-exports, confidential trade, and classification differences all create gaps. A flag is a reconciliation prompt, not evidence of wrongdoing.
- **Coverage.** Products appear once their data has been fetched. Some partners don't report monthly data to Comtrade, so the script falls back to the next-largest supplier that does.

### 4b. Lead scoring

Each Product watch corridor becomes one review lead, recomputed whenever the period changes. The 0–100 score is the sum of four parts, and each part is shown with its reason in the lead panel:

| Part | Max | Rule |
|---|---|---|
| Mirror gap | 40 | Share of months in the window with a gap beyond ±25%, × 40 |
| Recency | 15 | 15 if the latest month is flagged, 8 if any of the last three are, else 0 |
| Supplier risk | 25 | Share of Sayari suppliers with a forced-labor-category flag, × 25. Halved when fewer than 10 suppliers |
| Policy activity | 20 | 10 per reviewed ruling or enforcement item dated since the window start, up to 20 |

- **Bands.** Elevated means 75 or more, Review 45–74, Watch below 45.
- **Lead type.** The type names the main driver. Trade-data signals come first: mirror gap if gap and recency reach 40% of their 55 points, then supplier risk if it reaches half its points. Policy change applies only when the data is quiet.
- **Weights are judgment calls.** They order analyst attention, and the parts are shown so a reviewer can discount any of them. The score is never a probability of wrongdoing.

---

## 5. Data sources

| Source | Status | Role |
|---|---|---|
| UN Comtrade (public API) | **In use** | Monthly mirror statistics for Product watch |
| ITC Trade Map | Referenced | Country/product comparisons. No public API, so it needs account exports to integrate |
| U.S. Census FTZ statistics, USITC DataWeb | Referenced | U.S. aggregate trade and FTZ context |
| 19 CFR Part 146 | Referenced | U.S. FTZ recordkeeping rules |
| DHS UFLPA, CBP EAPA, FATF, OECD, EU Conflict Minerals Regulation, Lacey Act | Referenced | Why a product is on watch |
| **Sayari** (trade facets) | **In use** (snapshot + `npm run data:sayari`) | Product watch corridor intelligence: shipment-record and supplier counts, supplier concentration, and supplier risk-flag categories. Aggregates only, with no company named |
| **Tavily** (web search) | **In use** (snapshot + `npm run data:tavily`, human review before publish) | Product watch recent developments: trade-remedy rulings, tariff actions, and forced-labor enforcement, each linked to its source |
| Sayari (entity graph) | Planned | Entity resolution, ownership and control behind case-level investigations |
| Tavily + Claude | Backend | Web discovery and document extraction in the investigation engine |
| Tradeverifyd | Stub | Optional future trade-verification provider |

---

## 6. Architecture

```
frontend/                 React + Vite + TypeScript static app (the Zenith demo)
  src/App.tsx             Tabs, fictional leads, map, signal workflow
  src/ProductWatch.tsx    Product watch tab and charts (SVG, no chart library)
  src/data/               Committed snapshots: UN Comtrade (comtrade-mirror.json), Sayari corridor
                          facets (sayari-corridors.json), Tavily developments (tavily-developments.json)
  src/data.ts             Shared data layer: series, windows, events, lead scoring
  scripts/fetch-comtrade.mjs   Builds the Comtrade snapshot; respects the API quota
  scripts/fetch-sayari.mjs     Refreshes Sayari corridor aggregates (needs Sayari API credentials)
  scripts/fetch-tavily.mjs     Appends new Tavily results for human review (needs a Tavily key)
docs/                     Built site served by GitHub Pages (npm run build:pages)
backend/                  FastAPI investigation engine (local only, not yet connected to Zenith)
```

Trade data is fetched at build time and committed, so the published site stays static and needs no API keys. The Sayari and Tavily snapshots were first pulled through their MCP connectors on October 15, 2026. They are refreshed with their scripts, and new Tavily items stay hidden until reviewed.

### 6a. Corridor intelligence method

For each Product watch corridor (partner → U.S., same HS code as the Comtrade series), Zenith queries Sayari's trade search facets for shipment records and for suppliers. It stores only aggregates: record count, distinct supplier count, the top-five suppliers' share of records, the earliest and latest record dates, and the number of suppliers carrying each risk-flag category.

- **Facet counts span all records Sayari holds.** Date filters are not applied to facet aggregates, so the panel shows a coverage window, not a 12-month figure.
- **Risk flags describe supplier entities.** A flag can come from sub-tier links (UFLPA, Sheffield Hallam, Xinjiang), from a country-and-product listing (U.S. DOL ILAB lists), or from activity in other products. That is why honey suppliers can carry a wood-deforestation flag.
- **Coverage gaps are shown, not hidden.** Gold from Switzerland returns no records because it moves by air and courier. Bolivian tin records end in December 2024.
- **The transit-country facet is excluded.** Its counts track individual data sources, not routing, so it can't support a transshipment reading.

Tavily items are chosen to favor official notices (Federal Register, USTR, CRS) and specialist trade-law or industry sources. Summaries are written from the search snippets.

### 6b. Investigation engine (backend)

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
2. **Sayari integration.** Corridor aggregates ship with a refresh script (to be verified against the live API). Next: month-by-month record counts to set against mirror gaps, and the backend provider for entity, ownership, and trade-relationship context in case work.
3. **Connect the investigation engine.** Let a lead open a backend investigation, and bring the tiered evidence graph (`GraphView.tsx`, currently unused) back into the Zenith UI.
4. **ITC Trade Map imports.** Load account CSV exports for comparisons the Comtrade preview API can't cover.
5. **Real Trade flows.** Replace the synthetic Trade flows charts with sourced statistics.
6. **Authorized record intake.** Access-controlled upload for case records, with jurisdiction-specific FTZ rules.
