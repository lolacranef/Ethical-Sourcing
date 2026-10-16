import comtrade from "./data/comtrade-mirror.json";
import sayari from "./data/sayari-corridors.json";
import tavily from "./data/tavily-developments.json";

export type Indication = "forced-labor" | "duty-evasion" | "tbml" | "conflict" | "illegal-harvest";
export type Band = "Elevated" | "Review" | "Watch";
export type WindowMonths = 24 | 12 | 6 | 3;

export type Product = {
  id: string;
  name: string;
  hs: string;
  indications: Indication[];
  history: string;
  sources: { label: string; href?: string }[];
};

export type Point = { period: string; month: string; reported: number | null; mirror: number | null; gap: number | null; flagged: boolean };
export type MirrorSeries = { retrievedAt?: string; cmdCode: string; partner: { code: number; name: string }; supplierRankYear: string; months: { period: string; reported: number | null; mirror: number | null }[] };
export type Corridor = {
  corridor: { from: string; to: string; hs: string };
  shipments: number;
  suppliers: number;
  coverage?: { earliest: string; latest: string };
  topSupplierShipments?: number[];
  supplierRisk?: Record<string, number>;
  topFlags?: [string, number][];
  coverageGap?: string;
};
export type Development = { date: string | null; title: string; outlet: string; url: string; kind: string; summary: string; reviewed?: boolean };

export type ScoreComponent = { label: string; points: number; max: number; detail: string };
export type LeadMetrics = {
  monthsWithGap: number; flaggedMonths: number; flaggedAbove: number; flaggedBelow: number; medianGap: number | null; latestGap: number | null; latestMonth: string | null; flaggedLastThree: number;
  suppliers: number | null; forcedLaborSuppliers: number | null; topFiveShare: number | null;
  eventsInWindow: number; latestEvent: { title: string; date: string; kind: string } | null;
};
export type Lead = {
  id: string;
  productId: string;
  title: string;
  type: "Mirror gap" | "Supplier risk" | "Policy change";
  corridor: string;
  partner: string;
  region: string;
  coordinates: [number, number];
  product: string;
  code: string;
  period: string;
  score: number;
  components: ScoreComponent[];
  metrics: LeadMetrics;
  plain: { summary: string; nextStep: string };
  change: string;
  severity: Band;
  description: string;
  why: string;
  indicators: string[];
  publicData: string[];
};

// Mirror gaps of this size are common for valuation and timing reasons; larger ones merit reconciliation.
export const GAP_THRESHOLD = 25;
export const WINDOW_OPTIONS: { months: WindowMonths; label: string }[] = [
  { months: 24, label: "Last 24 months" },
  { months: 12, label: "Last 12 months" },
  { months: 6, label: "Last 6 months" },
  { months: 3, label: "Last 3 months" },
];

export const indicationLabels: Record<Indication, string> = {
  "forced-labor": "Forced-labor sourcing risk",
  "duty-evasion": "Duty evasion / transshipment",
  tbml: "Trade-based money laundering",
  conflict: "Conflict-mineral sourcing",
  "illegal-harvest": "Illegal harvest / origin fraud",
};

const uflpa = { label: "DHS · UFLPA", href: "https://www.dhs.gov/uflpa" };
const eapa = { label: "CBP · EAPA duty-evasion investigations", href: "https://www.cbp.gov/trade/trade-enforcement/tftea/eapa" };
const oecdMinerals = { label: "OECD minerals due diligence", href: "https://mneguidelines.oecd.org/mining.htm" };

