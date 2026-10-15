// Builds src/data/comtrade-mirror.json from the keyless UN Comtrade preview API.
// For each watched product: find the largest supplier to the United States, then pull
// 24 months of U.S.-reported imports from that partner and the partner's reported exports
// to the United States (mirror statistics). Run with `npm run data:comtrade`.
// Products already in the output file are kept; pass --refresh to fetch everything again.
// The keyless API has a call quota, so the script waits out quota errors instead of failing.
import { readFile, writeFile, mkdir } from "node:fs/promises";

const API = "https://comtradeapi.un.org/public/v1/preview/C";
const NAMES_URL = "https://comtradeapi.un.org/files/v1/app/reference/partnerAreas.json";
const USA = 842;
const MONTHS = 24;
const PAUSE_MS = 1300;
const OUT = new URL("../src/data/comtrade-mirror.json", import.meta.url);

const products = [
  { id: "solar", cmdCode: "854143" },
  { id: "aluminum", cmdCode: "7601" },
  { id: "cotton", cmdCode: "610910" },
  { id: "seafood", cmdCode: "030617" },
  { id: "honey", cmdCode: "0409" },
  { id: "gold", cmdCode: "7108" },
  { id: "tin", cmdCode: "8001" },
  { id: "timber", cmdCode: "440729" },
];

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function query(path, params) {
  const url = `${API}/${path}?${new URLSearchParams(params)}`;
  for (let attempt = 0; attempt < 8; attempt++) {
    await sleep(PAUSE_MS * (attempt + 1));
    const response = await fetch(url).catch((error) => { console.log(`  network error (${error.cause?.code ?? error.message}), retrying`); return null; });
    if (!response) continue;
    if (response.status === 403 || response.status === 429) {
      const wait = Number(response.headers.get("retry-after") ?? 60) + 5;
      console.log(`  quota reached, waiting ${Math.ceil(wait / 60)} min`);
      await sleep(wait * 1000);
      continue;
    }
    if (response.status >= 500) continue;
    if (!response.ok) throw new Error(`HTTP ${response.status} (${url})`);
    const body = await response.json();
    if (body.error) throw new Error(`${body.error} (${url})`);
    // Keep only the all-customs-procedure, all-transport-mode totals.
    return (body.data ?? []).filter((row) => row.customsCode === "C00" && row.motCode === 0 && row.partner2Code === 0);
  }
  throw new Error(`Comtrade kept refusing ${url}`);
}

function monthsBefore(period, count) {
  const year = Number(period.slice(0, 4)), month = Number(period.slice(4));
  return Array.from({ length: count }, (_, index) => {
    const date = new Date(Date.UTC(year, month - 1 - index, 1));
    return `${date.getUTCFullYear()}${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
  }).reverse();
}

async function mirrorMonth(cmdCode, partner, period) {
  const rows = await query("M/HS", { reporterCode: `${USA},${partner}`, partnerCode: `${partner},${USA}`, period, cmdCode, flowCode: "M,X" });
  const value = (reporter, flow, partnerCode) => rows.find((row) => row.reporterCode === reporter && row.flowCode === flow && row.partnerCode === partnerCode)?.primaryValue ?? null;
  return { reported: value(USA, "M", partner), mirror: value(partner, "X", USA) };
}

async function topSuppliers(cmdCode, year) {
  const rows = await query("A/HS", { reporterCode: USA, period: year, cmdCode, flowCode: "M" });
  return rows.filter((row) => row.partnerCode !== 0 && row.partnerCode < 900).sort((a, b) => b.primaryValue - a.primaryValue).map((row) => ({ code: row.partnerCode, annualValue: row.primaryValue }));
}

const names = Object.fromEntries((await (await fetch(NAMES_URL)).json()).results.map((area) => [area.id, area.text]));
const now = new Date();
const probeStart = `${now.getUTCFullYear()}${String(now.getUTCMonth() + 1).padStart(2, "0")}`;
const lastFullYear = String(now.getUTCFullYear() - 1);
const refresh = process.argv.includes("--refresh");
const previous = refresh ? null : await readFile(OUT, "utf8").then(JSON.parse).catch(() => null);
const result = { generatedAt: now.toISOString(), source: "UN Comtrade (comtradeapi.un.org, public preview)", reporter: "United States", products: { ...previous?.products } };

// Latest month the United States has reported, found once and shared by every product.
let end = null;
for (const period of monthsBefore(probeStart, 8).reverse()) {
  if ((await query("M/HS", { reporterCode: USA, partnerCode: 0, period, cmdCode: "TOTAL", flowCode: "M" })).length) { end = period; break; }
}
if (!end) throw new Error("Could not find a recent month of U.S. data");
console.log(`Window ends ${end}`);

for (const product of products) {
  if (result.products[product.id]) { console.log(`${product.id}: kept from previous run`); continue; }
  const suppliers = await topSuppliers(product.cmdCode, lastFullYear);
  let chosen = null;
  for (const supplier of suppliers.slice(0, 6)) {
    // Many partners report monthly data with a lag, so accept the latest month or three months earlier.
    for (const period of [end, monthsBefore(end, 4)[0]]) {
      const values = await mirrorMonth(product.cmdCode, supplier.code, period);
      if (values.reported !== null && values.mirror !== null) { chosen = { supplier, end: period, endValues: values }; break; }
    }
    if (chosen) break;
    console.warn(`  ${product.id}: ${names[supplier.code] ?? supplier.code} has no recent monthly mirror data, trying next supplier`);
  }
  if (!chosen) { console.warn(`${product.id}: no usable partner, skipped`); continue; }

  const periods = monthsBefore(chosen.end, MONTHS);
  const months = [];
  for (const period of periods) {
    const values = period === chosen.end ? chosen.endValues : await mirrorMonth(product.cmdCode, chosen.supplier.code, period);
    months.push({ period: `${period.slice(0, 4)}-${period.slice(4)}`, ...values });
  }
  result.products[product.id] = { retrievedAt: now.toISOString(), cmdCode: product.cmdCode, partner: { code: chosen.supplier.code, name: names[chosen.supplier.code] ?? String(chosen.supplier.code) }, supplierRankYear: lastFullYear, months };
  console.log(`${product.id}: ${result.products[product.id].partner.name}, ${months[0].period} to ${months[months.length - 1].period}`);
  // Save after each product so a long quota wait never loses finished work.
  await mkdir(new URL(".", OUT), { recursive: true });
  await writeFile(OUT, `${JSON.stringify(result, null, 2)}\n`);
}

await mkdir(new URL(".", OUT), { recursive: true });
await writeFile(OUT, `${JSON.stringify(result, null, 2)}\n`);
console.log(`Wrote ${decodeURIComponent(OUT.pathname)}`);
