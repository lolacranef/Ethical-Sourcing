import { useEffect, useRef, useState } from "react";
import { ArrowRight, Database, ExternalLink, Flag, History, Newspaper, Network, TriangleAlert } from "lucide-react";
import {
  GAP_THRESHOLD, Band, Corridor, Development, Indication, Point, WindowMonths, comtradeGeneratedAt, corridorData, developmentsFor, flagLabels, formatCount, formatDate,
  formatGap, formatShare, fullSeries, indicationLabels, mirrorData, monthLabel, pendingReviewCount, products, reviewBand, riskLabels, sayariGeneratedAt, tavilyGeneratedAt, windowed,
} from "./data";
import { ProductAnalysis } from "./Analysis";
import { HowToRead, Term, bandMeaning } from "./Glossary";
import { buildLead, shortPartner } from "./data";

const SERIES_COLORS = { reported: "#008574", mirror: "#a8692a" };
const formatUsd = (value: number | null) => value === null ? "Not reported" : value >= 1e9 ? `$${(value / 1e9).toFixed(2)}B` : `$${(value / 1e6).toFixed(1)}M`;
const labelEvery = (count: number, compact: boolean) => count <= 6 ? 1 : count <= 12 ? (compact ? 3 : 2) : (compact ? 6 : 3);

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
  return <span className={`severity-pill ${band.toLowerCase()}`} title={bandMeaning[band]}><i />{band}</span>;
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