export const products: Product[] = [
  {
    id: "solar", name: "Solar modules", hs: "HS 8541.43", indications: ["forced-labor", "duty-evasion"],
    history: "Polysilicon, the main input to solar modules, is a UFLPA high-priority sector. In 2023 the U.S. Commerce Department found that certain solar cells and modules completed in Cambodia, Malaysia, Thailand, and Vietnam were circumventing AD/CVD orders on Chinese products. Production then shifted to Indonesia, Laos, and India, which became the subject of new AD/CVD investigations in 2025. Preliminary countervailing duties on Indonesian cells (86–143%) took effect February 26, 2026, with critical circumstances applied to entries about 90 days earlier; final determinations followed in September 2026.",
    sources: [uflpa, { label: "Commerce AD/CVD circumvention ruling (2023)" }, { label: "Commerce CVD preliminary, Indonesia solar cells (Feb 2026)", href: "https://www.govinfo.gov/content/pkg/FR-2026-02-26/pdf/2026-03896.pdf" }],
  },
  {
    id: "aluminum", name: "Unwrought aluminum", hs: "HS 7601", indications: ["forced-labor", "duty-evasion"],
    history: "Aluminum was added as a UFLPA high-priority sector in 2024. Aluminum extrusions are subject to U.S. AD/CVD orders and have been the subject of CBP duty-evasion (EAPA) investigations involving third-country transshipment.",
    sources: [uflpa, eapa],
  },
  {
    id: "cotton", name: "Cotton T-shirts", hs: "HS 6109.10", indications: ["forced-labor"],
    history: "Cotton is a UFLPA high-priority sector. In January 2021 CBP issued a region-wide Withhold Release Order on cotton and tomato products from Xinjiang, which reaches finished apparel made with that cotton.",
    sources: [uflpa],
  },
  {
    id: "seafood", name: "Frozen shrimp", hs: "HS 0306.17", indications: ["forced-labor", "duty-evasion"],
    history: "Seafood was added as a UFLPA high-priority sector in 2024. Shrimp from several countries is subject to U.S. AD/CVD orders, and forced labor on fishing vessels has been documented by the ILO and investigative reporting.",
    sources: [uflpa, { label: "U.S. AD/CVD orders on shrimp" }],
  },
  {
    id: "honey", name: "Natural honey", hs: "HS 0409", indications: ["duty-evasion", "illegal-harvest"],
    history: "U.S. antidumping duties on Chinese honey have applied since 2001. Federal prosecutions around 2013 involved honey transshipped through third countries and mislabeled to evade those duties. Since 2022 a further AD order covers raw honey from Argentina, Brazil, India, and Vietnam.",
    sources: [{ label: "U.S. AD order on honey (2001)" }, { label: "DOJ transshipment cases (2013)" }, { label: "AD orders on raw honey from Argentina, Brazil, India, Vietnam (87 FR 35501, June 2022)" }],
  },
  {
    id: "gold", name: "Gold, unwrought", hs: "HS 7108", indications: ["tbml", "conflict"],
    history: "FATF has identified gold as highly attractive for trade-based money laundering because of its high value-to-weight ratio and cash markets. Gold is also one of the four conflict minerals (3TG) covered by OECD due-diligence guidance.",
    sources: [{ label: "FATF · gold ML/TF risks (2015)", href: "https://www.fatf-gafi.org/" }, oecdMinerals],
  },
  {
    id: "tin", name: "Tin, unwrought", hs: "HS 8001", indications: ["conflict"],
    history: "Tin is one of the 3TG conflict minerals covered by U.S. Dodd-Frank §1502 reporting and the EU Conflict Minerals Regulation (applied from 2021), both built on OECD due-diligence guidance.",
    sources: [{ label: "EU Conflict Minerals Regulation", href: "https://policy.trade.ec.europa.eu/development-and-sustainability/conflict-minerals-regulation_en" }, oecdMinerals],
  },
  {
    id: "timber", name: "Tropical sawn timber", hs: "HS 4407.29", indications: ["illegal-harvest"],
    history: "The U.S. Lacey Act prohibits trade in illegally harvested plant products and requires import declarations for many wood products. The EU applies comparable rules to timber placed on its market.",
    sources: [{ label: "U.S. FWS · Lacey Act", href: "https://www.fws.gov/law/lacey-act" }],
  },
];

export const comtradeGeneratedAt = comtrade.generatedAt;
export const mirrorData = comtrade.products as Record<string, MirrorSeries>;
export const corridorData = sayari.products as unknown as Record<string, Corridor>;
export const sayariGeneratedAt = sayari.generatedAt;
export const riskLabels = sayari.riskLabels as Record<string, string>;
export const flagLabels = sayari.flagLabels as Record<string, string>;
export const tavilyGeneratedAt = tavily.generatedAt;
const allDevelopments = tavily.products as Record<string, Development[]>;

// Items added by the refresh script stay hidden until a person reviews them and removes `"reviewed": false`.
export const developmentsFor = (productId: string) => (allDevelopments[productId] ?? []).filter((item) => item.reviewed !== false && item.date)
  .sort((a, b) => b.date!.localeCompare(a.date!));
export const pendingReviewCount = (productId: string) => (allDevelopments[productId] ?? []).filter((item) => item.reviewed === false).length;

