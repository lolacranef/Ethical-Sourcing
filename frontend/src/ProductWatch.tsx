import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowRight, Database, ExternalLink, Flag, History, TriangleAlert } from "lucide-react";
import comtrade from "./data/comtrade-mirror.json";

type Indication = "forced-labor" | "duty-evasion" | "tbml" | "conflict" | "illegal-harvest";
type Band = "Elevated" | "Review" | "Watch";

type Product = {
  id: string;
  name: string;
  hs: string;
  signalCode?: string;
  indications: Indication[];
  history: string;
  sources: { label: string; href?: string }[];
};

type Point = { month: string; reported: number | null; mirror: number | null; gap: number | null; flagged: boolean };
type MirrorSeries = { retrievedAt?: string; cmdCode: string; partner: { code: number; name: string }; supplierRankYear: string; months: { period: string; reported: number | null; mirror: number | null }[] };

// Mirror gaps of this size are common for valuation and timing reasons; larger ones merit reconciliation.
const GAP_THRESHOLD = 25;
const SERIES_COLORS = { reported: "#008574", mirror: "#a8692a" };

const indicationLabels: Record<Indication, string> = {
  "forced-labor": "Forced-labor sourcing risk",
  "duty-evasion": "Duty evasion / transshipment",
  tbml: "Trade-based money laundering",
  conflict: "Conflict-mineral sourcing",
  "illegal-harvest": "Illegal harvest / origin fraud",
};

const uflpa = { label: "DHS · UFLPA", href: "https://www.dhs.gov/uflpa" };
const eapa = { label: "CBP · EAPA duty-evasion investigations", href: "https://www.cbp.gov/trade/trade-enforcement/tftea/eapa" };
const oecdMinerals = { label: "OECD minerals due diligence", href: "https://mneguidelines.oecd.org/mining.htm" };

