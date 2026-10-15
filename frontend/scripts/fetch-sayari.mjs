// Builds src/data/sayari-corridors.json from the Sayari Graph trade-search API.
// For each Product watch corridor (Comtrade partner -> United States, same HS code) it stores
// aggregates only: shipment-record count, distinct supplier count, the top five suppliers'
// shipment counts, and how many suppliers carry each category of Sayari risk flag.
// No entity name or ID is written. Run with `npm run data:sayari`.
//
// Needs SAYARI_CLIENT_ID and SAYARI_CLIENT_SECRET, read from the environment or the repo-root .env.
// Endpoints follow documentation.sayari.com (POST /oauth/token, POST /v1/trade/search/{shipments,suppliers}).
// The docs do not show the wrapper key for facet results, so the script looks for `facets` or
// `aggregations` and stops with a clear error if neither is present.
import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const API = "https://api.sayari.com";
const OUT = new URL("../src/data/sayari-corridors.json", import.meta.url);
const COMTRADE = new URL("../src/data/comtrade-mirror.json", import.meta.url);
const PAUSE_MS = 600;

// Comtrade partner codes (M49, with Comtrade's own codes for India and Switzerland) to ISO alpha-3.
const ISO3 = { 360: "IDN", 124: "CAN", 699: "IND", 356: "IND", 757: "CHE", 756: "CHE", 68: "BOL", 76: "BRA" };

// Checked in order; a flag key joins the first category whose pattern it matches.
const CATEGORIES = [
  ["forced_labor", /forced_labor|ilab|uflpa|xinjiang|aspi|sheffield/],
  ["sanctions", /sanction/],
  ["export_controls", /export_control|meu_list|entity_list/],
  ["regulatory_action", /regulatory_action|law_enforcement/],
  ["shell_company_risk", /mass_address|mass_business|shell/],
  ["political_exposure", /soe|pep|state_owned|political/],
  ["environmental_risk", /eudr|esg|environment|deforest/],
  ["adverse_media", /adverse_media/],
];

try { process.loadEnvFile(fileURLToPath(new URL("../../.env", import.meta.url))); } catch { /* no .env file; use the environment */ }
const { SAYARI_CLIENT_ID, SAYARI_CLIENT_SECRET } = process.env;
if (!SAYARI_CLIENT_ID || !SAYARI_CLIENT_SECRET) {
  console.error("Set SAYARI_CLIENT_ID and SAYARI_CLIENT_SECRET (environment or repo-root .env).");
  process.exit(1);
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function request(path, body, token) {
  for (let attempt = 0; attempt < 6; attempt++) {
    await sleep(PAUSE_MS * (attempt + 1));
    const response = await fetch(`${API}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: JSON.stringify(body),
    }).catch((error) => { console.log(`  network error (${error.cause?.code ?? error.message}), retrying`); return null; });
    if (!response) continue;
    if (response.status === 429) {
      const wait = Number(response.headers.get("retry-after") ?? 30) + 2;
      console.log(`  rate limited, waiting ${wait}s`);
      await sleep(wait * 1000);
      continue;
    }
    if (!response.ok) throw new Error(`${path} returned ${response.status}: ${(await response.text()).slice(0, 300)}`);
    return response.json();
  }
  throw new Error(`${path} failed after retries`);
}

const facetsOf = (result) => {
  const facets = result.facets ?? result.aggregations;
  if (!facets) throw new Error(`No facets in response (top-level keys: ${Object.keys(result).join(", ")}). Check the Sayari response schema.`);
  return facets;
};
const buckets = (facets, name) => (facets[name]?.buckets ?? facets[name] ?? []).map((bucket) => ({ key: String(bucket.key), count: bucket.doc_count ?? bucket.count ?? 0 }));
const countOf = (result) => result.size?.count ?? 0;

const { access_token: token } = await request("/oauth/token", { client_id: SAYARI_CLIENT_ID, client_secret: SAYARI_CLIENT_SECRET, audience: "sayari.com", grant_type: "client_credentials" });
const comtrade = JSON.parse(await readFile(COMTRADE, "utf8"));
const previous = JSON.parse(await readFile(OUT, "utf8"));
const products = { ...previous.products };

for (const [id, series] of Object.entries(comtrade.products)) {
  const from = ISO3[series.partner.code];
  if (!from) { console.log(`${id}: no ISO3 code for Comtrade partner ${series.partner.code} (${series.partner.name}); add it to ISO3 and rerun`); continue; }
  console.log(`${id}: ${from} -> USA, HS ${series.cmdCode}`);
  const filter = { departure_country: [from], arrival_country: ["USA"], hs_code: [series.cmdCode] };

  const shipments = await request("/v1/trade/search/shipments?limit=1", { filter, facets: true }, token);
  const shipmentFacets = facetsOf(shipments);
  // Searches cap exact counts at 10,000; the departure-country bucket carries the full count.
  const departureBucket = buckets(shipmentFacets, "departure_country").find((bucket) => bucket.key === from);
  const shipmentCount = shipments.size?.qualifier === "gte" && departureBucket ? departureBucket.count : countOf(shipments);
  const topSupplierShipments = buckets(shipmentFacets, "top_suppliers").slice(0, 5).map((bucket) => bucket.count);

  if (!shipmentCount) {
    products[id] = { corridor: { from, to: "USA", hs: series.cmdCode }, shipments: 0, suppliers: 0, coverageGap: previous.products[id]?.coverageGap ?? "Sayari holds no shipment records for this corridor." };
    continue;
  }

  const suppliers = await request("/v1/trade/search/suppliers?limit=1", { filter, facets: true }, token);
  const flagBuckets = buckets(facetsOf(suppliers), "supplier_risk");
  const supplierRisk = {};
  for (const [category, pattern] of CATEGORIES) {
    const keys = flagBuckets.map((bucket) => bucket.key).filter((key) => CATEGORIES.find(([, test]) => test.test(key))?.[0] === category);
    supplierRisk[category] = keys.length ? countOf(await request("/v1/trade/search/suppliers?limit=1", { filter: { ...filter, supplier_risk: keys } }, token)) : 0;
  }
  // "psa_" flags repeat a flag through possibly-same-as links, so the list shows the direct version only.
  const topFlags = flagBuckets.filter((bucket) => !bucket.key.startsWith("psa_") && previous.flagLabels[bucket.key]).sort((a, b) => b.count - a.count).slice(0, 4).map((bucket) => [bucket.key, bucket.count]);

  products[id] = {
    corridor: { from, to: "USA", hs: series.cmdCode },
    shipments: shipmentCount,
    // Record dates are not part of the documented facets, so the previous coverage window is kept.
    ...(previous.products[id]?.coverage ? { coverage: previous.products[id].coverage } : {}),
    suppliers: countOf(suppliers),
    topSupplierShipments,
    supplierRisk,
    topFlags,
  };
  console.log(`  ${shipmentCount} shipments, ${countOf(suppliers)} suppliers, forced-labor flagged ${supplierRisk.forced_labor}`);
}

const result = { ...previous, source: "Sayari Graph trade search API (bills of lading and customs records), via scripts/fetch-sayari.mjs", generatedAt: new Date().toISOString().slice(0, 10), products };
await writeFile(OUT, `${JSON.stringify(result, null, 2)}\n`);
console.log(`Wrote ${fileURLToPath(OUT)}`);