// Partner locations for the lead map. Products from the same partner are nudged apart so markers stay clickable.
const partnerPlaces: Record<string, { region: string; coordinates: Record<string, [number, number]> | [number, number] }> = {
  Indonesia: { region: "Asia-Pacific", coordinates: [113, -1.5] },
  Canada: { region: "Americas", coordinates: [-100, 56] },
  India: { region: "Asia-Pacific", coordinates: { cotton: [76, 24], seafood: [80.5, 16.5], honey: [75, 30] } },
  Switzerland: { region: "Europe", coordinates: [8.2, 46.8] },
  "Bolivia (Plurinational State of)": { region: "Americas", coordinates: [-64.7, -16.5] },
  Brazil: { region: "Americas", coordinates: [-52, -10] },
};

const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
export const monthLabel = (period: string) => `${monthNames[Number(period.slice(5, 7)) - 1]} ’${period.slice(2, 4)}`;
export const shortPartner = (name: string) => name.replace(/ \(.*\)$/, "");
export const formatGap = (gap: number | null) => gap === null ? "—" : `${gap > 0 ? "+" : ""}${gap}%`;
export const formatCount = (value: number) => value.toLocaleString("en-US");
export const formatShare = (part: number, whole: number) => whole ? `${Math.round((part / whole) * 100)}%` : "—";
export const formatDate = (date: string) => new Date(`${date.length === 7 ? `${date}-01` : date}T12:00:00`).toLocaleDateString("en-US", date.length === 7 ? { month: "short", year: "numeric" } : { month: "short", day: "numeric", year: "numeric" });

export function buildSeries(series: MirrorSeries): Point[] {
  return series.months.map(({ period, reported, mirror }) => {
    const gap = reported !== null && mirror ? Math.round(((reported - mirror) / mirror) * 1000) / 10 : null;
    return { period, month: monthLabel(period), reported, mirror, gap, flagged: gap !== null && Math.abs(gap) > GAP_THRESHOLD };
  });
}

export const fullSeries: Record<string, Point[]> = Object.fromEntries(products.filter((product) => mirrorData[product.id]).map((product) => [product.id, buildSeries(mirrorData[product.id])]));
export const windowed = (points: Point[], months: WindowMonths) => points.slice(-months);

// Band thresholds are shares of the window so a 3-month view is judged on the same footing as a 24-month view.
export function reviewBand(points: Point[]): Band {
  const share = points.filter((point) => point.flagged).length / Math.max(1, points.length);
  return share >= 0.25 ? "Elevated" : share >= 1 / 12 ? "Review" : "Watch";
}

const median = (values: number[]) => { const sorted = [...values].sort((a, b) => a - b); return sorted.length ? sorted[Math.floor(sorted.length / 2)] : 0; };