const products: Product[] = [
  {
    id: "solar", name: "Solar modules", hs: "HS 8541.43", signalCode: "HS 8541", indications: ["forced-labor", "duty-evasion"],
    history: "Polysilicon, the main input to solar modules, is a UFLPA high-priority sector. In 2023 the U.S. Commerce Department found that certain solar cells and modules completed in Cambodia, Malaysia, Thailand, and Vietnam were circumventing AD/CVD orders on Chinese products.",
    sources: [uflpa, { label: "Commerce AD/CVD circumvention ruling (2023)" }],
  },
  {
    id: "aluminum", name: "Unwrought aluminum", hs: "HS 7601", signalCode: "HS 7601", indications: ["forced-labor", "duty-evasion"],
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
    history: "U.S. antidumping duties on Chinese honey have applied since 2001. Federal prosecutions around 2013 involved honey transshipped through third countries and mislabeled to evade those duties.",
    sources: [{ label: "U.S. AD order on honey (2001)" }, { label: "DOJ transshipment cases (2013)" }],
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

const mirrorData = comtrade.products as Record<string, MirrorSeries>;
const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const monthLabel = (period: string) => `${monthNames[Number(period.slice(5)) - 1]} ’${period.slice(2, 4)}`;
const formatUsd = (value: number | null) => value === null ? "Not reported" : value >= 1e9 ? `$${(value / 1e9).toFixed(2)}B` : `$${(value / 1e6).toFixed(1)}M`;
const formatGap = (gap: number | null) => gap === null ? "—" : `${gap > 0 ? "+" : ""}${gap}%`;

function buildSeries(series: MirrorSeries): Point[] {
  return series.months.map(({ period, reported, mirror }) => {
    const gap = reported !== null && mirror ? Math.round(((reported - mirror) / mirror) * 1000) / 10 : null;
    return { month: monthLabel(period), reported, mirror, gap, flagged: gap !== null && Math.abs(gap) > GAP_THRESHOLD };
  });
}

function reviewBand(points: Point[]): Band {
  const flags = points.filter((point) => point.flagged).length;
  return flags >= 6 ? "Elevated" : flags >= 2 ? "Review" : "Watch";
}

// Joins consecutive reported values into one path; a missing month breaks the line.
function linePath(values: (number | null)[], x: (index: number) => number, y: (value: number) => number) {
  return values.reduce((path, value, index) => value === null ? path : `${path}${index === 0 || values[index - 1] === null ? "M" : "L"}${x(index)},${y(value)}`, "");
}

function useElementWidth<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [width, setWidth] = useState(680);
  useEffect(() => {
    if (!ref.current) return;
    const observer = new ResizeObserver(([entry]) => setWidth(Math.round(entry.contentRect.width)));
    observer.observe(ref.current);
    return () => observer.disconnect();
  }, []);
  return [ref, width] as const;
}

function BandPill({ band }: { band: Band }) {
  return <span className={`severity-pill ${band.toLowerCase()}`}><i />{band}</span>;
}

function GapSparkline({ points }: { points: Point[] }) {
  const width = 220, height = 54, max = 80;
  const x = (index: number) => 3 + (index / (points.length - 1)) * (width - 6);
  const y = (gap: number) => height - 4 - (Math.min(max, Math.abs(gap)) / max) * (height - 8);
  return <svg className="gap-sparkline" viewBox={`0 0 ${width} ${height}`} aria-hidden="true">
    <line className="spark-threshold" x1="0" x2={width} y1={y(GAP_THRESHOLD)} y2={y(GAP_THRESHOLD)} />
    <path className="spark-line" d={linePath(points.map((point) => point.gap), x, y)} />
    {points.map((point, index) => point.flagged && <circle key={point.month} className="spark-flag" cx={x(index)} cy={y(point.gap!)} r="3" />)}
  </svg>;
}

function TrendChart({ points, hover, onHover, width, labels }: { points: Point[]; hover: number | null; onHover: (index: number | null) => void; width: number; labels: [string, string] }) {
  const compact = width < 480, height = compact ? 190 : 236, left = 48, right = compact ? 10 : 124, top = 14, bottom = 26;
  const values = points.flatMap((point) => [point.reported, point.mirror]).filter((value): value is number => value !== null);
  const unit = Math.max(...values) >= 1e9 ? 1e9 : 1e6;
  const maxValue = Math.ceil((Math.max(...values) * 1.08) / unit) * unit || unit;
  const x = (index: number) => left + (index / (points.length - 1)) * (width - left - right);
  const y = (value: number) => top + (1 - value / maxValue) * (height - top - bottom);
  const ticks = Array.from({ length: 5 }, (_, index) => (maxValue / 4) * index);
  const step = (width - left - right) / (points.length - 1);
  const lastIndex = (key: "reported" | "mirror") => points.reduce((found, point, index) => point[key] !== null ? index : found, -1);
  const reportedLabelY = y(points[lastIndex("reported")]?.reported ?? 0), mirrorLabelY = y(points[lastIndex("mirror")]?.mirror ?? 0);
  const labelSpread = Math.abs(reportedLabelY - mirrorLabelY) < 14 ? (14 - Math.abs(reportedLabelY - mirrorLabelY)) / 2 : 0;
  const pointerIndex = (clientX: number, rect: DOMRect) => Math.max(0, Math.min(points.length - 1, Math.round((((clientX - rect.left) / rect.width) * width - left) / step)));
  const tickLabel = (tick: number) => unit === 1e9 ? `$${(tick / 1e9).toFixed(tick % 1e9 ? 1 : 0)}B` : `$${Math.round(tick / 1e6)}M`;
  return <svg className="trend-chart" viewBox={`0 0 ${width} ${height}`} role="img" aria-label={`Monthly trade value in U.S. dollars: ${labels[0]} versus ${labels[1]}, with flagged months shaded`}
    onPointerMove={(event) => onHover(pointerIndex(event.clientX, event.currentTarget.getBoundingClientRect()))} onPointerLeave={() => onHover(null)}>
    {points.map((point, index) => point.flagged && <rect key={point.month} className="flag-band" x={x(index) - step / 2} y={top} width={step} height={height - top - bottom} />)}
    {ticks.map((tick) => <g key={tick}><line className="chart-gridline" x1={left} x2={width - right} y1={y(tick)} y2={y(tick)} /><text className="axis-label" x={left - 7} y={y(tick) + 3} textAnchor="end">{tickLabel(tick)}</text></g>)}
    {points.map((point, index) => index % (compact ? 6 : 3) === 0 && <text key={point.month} className="axis-label" x={x(index)} y={height - 8} textAnchor="middle">{point.month}</text>)}
    <path className="trend-line" stroke={SERIES_COLORS.mirror} strokeDasharray="6 4" d={linePath(points.map((point) => point.mirror), x, y)} />
    <path className="trend-line" stroke={SERIES_COLORS.reported} d={linePath(points.map((point) => point.reported), x, y)} />
    {points.map((point, index) => point.flagged && <path key={point.month} className="flag-marker" d={`M${x(index)} ${top + 1}l4 6h-8z`} />)}
    {!compact && <>
    <text className="direct-label" x={width - right + 8} y={reportedLabelY + 3 + (reportedLabelY <= mirrorLabelY ? -labelSpread : labelSpread)}>{labels[0]}</text>
    <text className="direct-label" x={width - right + 8} y={mirrorLabelY + 3 + (mirrorLabelY < reportedLabelY ? -labelSpread : labelSpread)}>{labels[1]}</text>
    </>}
    {hover !== null && <g className="crosshair"><line x1={x(hover)} x2={x(hover)} y1={top} y2={height - bottom} />{points[hover].reported !== null && <circle cx={x(hover)} cy={y(points[hover].reported!)} r="4.5" fill={SERIES_COLORS.reported} />}{points[hover].mirror !== null && <circle cx={x(hover)} cy={y(points[hover].mirror!)} r="4.5" fill={SERIES_COLORS.mirror} />}</g>}
    <rect x={left} y={top} width={width - left - right} height={height - top - bottom} fill="transparent" />
  </svg>;
}

function GapChart({ points, hover, onHover, width }: { points: Point[]; hover: number | null; onHover: (index: number | null) => void; width: number }) {
  const compact = width < 480, height = 170, left = 48, right = compact ? 10 : 124, top = 12, bottom = 24;
  const gaps = points.map((point) => point.gap ?? 0);
  const extent = Math.max(GAP_THRESHOLD * 2, Math.ceil(Math.max(...gaps.map(Math.abs)) / 25) * 25);
  const maxGap = Math.min(extent, 200), minGap = Math.min(0, Math.max(-maxGap, Math.floor(Math.min(...gaps) / 25) * 25), -GAP_THRESHOLD * 2);
  const slot = (width - left - right) / points.length, barWidth = slot - 2;
  const clamp = (gap: number) => Math.max(minGap, Math.min(maxGap, gap));
  const y = (gap: number) => top + ((maxGap - clamp(gap)) / (maxGap - minGap)) * (height - top - bottom);
  const baseline = y(0);
  const pointerIndex = (clientX: number, rect: DOMRect) => Math.max(0, Math.min(points.length - 1, Math.floor((((clientX - rect.left) / rect.width) * width - left) / slot)));
  return <svg className="gap-chart" viewBox={`0 0 ${width} ${height}`} role="img" aria-label={`Mirror gap by month, with review thresholds at plus and minus ${GAP_THRESHOLD}%`}
    onPointerMove={(event) => onHover(pointerIndex(event.clientX, event.currentTarget.getBoundingClientRect()))} onPointerLeave={() => onHover(null)}>
    {[minGap, 0, maxGap].map((tick) => <g key={tick}><line className="chart-gridline" x1={left} x2={width - right} y1={y(tick)} y2={y(tick)} /><text className="axis-label" x={left - 7} y={y(tick) + 3} textAnchor="end">{tick > 0 ? "+" : ""}{tick}%</text></g>)}
    {points.map((point, index) => { if (point.gap === null) return null;
      const end = y(point.gap), up = point.gap >= 0, length = Math.max(1, Math.abs(baseline - end)), radius = Math.min(4, length, barWidth / 2), bx = left + index * slot + 1;
      const d = up ? `M${bx} ${baseline}V${baseline - length + radius}q0 -${radius} ${radius} -${radius}h${barWidth - radius * 2}q${radius} 0 ${radius} ${radius}V${baseline}z`
        : `M${bx} ${baseline}V${baseline + length - radius}q0 ${radius} ${radius} ${radius}h${barWidth - radius * 2}q${radius} 0 ${radius} -${radius}V${baseline}z`;
      return <path key={point.month} className={`gap-bar ${point.flagged ? "over" : ""} ${hover === index ? "hovered" : ""}`} d={d} />; })}
    {[GAP_THRESHOLD, -GAP_THRESHOLD].map((threshold) => <line key={threshold} className="threshold-line" x1={left} x2={width - right} y1={y(threshold)} y2={y(threshold)} />)}
    {!compact && <text className="direct-label" x={width - right + 8} y={y(GAP_THRESHOLD) + 3}>Review threshold ±{GAP_THRESHOLD}%</text>}
    {points.map((point, index) => index % (compact ? 6 : 3) === 0 && <text key={point.month} className="axis-label" x={left + index * slot + slot / 2} y={height - 7} textAnchor="middle">{point.month}</text>)}
  </svg>;
}

export default function ProductWatch({ onOpenSignal }: { onOpenSignal: (code: string) => void }) {
  const [indication, setIndication] = useState<Indication | "all">("all");
  const [activeId, setActiveId] = useState(products[0].id);
  const [hover, setHover] = useState<number | null>(null);
  const [chartRef, chartWidth] = useElementWidth<HTMLDivElement>();
  const available = products.filter((product) => mirrorData[product.id]);
  const seriesById = useMemo(() => Object.fromEntries(available.map((product) => [product.id, buildSeries(mirrorData[product.id])])), []);
  const visible = available.filter((product) => indication === "all" || product.indications.includes(indication));
  const active = visible.find((product) => product.id === activeId) ?? visible[0] ?? available[0];
  const points = seriesById[active.id];
  const series = mirrorData[active.id];
  const flaggedCount = points.filter((point) => point.flagged).length;
  const withGap = points.filter((point) => point.gap !== null);
  const peak = withGap.reduce((best, point) => Math.abs(point.gap!) > Math.abs(best.gap!) ? point : best, withGap[0]);
  const latest = withGap[withGap.length - 1];
  const last = points[points.length - 1], yearAgo = points[points.length - 13];
  const yearChange = last.reported && yearAgo?.reported ? Math.round(((last.reported - yearAgo.reported) / yearAgo.reported) * 1000) / 10 : null;
  const labels: [string, string] = ["U.S.-reported imports", `${series.partner.name}-reported exports`];
  const hovered = hover !== null ? points[hover] : null;
  const generated = new Date(series.retrievedAt ?? comtrade.generatedAt).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
  const moveHover = (key: string) => { if (key === "ArrowRight") setHover((current) => Math.min(points.length - 1, (current ?? -1) + 1)); if (key === "ArrowLeft") setHover((current) => Math.max(0, (current ?? points.length) - 1)); if (key === "Escape") setHover(null); };

  return <section className="tab-page product-watch">
    <div className="section-title-row"><div><p className="eyebrow">02 <span>/</span> PRODUCT WATCH</p><h2>Products with a history of trade anomalies</h2></div><span className="data-chip">UN COMTRADE · MIRROR STATISTICS</span></div>
    <div className="coverage-note"><History size={19} /><div><b>Why these products are on watch</b><p>Each product is listed because of public enforcement or guidance: forced-labor import rules, duty-evasion and transshipment cases, money-laundering typologies, or conflict and illegal-harvest sourcing rules. Trends are real UN Comtrade statistics comparing what the United States reports importing from its largest supplier of each product with what that supplier reports exporting to the United States. A gap is a prompt to reconcile, not evidence of wrongdoing by any country or company.</p></div></div>
    <div className="indication-filter" role="group" aria-label="Filter products by risk indication">
      <button type="button" aria-pressed={indication === "all"} onClick={() => setIndication("all")}>All indications <i>{available.length}</i></button>
      {(Object.keys(indicationLabels) as Indication[]).map((key) => <button type="button" key={key} aria-pressed={indication === key} onClick={() => setIndication(key)}>{indicationLabels[key]} <i>{available.filter((product) => product.indications.includes(key)).length}</i></button>)}
    </div>
    {visible.length === 0 && <p className="product-empty">No product with this indication has trade data yet. Showing {active.name}.</p>}
    <div className="product-grid">{visible.map((product) => { const productPoints = seriesById[product.id]; const flags = productPoints.filter((point) => point.flagged).length; const recent = productPoints.filter((point) => point.gap !== null).at(-1);
      return <button type="button" key={product.id} className={`product-card ${product.id === active.id ? "selected" : ""}`} aria-pressed={product.id === active.id} onClick={() => { setActiveId(product.id); setHover(null); }}>
        <span className="product-card-top"><BandPill band={reviewBand(productPoints)} /><code>{product.hs}</code></span>
        <b>{product.name}</b>
        <span className="product-partner">U.S. ↔ {mirrorData[product.id].partner.name}</span>
        <span className="product-tags">{product.indications.map((key) => <small key={key}>{indicationLabels[key]}</small>)}</span>
        <GapSparkline points={productPoints} />
        <span className="product-card-foot"><span><Flag size={11} /> {flags} of {productPoints.length} months flagged</span><span>Latest gap {formatGap(recent?.gap ?? null)}</span></span>
      </button>; })}</div>

    <article className="product-detail visual-card">
      <div className="visual-card-head"><div><p className="eyebrow">TREND DETAIL <span>/</span> {active.hs} <span>/</span> U.S. ↔ {series.partner.name.toUpperCase()}</p><h2>{active.name}</h2></div><BandPill band={reviewBand(points)} /></div>
      <div className="product-stats">
        <div><span className="metric-label">MONTHS FLAGGED</span><strong>{flaggedCount}<small>/{points.length}</small></strong><small>Gap beyond ±{GAP_THRESHOLD}%</small></div>
        <div><span className="metric-label">LARGEST GAP</span><strong>{formatGap(peak?.gap ?? null)}</strong><small>{peak?.month}</small></div>
        <div><span className="metric-label">LATEST GAP</span><strong>{formatGap(latest?.gap ?? null)}</strong><small>{latest?.month}</small></div>
        <div><span className="metric-label">U.S. IMPORTS, YEAR ON YEAR</span><strong>{yearChange === null ? "—" : `${yearChange > 0 ? "+" : ""}${yearChange}%`}</strong><small>{last.month}: {formatUsd(last.reported)}</small></div>
      </div>
      <div className="product-detail-grid">
        <div className="product-charts" ref={chartRef} tabIndex={0} aria-label="Trend charts. Use left and right arrow keys to step through months." onKeyDown={(event) => moveHover(event.key)} onBlur={() => setHover(null)}>
          <div className="chart-title-row"><h3>Monthly trade value, U.S. dollars</h3><span className="series-legend"><span><i className="legend-line" style={{ background: SERIES_COLORS.reported }} />{labels[0]}</span><span><i className="legend-line dashed" style={{ borderColor: SERIES_COLORS.mirror }} />{labels[1]}</span><span><i className="legend-flag" />Flagged month</span></span></div>
          <div className="chart-shell">
            <TrendChart points={points} hover={hover} onHover={setHover} width={chartWidth} labels={labels} />
            {hovered && <div className="chart-tooltip" style={{ left: `${Math.min(76, Math.max(14, (hover! / (points.length - 1)) * 78 + 5))}%` }} role="status">
              <b>{hovered.month}</b>
              <span><i style={{ background: SERIES_COLORS.reported }} />U.S. imports <em>{formatUsd(hovered.reported)}</em></span>
              <span><i style={{ background: SERIES_COLORS.mirror }} />Partner exports <em>{formatUsd(hovered.mirror)}</em></span>
              <span className="tooltip-gap">Gap <em>{formatGap(hovered.gap)}</em>{hovered.flagged && <strong><TriangleAlert size={11} /> Flagged</strong>}</span>
            </div>}
          </div>
          <h3 className="gap-title">Mirror gap by month <small>(U.S. imports ÷ partner exports − 1 · dashed lines = ±{GAP_THRESHOLD}% review threshold)</small></h3>
          <GapChart points={points} hover={hover} onHover={setHover} width={chartWidth} />
          <p className="visual-footnote">U.S. imports are valued at customs value and partner exports at FOB. Shipping time across month boundaries, re-exports, confidential trade, and classification differences all create gaps, so a flag is a reconciliation prompt, not a finding. Months a side did not report are left blank.</p>
          <details className="data-table-toggle"><summary>View data as a table</summary><div className="table-scroll"><table><thead><tr><th>Month</th><th>U.S. imports</th><th>{series.partner.name} exports</th><th>Gap</th><th>Flag</th></tr></thead><tbody>{points.map((point) => <tr key={point.month} className={point.flagged ? "flagged" : ""}><td>{point.month}</td><td>{formatUsd(point.reported)}</td><td>{formatUsd(point.mirror)}</td><td>{formatGap(point.gap)}</td><td>{point.flagged ? "Beyond threshold" : "—"}</td></tr>)}</tbody></table></div></details>
          <p className="data-provenance"><Database size={12} /> Source: UN Comtrade, HS {series.cmdCode}. Partner = largest supplier to the U.S. in {series.supplierRankYear}. Retrieved {generated}.</p>
        </div>
        <aside className="product-context">
          <h3>Why it’s on watch</h3>
          <div className="indicator-list">{active.indications.map((key) => <span key={key}>{indicationLabels[key]}</span>)}</div>
          <p>{active.history}</p>
          <h3>Public references</h3>
          <ul className="context-sources">{active.sources.map((source) => <li key={source.label}>{source.href ? <a href={source.href} target="_blank" rel="noreferrer">{source.label} <ExternalLink size={11} /></a> : source.label}</li>)}<li><a href="https://comtradeplus.un.org/" target="_blank" rel="noreferrer">UN Comtrade database <ExternalLink size={11} /></a></li></ul>
          <h3>What to check next</h3>
          <ul className="context-checks"><li>Compare unit values against the product’s usual range</li><li>Look for new or growing third-country partners</li><li>Confirm origin documentation and applicable duty orders</li><li>Entity-level supply-chain links (planned: Sayari)</li></ul>
          {active.signalCode && <button type="button" className="text-action" onClick={() => onOpenSignal(active.signalCode!)}>Open related review lead <ArrowRight size={13} /></button>}
        </aside>
      </div>
    </article>
  </section>;
}
