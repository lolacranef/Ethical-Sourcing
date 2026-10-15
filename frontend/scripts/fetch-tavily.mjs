// Adds new search results to src/data/tavily-developments.json using the Tavily search API.
// Each watched product has a few queries about rulings, tariffs, and enforcement. Results whose URL
// is not already in the file are appended with "reviewed": false, and the UI hides them until a
// person checks the source, sets the date, kind, and summary, and deletes the "reviewed" line.
// Existing items are never changed. Run with `npm run data:tavily`; pass --days=N to look back
// N days (default: since the file's generatedAt date).
//
// Needs TAVILY_API_KEY, read from the environment or the repo-root .env.
import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const API = "https://api.tavily.com/search";
const OUT = new URL("../src/data/tavily-developments.json", import.meta.url);
const PAUSE_MS = 3500;
const PER_QUERY = 5;

const queries = {
  solar: ["Indonesia solar cells antidumping countervailing duty order", "solar modules UFLPA detention polysilicon CBP"],
  aluminum: ["aluminum UFLPA entity list forced labor", "Canada aluminum tariff Section 232 Section 338"],
  cotton: ["cotton apparel UFLPA detentions CBP", "India garment exports United States forced labor"],
  seafood: ["India frozen shrimp antidumping administrative review", "seafood forced labor import ban CBP"],
  honey: ["raw honey antidumping India administrative review", "honey transshipment adulteration enforcement"],
  gold: ["Switzerland gold exports United States tariff", "gold refinery due diligence money laundering enforcement"],
  tin: ["tin conflict minerals smelter due diligence", "Bolivia tin exports"],
  timber: ["Brazil timber Lacey Act illegal logging enforcement", "Brazil Section 301 tariff wood products"],
};

try { process.loadEnvFile(fileURLToPath(new URL("../../.env", import.meta.url))); } catch { /* no .env file; use the environment */ }
const { TAVILY_API_KEY } = process.env;
if (!TAVILY_API_KEY) {
  console.error("Set TAVILY_API_KEY (environment or repo-root .env).");
  process.exit(1);
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function search(query, startDate) {
  for (let attempt = 0; attempt < 6; attempt++) {
    await sleep(PAUSE_MS * (attempt + 1));
    const response = await fetch(API, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${TAVILY_API_KEY}` },
      body: JSON.stringify({ query, search_depth: "advanced", max_results: PER_QUERY, start_date: startDate, include_published_date: true }),
    }).catch((error) => { console.log(`  network error (${error.cause?.code ?? error.message}), retrying`); return null; });
    if (!response) continue;
    if (response.status === 429) {
      const wait = Number(response.headers.get("retry-after") ?? 60) + 2;
      console.log(`  rate limited, waiting ${wait}s`);
      await sleep(wait * 1000);
      continue;
    }
    if (!response.ok) throw new Error(`Tavily returned ${response.status}: ${(await response.text()).slice(0, 300)}`);
    return (await response.json()).results ?? [];
  }
  throw new Error(`Search failed after retries: ${query}`);
}

const isoDate = (value) => { const date = value ? new Date(value) : null; return date && !Number.isNaN(date.valueOf()) ? date.toISOString().slice(0, 10) : null; };
// Snippets can run long; keep whole sentences up to about 280 characters.
const trimSummary = (text) => { const clean = (text ?? "").replace(/\s+/g, " ").trim(); if (clean.length <= 280) return clean; const cut = clean.slice(0, 280); return `${cut.slice(0, Math.max(cut.lastIndexOf(". ") + 1, 200))}…`; };

const data = JSON.parse(await readFile(OUT, "utf8"));
const daysArg = process.argv.find((arg) => arg.startsWith("--days="));
const startDate = daysArg ? new Date(Date.now() - Number(daysArg.slice(7)) * 864e5).toISOString().slice(0, 10) : data.generatedAt;
let added = 0;

for (const [id, list] of Object.entries(queries)) {
  const items = data.products[id] ?? (data.products[id] = []);
  const known = new Set(items.map((item) => item.url));
  for (const query of list) {
    console.log(`${id}: ${query}`);
    for (const result of await search(query, startDate)) {
      if (!result.url || known.has(result.url)) continue;
      known.add(result.url);
      items.push({ date: isoDate(result.published_date), title: result.title ?? result.url, outlet: new URL(result.url).hostname.replace(/^www\./, ""), url: result.url, kind: "Unreviewed", summary: trimSummary(result.content), reviewed: false });
      added++;
    }
  }
}

data.generatedAt = new Date().toISOString().slice(0, 10);
await writeFile(OUT, `${JSON.stringify(data, null, 2)}\n`);
console.log(`Added ${added} unreviewed result${added === 1 ? "" : "s"} since ${startDate}. Review them in ${fileURLToPath(OUT)}: confirm the source, set date, kind, and summary, then delete "reviewed": false to publish.`);