// A transparent 0–100 triage score: it orders analyst attention and is never a probability of wrongdoing.
export function buildLead(product: Product, months: WindowMonths): Lead | null {
  const series = mirrorData[product.id];
  if (!series) return null;
  const points = windowed(fullSeries[product.id], months);
  const partner = shortPartner(series.partner.name);
  const withGap = points.filter((point) => point.gap !== null);
  const flagged = points.filter((point) => point.flagged);
  const latest = withGap.at(-1);
  const lastThree = points.slice(-3).filter((point) => point.flagged).length;
  const corridor = corridorData[product.id];
  const windowStart = points[0].period;
  const recentEvents = developmentsFor(product.id).filter((item) => item.date!.slice(0, 7) >= windowStart);

  const gapPoints = withGap.length ? Math.round((flagged.length / withGap.length) * 40) : 0;
  const recencyPoints = latest?.flagged ? 15 : lastThree ? 8 : 0;
  const forcedShare = corridor && corridor.suppliers ? (corridor.supplierRisk?.forced_labor ?? 0) / corridor.suppliers : 0;
  const thinSample = !!corridor && corridor.suppliers > 0 && corridor.suppliers < 10;
  const supplierPoints = Math.round(forcedShare * 25 * (thinSample ? 0.5 : 1));
  const policyPoints = Math.min(20, recentEvents.length * 10);

  const components: ScoreComponent[] = [
    { label: "Mirror gap", points: gapPoints, max: 40, detail: `${flagged.length} of ${withGap.length} months beyond ±${GAP_THRESHOLD}%` },
    { label: "Recency", points: recencyPoints, max: 15, detail: latest?.flagged ? `Latest month (${latest.month}) is flagged` : lastThree ? `${lastThree} of the last 3 months flagged` : "No flag in the last 3 months" },
    { label: "Supplier risk", points: supplierPoints, max: 25, detail: !corridor || !corridor.suppliers ? "No Sayari trade records for this corridor" : `${formatShare(corridor.supplierRisk?.forced_labor ?? 0, corridor.suppliers)} of ${formatCount(corridor.suppliers)} suppliers carry a forced-labor flag${thinSample ? " (fewer than 10 suppliers, weight halved)" : ""}` },
    { label: "Policy activity", points: policyPoints, max: 20, detail: recentEvents.length ? `${recentEvents.length} ruling${recentEvents.length > 1 ? "s" : ""} or enforcement action${recentEvents.length > 1 ? "s" : ""} since ${monthLabel(windowStart)}` : `No captured ruling since ${monthLabel(windowStart)}` },
  ];
  const score = components.reduce((sum, component) => sum + component.points, 0);
  const severity: Band = score >= 75 ? "Elevated" : score >= 45 ? "Review" : "Watch";
  // Trade-data signals name the lead before news does; a policy event alone only leads when the data is quiet.
  const type: Lead["type"] = (gapPoints + recencyPoints) / 55 >= 0.4 ? "Mirror gap" : supplierPoints / 25 >= 0.5 ? "Supplier risk" : policyPoints ? "Policy change" : "Mirror gap";
  const medianGap = median(withGap.map((point) => point.gap!));
  const direction = medianGap >= 0 ? `U.S.-recorded imports run above ${partner}’s reported exports` : `${partner} reports more exports than the U.S. records as imports`;
  const latestEvent = recentEvents[0];
  let metrics: LeadMetrics;

  const title = type === "Mirror gap" ? `${direction}` : type === "Supplier risk" ? `Supplier base carries forced-labor exposure flags` : latestEvent?.title ?? "New trade-remedy or enforcement action";
  const description = [
    flagged.length ? `${flagged.length} of ${withGap.length} months in the window show a mirror gap beyond ±${GAP_THRESHOLD}% (median ${formatGap(Math.round(medianGap * 10) / 10)}).` : `No month in the window shows a mirror gap beyond ±${GAP_THRESHOLD}%.`,
    corridor?.coverageGap ? "Sayari holds no shipment records for this corridor." : corridor ? `Sayari holds ${formatCount(corridor.shipments)} shipment records from ${formatCount(corridor.suppliers)} suppliers on this route.` : "",
    latestEvent ? `Most recent development: ${latestEvent.title} (${formatDate(latestEvent.date!)}).` : "",
  ].filter(Boolean).join(" ");
  const why = type === "Mirror gap"
    ? "Valuation bases (customs value vs. FOB), shipping time across month ends, re-exports, and classification differences all produce gaps. Reconcile classification and routing, then check unit values, before treating the gap as unexplained."
    : type === "Supplier risk"
      ? "Sayari flags describe supplier entities and often come from country-and-product listings or sub-tier links, not these shipments. Use them to decide which suppliers to ask for origin and labor documentation."
      : "A new ruling or tariff changes incentives: watch for import surges ahead of duties, sudden partner shifts, or origin changes in the following months. A policy event alone is not evidence about any shipment.";

  return {
    id: `ZW-${product.id.toUpperCase()}`, productId: product.id, title, type, corridor: `${partner} → U.S.`, partner,
    region: partnerPlaces[series.partner.name]?.region ?? "Other",
    coordinates: (() => { const place = partnerPlaces[series.partner.name]?.coordinates; return Array.isArray(place) ? place : place?.[product.id] ?? [0, 0]; })(),
    product: product.name, code: product.hs, period: `${points[0].month} – ${points.at(-1)!.month}`, score, components,
    metrics: (metrics = {
      monthsWithGap: withGap.length, flaggedMonths: flagged.length, flaggedAbove: flagged.filter((point) => point.gap! > 0).length, flaggedBelow: flagged.filter((point) => point.gap! < 0).length, medianGap: withGap.length ? Math.round(medianGap * 10) / 10 : null, latestGap: latest?.gap ?? null, latestMonth: latest?.month ?? null, flaggedLastThree: lastThree,
      suppliers: corridor && corridor.suppliers ? corridor.suppliers : null, forcedLaborSuppliers: corridor && corridor.suppliers ? corridor.supplierRisk?.forced_labor ?? 0 : null,
      topFiveShare: corridor?.topSupplierShipments && corridor.shipments ? Math.round((corridor.topSupplierShipments.reduce((sum, count) => sum + count, 0) / corridor.shipments) * 100) : null,
      eventsInWindow: recentEvents.length, latestEvent: latestEvent ? { title: latestEvent.title, date: latestEvent.date!, kind: latestEvent.kind } : null,
    }),
    plain: plainLanguage(type, everyday[product.id] ?? product.name.toLowerCase(), partner, metrics, windowStart),
    change: latest ? `Latest gap ${formatGap(latest.gap)}` : "No recent gap data", severity, description, why,
    indicators: [
      `${flagged.length}/${withGap.length} months flagged`,
      ...(corridor && corridor.suppliers ? [`${formatShare(corridor.supplierRisk?.forced_labor ?? 0, corridor.suppliers)} suppliers FL-flagged`] : ["No Sayari records"]),
      ...(recentEvents.length ? [`${recentEvents.length} recent ruling${recentEvents.length > 1 ? "s" : ""}`] : []),
    ],
    publicData: ["UN Comtrade", ...(corridor && corridor.suppliers ? ["Sayari trade records"] : []), ...(recentEvents.length ? ["Tavily news"] : [])],
  };
}