function TrendChart({ points, hover, onHover, width, labels, eventIndexes }: { points: Point[]; hover: number | null; onHover: (index: number | null) => void; width: number; labels: [string, string]; eventIndexes: number[] }) {
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
    {points.map((point, index) => index % labelEvery(points.length, compact) === 0 && <text key={point.month} className="axis-label" x={x(index)} y={height - 8} textAnchor="middle">{point.month}</text>)}
    {eventIndexes.map((index) => <g key={index} className="event-marker"><line x1={x(index)} x2={x(index)} y1={top} y2={height - bottom} /><path d={`M${x(index)} ${height - bottom - 9}l4.5 4.5-4.5 4.5-4.5-4.5z`} /></g>)}
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

function GapChart({ points, hover, onHover, width, eventIndexes }: { points: Point[]; hover: number | null; onHover: (index: number | null) => void; width: number; eventIndexes: number[] }) {
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
    {[minGap, 0, maxGap].map((tick) => <g key={tick}><line className="chart-gridline" x1={left} x2={width - right} y1={y(tick)} y2={y(tick)} /><text className="axis-label" x={left - 7} y={y(tick) + 3} textAnchor="end">{(tick === maxGap && gaps.some((gap) => gap > maxGap)) || (tick === minGap && gaps.some((gap) => gap < minGap)) ? "≥" : ""}{tick > 0 ? "+" : ""}{tick}%</text></g>)}
    {points.map((point, index) => { if (point.gap === null) return null;
      const end = y(point.gap), up = point.gap >= 0, length = Math.max(1, Math.abs(baseline - end)), radius = Math.min(4, length, barWidth / 2), bx = left + index * slot + 1;
      const d = up ? `M${bx} ${baseline}V${baseline - length + radius}q0 -${radius} ${radius} -${radius}h${barWidth - radius * 2}q${radius} 0 ${radius} ${radius}V${baseline}z`
        : `M${bx} ${baseline}V${baseline + length - radius}q0 ${radius} ${radius} ${radius}h${barWidth - radius * 2}q${radius} 0 ${radius} -${radius}V${baseline}z`;
      return <path key={point.month} className={`gap-bar ${point.flagged ? "over" : ""} ${hover === index ? "hovered" : ""}`} d={d} />; })}
    {eventIndexes.map((index) => <line key={index} className="event-line" x1={left + index * slot + slot / 2} x2={left + index * slot + slot / 2} y1={top} y2={height - bottom} />)}
    {[GAP_THRESHOLD, -GAP_THRESHOLD].map((threshold) => <line key={threshold} className="threshold-line" x1={left} x2={width - right} y1={y(threshold)} y2={y(threshold)} />)}
    {!compact && <text className="direct-label" x={width - right + 8} y={y(GAP_THRESHOLD) + 3}>Review threshold ±{GAP_THRESHOLD}%</text>}
    {points.map((point, index) => index % labelEvery(points.length, compact) === 0 && <text key={point.month} className="axis-label" x={left + index * slot + slot / 2} y={height - 7} textAnchor="middle">{point.month}</text>)}
  </svg>;
}

function CorridorPanel({ data, partner }: { data?: Corridor; partner: string }) {
  if (!data) return <p className="intel-empty">No Sayari snapshot for this corridor yet.</p>;
  if (data.coverageGap) return <p className="intel-empty">{data.coverageGap}</p>;
  const topFive = (data.topSupplierShipments ?? []).reduce((sum, count) => sum + count, 0);
  const risks = Object.entries(data.supplierRisk ?? {}).filter(([, count]) => count > 0).sort((a, b) => b[1] - a[1]);
  const flags = [...(data.topFlags ?? [])].sort((a, b) => b[1] - a[1]);
  return <>
    <div className="intel-stats">
      <div><span className="metric-label">SHIPMENT RECORDS</span><strong>{formatCount(data.shipments)}</strong><small>{partner} → U.S., HS {data.corridor.hs}</small></div>
      <div><span className="metric-label">EXPORTING SUPPLIERS</span><strong>{formatCount(data.suppliers)}</strong><small>Distinct shipper entities</small></div>
      <div><span className="metric-label">TOP-5 SUPPLIER SHARE</span><strong>{formatShare(topFive, data.shipments)}</strong><small>Of shipment records</small></div>
      <div><span className="metric-label">RECORDS COVER</span><strong className="intel-dates">{data.coverage ? `${formatDate(data.coverage.earliest)} – ${formatDate(data.coverage.latest)}` : "—"}</strong><small>Earliest to latest record</small></div>
    </div>
    <h3>Suppliers carrying a Sayari risk flag, by category</h3>
    <div className="risk-bars" role="list">{risks.map(([key, count]) => <div className="risk-bar-row" role="listitem" key={key} title={`${formatCount(count)} of ${formatCount(data.suppliers)} suppliers`}>
      <span className="risk-bar-label">{riskLabels[key] ?? key}</span>
      <span className="risk-bar-track"><i style={{ width: `${Math.max(1, (count / data.suppliers) * 100)}%` }} /></span>
      <span className="risk-bar-value">{formatShare(count, data.suppliers)} <small>({formatCount(count)})</small></span>
    </div>)}</div>
    {flags.length > 0 && <><h3>Most common specific flags</h3><ul className="flag-list">{flags.map(([key, count]) => <li key={key}><b>{formatCount(count)}</b>{flagLabels[key] ?? key}</li>)}</ul></>}
  </>;
}

export function ViewSwitch<T extends string>({ view, onChange, labels = { trends: "Trends", analysis: "Analysis" } as Record<string, string> }: { view: T; onChange: (view: T) => void; labels?: Record<string, string> }) {
  return <div className="view-switch" role="tablist" aria-label="Section view">{(Object.keys(labels) as T[]).map((key) => <button type="button" role="tab" key={key} aria-selected={view === key} className={view === key ? "active" : ""} onClick={() => onChange(key)}>{labels[key]}</button>)}</div>;
}

export default function ProductWatch({ months, initialProductId, onOpenLead }: { months: WindowMonths; initialProductId?: string; onOpenLead: (productId: string) => void }) {
  const [indication, setIndication] = useState<Indication | "all">("all");
  const [activeId, setActiveId] = useState(initialProductId ?? products[0].id);
  const [hover, setHover] = useState<number | null>(null);
  const [view, setView] = useState<"trends" | "analysis">("trends");
  const [chartRef, chartWidth] = useElementWidth<HTMLDivElement>();
  const available = products.filter((product) => mirrorData[product.id]);
  const pending = products.filter((product) => !mirrorData[product.id]);
  const visible = available.filter((product) => indication === "all" || product.indications.includes(indication));
  const active = visible.find((product) => product.id === activeId) ?? visible[0] ?? available[0];
  const allPoints = fullSeries[active.id];
  const points = windowed(allPoints, months);
  const series = mirrorData[active.id];
  const flaggedCount = points.filter((point) => point.flagged).length;
  const withGap = points.filter((point) => point.gap !== null);
  const peak = withGap.reduce((best, point) => Math.abs(point.gap!) > Math.abs(best.gap!) ? point : best, withGap[0]);
  const latest = withGap[withGap.length - 1];
  const last = allPoints[allPoints.length - 1], yearAgo = allPoints[allPoints.length - 13];
  const medianGap = [...withGap.map((point) => Math.abs(point.gap!))].sort((a, b) => a - b)[Math.floor(withGap.length / 2)] ?? 0;
  const yearChange = last.reported && yearAgo?.reported ? Math.round(((last.reported - yearAgo.reported) / yearAgo.reported) * 1000) / 10 : null;
  const labels: [string, string] = ["U.S.-reported imports", `${series.partner.name}-reported exports`];
  const hovered = hover !== null ? points[hover] : null;
  const generated = new Date(series.retrievedAt ?? comtradeGeneratedAt).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });

  // Developments are placed on the month they fall in; ones after the latest trade month are listed separately.
  const developments = developmentsFor(active.id);
  const eventsAt = (index: number): Development[] => developments.filter((item) => item.date!.slice(0, 7) === points[index].period);
  const eventIndexes = points.map((_, index) => index).filter((index) => eventsAt(index).length > 0);
  const lastPeriod = points[points.length - 1].period;
  const afterData = developments.filter((item) => item.date!.slice(0, 7) > lastPeriod);
  const pendingReview = pendingReviewCount(active.id);
  const hoverIndexFor = (date: string) => points.findIndex((point) => point.period === date.slice(0, 7));
  const moveHover = (key: string) => { if (key === "ArrowRight") setHover((current) => Math.min(points.length - 1, (current ?? -1) + 1)); if (key === "ArrowLeft") setHover((current) => Math.max(0, (current ?? points.length) - 1)); if (key === "Escape") setHover(null); };
  useEffect(() => setHover(null), [months]);

  return <section className="tab-page product-watch">
    <div className="section-title-row"><div><p className="eyebrow">02 <span>/</span> PRODUCT WATCH</p><h2>Products with a history of trade anomalies</h2></div><span className="data-chip">UN COMTRADE · MIRROR STATISTICS</span></div>
    <ViewSwitch view={view} onChange={setView} />
    {view === "analysis" ? <ProductAnalysis months={months} onOpenLead={onOpenLead} onOpenTrend={(productId) => { setIndication("all"); setActiveId(productId); setHover(null); setView("trends"); requestAnimationFrame(() => document.querySelector(".product-detail")?.scrollIntoView({ behavior: "smooth", block: "start" })); }} /> : <>
    <HowToRead><p>Each card is a product with a history of trade problems, paired with the country that ships the most of it to the U.S. The line chart compares what the U.S. says it imported with what that country says it exported. They should roughly match; red triangles mark months where they differed by more than 25% (<Term k="flagged month">flagged months</Term>). Gold diamonds mark government actions. Below the charts, <b>Corridor intelligence</b> shows who ships the product and recent rulings. <b>Analysis</b> at the top has ratings and suggested next checks.</p></HowToRead>
    <div className="coverage-note"><History size={19} /><div><b>Why these products are on watch</b><p>Each product is listed because of public enforcement or guidance: forced-labor import rules, duty-evasion and transshipment cases, money-laundering typologies, or conflict and illegal-harvest sourcing rules. Trends are real UN Comtrade statistics comparing what the United States reports importing from its largest supplier of each product with what that supplier reports exporting to the United States. A gap is a prompt to reconcile, not evidence of wrongdoing by any country or company.</p></div></div>
    <div className="indication-filter" role="group" aria-label="Filter products by risk indication">
      <button type="button" aria-pressed={indication === "all"} onClick={() => setIndication("all")}>All indications <i>{available.length}</i></button>
      {(Object.keys(indicationLabels) as Indication[]).filter((key) => available.some((product) => product.indications.includes(key))).map((key) => <button type="button" key={key} aria-pressed={indication === key} onClick={() => setIndication(key)}>{indicationLabels[key]} <i>{available.filter((product) => product.indications.includes(key)).length}</i></button>)}
    </div>
    {pending.length > 0 && <p className="product-pending">Data pending for {pending.map((product) => product.name).join(" · ")}. These appear once their UN Comtrade data has been fetched.</p>}
    {visible.length === 0 && <p className="product-empty">No product with this indication has trade data yet. Showing {active.name}.</p>}
    <div className="product-grid">{visible.map((product) => { const productPoints = windowed(fullSeries[product.id], months); const flags = productPoints.filter((point) => point.flagged).length; const recent = productPoints.filter((point) => point.gap !== null).at(-1);
      return <button type="button" key={product.id} className={`product-card ${product.id === active.id ? "selected" : ""}`} aria-pressed={product.id === active.id} onClick={() => { setActiveId(product.id); setHover(null); }}>
        <span className="product-card-top"><BandPill band={reviewBand(productPoints)} /><code>{product.hs}</code></span>
        <b>{product.name}</b>
        <span className="product-partner">U.S. ↔ {mirrorData[product.id].partner.name}</span>
        <span className="product-tags">{product.indications.map((key) => <small key={key}>{indicationLabels[key]}</small>)}</span>
        <GapSparkline points={productPoints} />
        <span className="product-card-foot"><span><Flag size={11} /> {flags} of {productPoints.length} months flagged</span><span>Latest gap {formatGap(recent?.gap ?? null)}</span></span>
      </button>; })}</div>

    <article className="product-detail visual-card">
      <div className="visual-card-head"><div><p className="eyebrow">TREND DETAIL <span>/</span> {active.hs} <span>/</span> U.S. ↔ {series.partner.name.toUpperCase()} <span>/</span> {points[0].month.toUpperCase()} – {points[points.length - 1].month.toUpperCase()}</p><h2>{active.name}</h2></div><BandPill band={reviewBand(points)} /></div>
      {(() => { const lead = buildLead(active, months); return lead && <section className="plain-box"><h3>In plain terms <small>{bandMeaning[lead.severity]} · review score {lead.score}</small></h3><p>{lead.plain.summary}</p><p className="plain-next"><b>Suggested first step:</b> {lead.plain.nextStep}</p></section>; })()}
      <div className="product-stats">
        <div><span className="metric-label">MONTHS FLAGGED</span><strong>{flaggedCount}<small>/{points.length}</small></strong><small>Gap beyond ±{GAP_THRESHOLD}%</small></div>
        <div><span className="metric-label">LARGEST GAP</span><strong>{formatGap(peak?.gap ?? null)}</strong><small>{peak?.month}</small></div>
        <div><span className="metric-label">LATEST GAP</span><strong>{formatGap(latest?.gap ?? null)}</strong><small>{latest?.month}</small></div>
        <div><span className="metric-label">U.S. IMPORTS, YEAR ON YEAR</span><strong>{yearChange === null ? "—" : `${yearChange > 0 ? "+" : ""}${yearChange}%`}</strong><small>{last.month}: {formatUsd(last.reported)}</small></div>
      </div>
      <div className="product-detail-grid">
        <div className="product-charts" ref={chartRef} tabIndex={0} aria-label="Trend charts. Use left and right arrow keys to step through months." onKeyDown={(event) => moveHover(event.key)} onBlur={() => setHover(null)}>
          <div className="chart-title-row"><h3>Monthly trade value, U.S. dollars</h3><span className="series-legend"><span><i className="legend-line" style={{ background: SERIES_COLORS.reported }} />{labels[0]}</span><span><i className="legend-line dashed" style={{ borderColor: SERIES_COLORS.mirror }} />{labels[1]}</span><span><i className="legend-flag" />Flagged month</span>{eventIndexes.length > 0 && <span><i className="legend-event" />Ruling or policy action</span>}</span></div>
          <div className="chart-shell">
            <TrendChart points={points} hover={hover} onHover={setHover} width={chartWidth} labels={labels} eventIndexes={eventIndexes} />
            {hovered && <div className="chart-tooltip" style={{ left: `${Math.min(76, Math.max(14, (hover! / Math.max(1, points.length - 1)) * 78 + 5))}%` }} role="status">
              <b>{hovered.month}</b>
              <span><i style={{ background: SERIES_COLORS.reported }} />U.S. imports <em>{formatUsd(hovered.reported)}</em></span>
              <span><i style={{ background: SERIES_COLORS.mirror }} />Partner exports <em>{formatUsd(hovered.mirror)}</em></span>
              <span className="tooltip-gap">Gap <em>{formatGap(hovered.gap)}</em>{hovered.flagged && <strong><TriangleAlert size={11} /> Flagged</strong>}</span>
              {eventsAt(hover!).map((item) => <span key={item.url + item.title} className="tooltip-event"><i />{item.title}</span>)}
            </div>}
          </div>
          <h3 className="gap-title"><Term k="mirror gap">Mirror gap</Term> by month <small>(U.S. imports ÷ partner exports − 1 · dashed lines = ±{GAP_THRESHOLD}% review threshold)</small></h3>
          <GapChart points={points} hover={hover} onHover={setHover} width={chartWidth} eventIndexes={eventIndexes} />
          {points.some((point) => point.gap !== null && Math.abs(point.gap) > 200) && <p className="gap-cap-note">Bars are capped at the axis limit; hover a month or open the table for exact gaps.{medianGap > 100 && ` A gap this large in most months usually means the two sides classify the goods differently or attribute them to different partners (for example, goods shipped through a third country’s port), so check classification and routing before reading it as an anomaly.`}</p>}
          {afterData.length > 0 && <p className="after-data-note"><Newspaper size={12} /> {afterData.length} development{afterData.length > 1 ? "s" : ""} after {monthLabel(lastPeriod)} {afterData.length > 1 ? "are" : "is"} not yet reflected in trade data. Watch the next monthly releases for import surges or partner shifts.</p>}
          <p className="visual-footnote">U.S. imports are valued at customs value and partner exports at FOB. Shipping time across month boundaries, re-exports, confidential trade, and classification differences all create gaps, so a flag is a reconciliation prompt, not a finding. Months a side did not report are left blank.</p>
          <details className="data-table-toggle"><summary>View data as a table</summary><div className="table-scroll"><table><thead><tr><th>Month</th><th>U.S. imports</th><th>{series.partner.name} exports</th><th>Gap</th><th>Flag</th><th>Developments</th></tr></thead><tbody>{points.map((point, index) => <tr key={point.month} className={point.flagged ? "flagged" : ""}><td>{point.month}</td><td>{formatUsd(point.reported)}</td><td>{formatUsd(point.mirror)}</td><td>{formatGap(point.gap)}</td><td>{point.flagged ? "Beyond threshold" : "—"}</td><td>{eventsAt(index).map((item) => item.title).join("; ") || "—"}</td></tr>)}</tbody></table></div></details>
          <p className="data-provenance"><Database size={12} /> Source: UN Comtrade, HS {series.cmdCode}. Partner = largest supplier to the U.S. in {series.supplierRankYear}. Retrieved {generated}.</p>
        </div>
        <aside className="product-context">
          <h3>Why it’s on watch</h3>
          <div className="indicator-list">{active.indications.map((key) => <span key={key}>{indicationLabels[key]}</span>)}</div>
          <p>{active.history}</p>
          <h3>Public references</h3>
          <ul className="context-sources">{active.sources.map((source) => <li key={source.label}>{source.href ? <a href={source.href} target="_blank" rel="noreferrer">{source.label} <ExternalLink size={11} /></a> : source.label}</li>)}<li><a href="https://comtradeplus.un.org/" target="_blank" rel="noreferrer">UN Comtrade database <ExternalLink size={11} /></a></li></ul>
          <h3>What to check next</h3>
          <ul className="context-checks"><li>Compare unit values against the product’s usual range</li><li>Look for new or growing third-country partners</li><li>Confirm origin documentation and applicable duty orders</li><li>Read the corridor intelligence below: supplier concentration, risk-flag exposure, and recent rulings</li></ul>
          <button type="button" className="text-action" onClick={() => onOpenLead(active.id)}>Open review lead <ArrowRight size={13} /></button>
        </aside>
      </div>
    </article>

    <article className="corridor-intel visual-card" aria-labelledby="corridor-intel-heading">
      <div className="visual-card-head"><div><p className="eyebrow">CORRIDOR INTELLIGENCE <span>/</span> {series.partner.name.toUpperCase()} → UNITED STATES</p><h2 id="corridor-intel-heading">Who ships it, and what changed</h2></div><span className="data-chip">SAYARI · TAVILY</span></div>
      <div className="intel-grid">
        <section className="intel-panel">
          <p className="intel-source"><Network size={13} /> Sayari trade records <span>· aggregate, no entities named</span></p>
          {(() => { const data = corridorData[active.id]; return data && data.suppliers > 0 && <p className="plain-line">In short: Sayari has {formatCount(data.shipments)} shipping records from {formatCount(data.suppliers)} companies sending this product from {shortPartner(series.partner.name)} to the U.S. {formatShare(data.supplierRisk?.forced_labor ?? 0, data.suppliers)} of those companies carry a forced-labor <Term k="risk flag">warning flag</Term>.</p>; })()}
          <CorridorPanel data={corridorData[active.id]} partner={series.partner.name} />
          <p className="intel-caveat">Counts come from bills of lading and customs records in Sayari’s graph, so they cover what those sources capture, not all trade. A risk flag is an attribute of the supplier entity: it can reflect sub-tier links, a country-and-product listing such as the U.S. Labor Department lists, or activity in other products. It is a reason to ask for documentation, not a finding about these shipments.</p>
        </section>
        <section className="intel-panel">
          <p className="intel-source"><Newspaper size={13} /> Recent developments <span>· Tavily web search</span></p>
          {developments.length > 0 && <p className="plain-line">In short: {developments.length} government action{developments.length > 1 ? "s" : ""} or ruling{developments.length > 1 ? "s" : ""} on this product, newest first. “Show on chart” marks when each happened.</p>}
          {developments.length ? <ol className="development-list">{developments.map((item) => { const index = hoverIndexFor(item.date!);
            return <li key={item.url + item.title}>
              <span className="development-meta"><time dateTime={item.date!}>{formatDate(item.date!)}</time><i>{item.kind}</i>{index >= 0 ? <button type="button" className="show-on-chart" onClick={() => { setHover(index); document.querySelector(".product-charts")?.scrollIntoView({ behavior: "smooth", block: "center" }); }}>Show on chart</button> : item.date!.slice(0, 7) > lastPeriod ? <em>After latest trade data</em> : <em>Before selected period</em>}</span>
              <a href={item.url} target="_blank" rel="noreferrer">{item.title} <ExternalLink size={11} /></a>
              <p>{item.summary}</p>
              <small>{item.outlet}</small>
            </li>; })}</ol> : <p className="intel-empty">No recent developments captured for this product.</p>}
          {pendingReview > 0 && <p className="intel-empty">{pendingReview} new search result{pendingReview > 1 ? "s" : ""} from the last refresh {pendingReview > 1 ? "are" : "is"} awaiting review in tavily-developments.json and hidden until approved.</p>}
          <p className="intel-caveat">Summaries are drawn from search snippets and link to the original. Confirm against the official notice before relying on a rate or date.</p>
        </section>
      </div>
      <p className="data-provenance"><Database size={12} /> Sources: Sayari Graph trade facets, retrieved {formatDate(sayariGeneratedAt)}; Tavily web search, retrieved {formatDate(tavilyGeneratedAt)}. Refresh with npm run data:sayari and npm run data:tavily.</p>
    </article>
    </>}
  </section>;
}