const everyday: Record<string, string> = { solar: "solar modules", aluminum: "aluminum", cotton: "cotton T-shirts", seafood: "shrimp", honey: "honey", gold: "gold", tin: "tin", timber: "tropical timber" };

// Everyday-language version of a lead, built from the same numbers as the score.
function plainLanguage(type: Lead["type"], goods: string, partner: string, metrics: LeadMetrics, windowStart: string) {
  const size = (gap: number) => gap >= 100 ? `about ${(1 + gap / 100).toFixed(1)} times what ${partner} reports shipping` : gap >= 0 ? `about ${Math.round(gap)}% more than ${partner} reports shipping` : `about ${Math.round(-gap)}% less than ${partner} reports shipping`;
  // A single month the other way is noise; "both ways" needs at least two in each direction.
  const bothWays = Math.min(metrics.flaggedAbove, metrics.flaggedBelow) >= 2;
  const structural = metrics.flaggedMonths === metrics.monthsWithGap && Math.abs(metrics.medianGap ?? 0) >= 50;
  const trade = metrics.flaggedMonths === 0
    ? `U.S. and ${partner} records of ${goods} trade agree closely in every month.`
    : `In ${metrics.flaggedMonths} of ${metrics.monthsWithGap} months, U.S. and ${partner} records of ${goods} trade disagreed by more than 25%. ` + (bothWays
      ? `The gaps went both ways: in ${metrics.flaggedAbove} of those months the U.S. recorded more, in ${metrics.flaggedBelow} less. In the latest month (${metrics.latestMonth}) it recorded ${size(metrics.latestGap ?? 0)}.`
      : `Typically the U.S. recorded ${size(metrics.medianGap ?? 0)}.`);
  const flaggedCount = metrics.forcedLaborSuppliers ?? 0;
  const share = metrics.suppliers ? Math.round((flaggedCount / metrics.suppliers) * 100) : 0;
  const suppliers = metrics.suppliers === null
    ? "No shipping records are available to check the companies involved."
    : metrics.suppliers < 10
      ? `${flaggedCount === metrics.suppliers ? (metrics.suppliers === 2 ? "Both" : "All") : flaggedCount} of the ${metrics.suppliers} companies shipping it carry a forced-labor warning flag. With so few companies, this says little about the trade as a whole.`
      : `${share >= 50 ? "Most" : share >= 20 ? "Some" : "Few"} of the ${formatCount(metrics.suppliers)} companies shipping it (${share}%) carry a forced-labor warning flag${share >= 20 ? ", often because the product and country are on official watch lists rather than anything a company did" : ""}.`;
  const policy = metrics.eventsInWindow
    ? `The government has acted on this product ${metrics.eventsInWindow === 1 ? "once" : `${metrics.eventsInWindow} times`} since ${monthLabel(windowStart)}, most recently: ${metrics.latestEvent!.title}.`
    : "";
  const nextStep = type === "Mirror gap"
    ? structural
      ? "A gap this large in every month usually means the two countries file the goods under different product codes. Confirm that first."
      : bothWays
        ? "Look at the months where the direction changed and what happened then, such as a new duty or a change in shipping route."
        : "Start by checking whether both countries use the same product code and shipping route, since that explains many gaps."
    : type === "Supplier risk"
      ? "Start by asking the largest suppliers for documents showing where materials came from and how workers were treated."
      : "Watch the next few months of trade data for sudden jumps, drops, or new supplying countries.";
  return { summary: [trade, suppliers, policy].filter(Boolean).join(" "), nextStep };
}

export const buildLeads = (months: WindowMonths) => products.map((product) => buildLead(product, months)).filter((lead): lead is Lead => lead !== null).sort((a, b) => b.score - a.score);
