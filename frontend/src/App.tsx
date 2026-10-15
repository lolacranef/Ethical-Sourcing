import { useEffect, useMemo, useState } from "react";
import {
  Activity,
  ArrowRight,
  ArrowUpRight,
  Bookmark,
  BookOpen,
  Check,
  ChevronDown,
  CircleHelp,
  Clock3,
  Compass,
  ExternalLink,
  FileSearch,
  Filter,
  Gauge,
  Globe2,
  MapPin,
  PackageSearch,
  Search,
  ShieldAlert,
  SlidersHorizontal,
  Upload,
  Waypoints,
} from "lucide-react";
import { ComposableMap, Geographies, Geography, Marker } from "react-simple-maps";
import worldAtlasUrl from "world-atlas/countries-110m.json?url";
import ProductWatch from "./ProductWatch";
import { Band, Lead, WINDOW_OPTIONS, WindowMonths, buildLeads } from "./data";

type Tab = "overview" | "signals" | "products" | "flows" | "saved" | "sources";

const SAVED_KEY = "zenith.savedLeads";
const readSaved = (): string[] => { try { const value = JSON.parse(localStorage.getItem(SAVED_KEY) ?? "[]"); return Array.isArray(value) ? value.filter((id) => typeof id === "string") : []; } catch { return []; } };

const sourceLinks = [
  { label: "ITC Trade Map", href: "https://www.intracen.org/resources/tools/trade-map", status: "Global · country / product" },
  { label: "UN Comtrade", href: "https://comtradeplus.un.org/", status: "Global · monthly mirror data · in use" },
  { label: "Census FTZ statistics", href: "https://www.census.gov/foreign-trade/aip/ftz_guidelines.pdf", status: "United States · aggregate" },
  { label: "USITC DataWeb", href: "https://www.usitc.gov/applications/dataweb/faqs", status: "United States · aggregate" },
  { label: "19 CFR Part 146", href: "https://www.ecfr.gov/current/title-19/chapter-I/part-146", status: "United States · FTZ rules" },
];

const tabOptions: { id: Tab; label: string; icon: React.ReactNode }[] = [
  { id: "overview", label: "Overview", icon: <Activity size={15} /> },
  { id: "signals", label: "Signals", icon: <Filter size={15} /> },
  { id: "products", label: "Product watch", icon: <PackageSearch size={15} /> },
  { id: "flows", label: "Trade flows", icon: <Waypoints size={15} /> },
  { id: "saved", label: "Saved leads", icon: <Bookmark size={15} /> },
  { id: "sources", label: "Data & method", icon: <BookOpen size={15} /> },
];

function SeverityPill({ severity }: { severity: Band }) {
  return <span className={`severity-pill ${severity.toLowerCase()}`}><i />{severity}</span>;
}

function ZenithMark() {
  return <svg className="brand-mark" viewBox="0 0 64 64" aria-hidden="true">
    <circle cx="32" cy="32" r="30" fill="#e3c27a" stroke="#142624" strokeWidth="1.6" />
    <circle cx="32" cy="32" r="26.4" fill="none" stroke="#203b38" strokeWidth="2.4" strokeDasharray=".7 2.06" />
    <circle cx="32" cy="32" r="19" fill="#203b38" />
    <g fill="none" stroke="#e9d7a8" strokeWidth=".9" opacity=".75">
      <ellipse cx="32" cy="32" rx="7" ry="19" />
      <ellipse cx="32" cy="32" rx="13.5" ry="19" />
      <path d="M13 32h38M15.6 22.5h32.8M15.6 41.5h32.8" />
    </g>
    <path d="M32 3.5v57" stroke="#bd5d3d" strokeWidth="2.6" />
    <path d="M32 2.5l2.3 6.2 6.2 2.3-6.2 2.3L32 19.5l-2.3-6.2-6.2-2.3 6.2-2.3z" fill="#bd5d3d" stroke="#142624" strokeWidth="1" strokeLinejoin="round" />
    <circle cx="32" cy="32" r="3" fill="#e3c27a" stroke="#142624" strokeWidth="1" />
  </svg>;
}

function ScoreBar({ score }: { score: number }) {
  return <div className="score-line"><span className="score-track"><i style={{ width: `${score}%` }} /></span><b>{score}</b></div>;
}

function TradePulseChart() {
  const points = "0,87 54,73 108,78 162,46 216,58 270,30 324,43 378,18 432,38 486,25 540,8";
  return <div className="chart-frame">
    <div className="chart-axis-labels"><span>HIGHER INDEX</span><span>ILLUSTRATIVE INDEX · NOT DOLLARS</span></div>
    <svg className="pulse-chart" viewBox="0 0 560 120" role="img" aria-label="Fictional monthly trade index trend, included only to demonstrate chart layout">
      <defs><linearGradient id="pulseFill" x1="0" x2="0" y1="0" y2="1"><stop offset="0%" stopColor="#3e7b73" stopOpacity=".25"/><stop offset="100%" stopColor="#3e7b73" stopOpacity="0"/></linearGradient></defs>
      {[25, 55, 85, 115].map((y) => <line key={y} x1="0" x2="560" y1={y} y2={y} className="chart-gridline" />)}
      <polygon points={`0,120 ${points} 540,120`} fill="url(#pulseFill)" />
      <polyline points={points} className="chart-line" />
      {points.split(" ").map((point, index) => { const [cx, cy] = point.split(","); return <circle key={point} cx={cx} cy={cy} r="3" className="chart-point"><title>{`Illustrative period ${index + 1}`}</title></circle>; })}
    </svg>
    <div className="chart-months"><span>OCT</span><span>NOV</span><span>DEC</span><span>JAN</span><span>FEB</span><span>MAR</span><span>APR</span><span>MAY</span><span>JUN</span><span>JUL</span><span>AUG</span></div>
  </div>;
}

function ProductBars() {
  const rows = [
    { name: "Solar components", hs: "8541", value: 84, color: "teal" },
    { name: "Aluminum", hs: "7601", value: 68, color: "ochre" },
    { name: "Copper products", hs: "7403", value: 49, color: "coral" },
    { name: "Natural rubber", hs: "4001", value: 34, color: "blue" },
  ];
  return <div className="product-bars">{rows.map((row) => <div className="product-bar-row" key={row.hs}>
    <div className="product-bar-title"><span>{row.name}</span><code>HS {row.hs}</code></div>
    <div className="product-bar-track"><i className={row.color} style={{ width: `${row.value}%` }} /></div>
    <span className="product-bar-value">{row.value}</span>
  </div>)}</div>;
}

function FlowDiagram() {
  return <div className="flow-diagram" aria-label="Aggregate data comparison workflow, not physical shipment tracking">
    <div className="flow-node origin"><span>REPORTER</span><b>Economy</b><small>Reported flow</small></div>
    <ArrowRight className="flow-arrow" size={19} />
    <div className="flow-node product"><span>PRODUCT</span><b>HS category</b><small>2, 4, or 6 digit</small></div>
    <ArrowRight className="flow-arrow" size={19} />
    <div className="flow-node partner"><span>PARTNER</span><b>Country / region</b><small>Mirror comparison</small></div>
    <p className="flow-footnote">These are public statistical dimensions. They do not identify a shipment, FTZ lot, or chain of custody.</p>
  </div>;
}

function RegionWorldMap({ onSelect, leads }: { onSelect: (signal: Lead) => void; leads: Lead[] }) {
  return <div className="world-map-wrap">
    <ComposableMap projection="geoEqualEarth" projectionConfig={{ scale: 155 }} width={760} height={360} aria-label="World map of review leads by partner country">
      <Geographies geography={worldAtlasUrl}>
        {({ geographies }) => geographies.map((geography) => <Geography
          key={geography.rsmKey}
          geography={geography}
          className="world-country"
          style={{ fill: "#ddcfae", stroke: "#f6f1e7", strokeWidth: 0.65, outline: "none" }}
        />)}
      </Geographies>
      {leads.map((signal) => <Marker
        key={signal.id}
        coordinates={signal.coordinates}
        className="zone-map-marker"
        role="button"
        tabIndex={0}
        aria-label={`${signal.product}, ${signal.corridor}: ${signal.type}, ${signal.severity} review priority ${signal.score}.`}
        onClick={() => onSelect(signal)}
        onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); onSelect(signal); } }}
      >
        <title>{`${signal.product} · ${signal.corridor} · ${signal.severity} review lead`}</title>
        <circle className={`map-marker map-${signal.severity.toLowerCase()}`} r={Math.max(6, signal.score / 9)} />
        <circle className={`map-marker-halo map-${signal.severity.toLowerCase()}`} r={Math.max(11, signal.score / 5)} />
      </Marker>)}
    </ComposableMap>
    <div className="world-zone-list">{leads.map((signal) => <button type="button" className="world-zone-row" key={signal.id} onClick={() => onSelect(signal)}><i className={`zone-risk-dot ${signal.severity.toLowerCase()}`} /><span className="world-zone-copy"><b>{signal.product}</b><small>{signal.corridor} · {signal.type}</small></span><SeverityPill severity={signal.severity} /><strong className="world-zone-score">{signal.score}</strong></button>)}</div>
    <details className="map-risk-explanation"><summary>How to read marker colors and scores</summary><div><p>Teal, ochre, and vermilion show the Watch, Review, and Elevated triage bands. The 0–100 value adds up four parts you can inspect on each lead (mirror gap, recency, supplier risk, policy activity). It orders analyst attention; it is not a probability of wrongdoing.</p><button type="button" onClick={() => onSelect(leads[0])}>Open example signal <ArrowRight size={13} /></button></div></details>
    <p className="map-disclaimer">Markers sit on the partner country of each corridor, not on a facility or zone. Leads describe public statistics and aggregate records, not any company.</p>
  </div>;
}

export default function App() {
  const [activeTab, setActiveTab] = useState<Tab>("overview");
  const [months, setMonths] = useState<WindowMonths>(12);
  const signals = useMemo(() => buildLeads(months), [months]);
  const regionOptions = useMemo(() => ["All regions", ...new Set(signals.map((signal) => signal.region))], [signals]);
  const [activeSignalId, setActiveSignalId] = useState(signals[0].id);
  const [productFocus, setProductFocus] = useState<string | undefined>();
  const [search, setSearch] = useState("");
  const [signalType, setSignalType] = useState("All signals");
  const [severity, setSeverity] = useState("All priorities");
  const [regionScope, setRegionScope] = useState("All regions");
  const [savedIds, setSavedIds] = useState<string[]>(readSaved);
  const [notice, setNotice] = useState("");

  useEffect(() => { try { localStorage.setItem(SAVED_KEY, JSON.stringify(savedIds)); } catch { /* storage unavailable: saves last for this session only */ } }, [savedIds]);

  const filteredSignals = useMemo(() => signals.filter((signal) => {
    const query = search.trim().toLowerCase();
    const matchesQuery = !query || [signal.title, signal.corridor, signal.product, signal.code, signal.partner].some((value) => value.toLowerCase().includes(query));
    return matchesQuery && (signalType === "All signals" || signal.type === signalType)
      && (severity === "All priorities" || signal.severity === severity)
      && (regionScope === "All regions" || signal.region === regionScope);
  }), [signals, search, signalType, severity, regionScope]);
  const activeSignal = filteredSignals.find((signal) => signal.id === activeSignalId) ?? filteredSignals[0] ?? null;
  const savedSignals = signals.filter((signal) => savedIds.includes(signal.id) && (regionScope === "All regions" || signal.region === regionScope));
  const regionStats = regionOptions.slice(1).map((region) => ({ region, count: signals.filter((signal) => signal.region === region).length }));
  const signalGroups = [...new Set(signals.map((signal) => signal.type))].map((type) => ({ type, count: signals.filter((signal) => signal.type === type).length }));
  const openLeadForProduct = (productId: string) => { const signal = signals.find((candidate) => candidate.productId === productId); if (!signal) return; setSearch(""); setSignalType("All signals"); setSeverity("All priorities"); setRegionScope("All regions"); setActiveSignalId(signal.id); setActiveTab("signals"); };
  const openProduct = (productId: string) => { setProductFocus(productId); setActiveTab("products"); };
  const toggleSaved = (id: string) => setSavedIds((current) => current.includes(id) ? current.filter((savedId) => savedId !== id) : [...current, id]);

  const signalQueue = (items: Lead[]) => <div className="signal-list">{items.map((signal) => <button className={`signal-row ${activeSignal?.id === signal.id ? "selected" : ""}`} key={signal.id} type="button" onClick={() => { setActiveSignalId(signal.id); setActiveTab("signals"); }}>
    <span className="signal-main"><span className={`signal-mark ${signal.severity.toLowerCase()}`}><Activity size={16} /></span><span className="signal-text"><strong>{signal.title}</strong><span>{signal.product} <i>·</i> {signal.code}</span><small><MapPin size={12} />{signal.region}<i>·</i>{signal.corridor}</small></span></span>
    <span className="signal-period">{signal.period}</span><span className="signal-priority"><SeverityPill severity={signal.severity} /><ScoreBar score={signal.score} /><small>{signal.change}</small></span>
  </button>)}{items.length === 0 && <div className="queue-empty"><Search size={20} /><strong>No matching leads</strong><span>{activeTab === "saved" ? "Save a lead from its detail panel and it will appear here." : "Change or clear the filters to see more leads."}</span><button type="button" onClick={() => { setSearch(""); setSignalType("All signals"); setSeverity("All priorities"); setActiveTab("signals"); }}>Clear filters</button></div>}</div>;

  const signalDetail = (signal: Lead | null) => <aside className="detail-column" aria-label="Selected signal details">{signal ? <>
    <div className="detail-topline"><span className="eyebrow">LEAD DETAIL</span><button className={`save-button ${savedIds.includes(signal.id) ? "saved" : ""}`} type="button" onClick={() => toggleSaved(signal.id)}>{savedIds.includes(signal.id) ? <Check size={14} /> : <BookOpen size={14} />}{savedIds.includes(signal.id) ? "Saved" : "Save lead"}</button></div>
    <SeverityPill severity={signal.severity} /><h2 className="detail-title">{signal.title}</h2><p className="detail-product">{signal.product} <span>·</span> {signal.code}</p>
    <div className="score-feature"><div className="score-number"><strong>{signal.score}</strong><small>/100</small></div><div><b>Analyst review priority</b><span>Sum of the four parts below · triage order, not a finding</span><div className="feature-track"><i style={{ width: `${signal.score}%` }} /></div></div></div>
    <ul className="score-breakdown">{signal.components.map((component) => <li key={component.label}><span>{component.label}</span><span className="score-breakdown-track"><i style={{ width: `${(component.points / component.max) * 100}%` }} /></span><b>{component.points}<small>/{component.max}</small></b><small>{component.detail}</small></li>)}</ul>
    <dl className="record-facts"><div><dt>REGION</dt><dd>{signal.region}</dd></div><div><dt>CORRIDOR</dt><dd>{signal.corridor}</dd></div><div><dt>OBSERVATION PERIOD</dt><dd>{signal.period}</dd></div><div><dt>LEAD TYPE</dt><dd>{signal.type}</dd></div></dl>
    <section className="detail-section"><h3>What was flagged</h3><p>{signal.description}</p><div className="indicator-list">{signal.indicators.map((indicator) => <span key={indicator}>{indicator}</span>)}</div></section>
    <section className="detail-section review-note"><h3>Analyst context</h3><p>{signal.why}</p></section>
    <section className="detail-section source-section"><h3>Public data context</h3><div className="source-chip-list">{signal.publicData.map((source) => <span key={source}>{source}</span>)}</div><p className="source-caveat">Sources support aggregate screening. They do not identify a shipment’s FTZ lot or prove a specific discrepancy.</p><button type="button" className="text-action" onClick={() => openProduct(signal.productId)}>Open trend, suppliers, and rulings in Product watch <ArrowRight size={13} /></button></section>
    <div className="evidence-intake"><div className="intake-icon"><Upload size={17} /></div><div><b>Authorized case records</b><span>Future capability · not connected in this prototype</span></div><button type="button" title="Record upload is not enabled in this mockup." onClick={() => setNotice("Record intake is a future, access-controlled capability. No files are uploaded or analyzed in this mockup.")}><Upload size={14} /> Add records</button><small>With authorized access, admission, lot, inventory movement, processing, withdrawal, and entry records could support case-level reconciliation.</small></div>
    {notice && <div className="inline-notice" role="status">{notice}<button type="button" onClick={() => setNotice("")} aria-label="Dismiss notice">×</button></div>}
  </> : <div className="detail-blank"><FileSearch size={24} /><h2>Choose a review lead</h2><p>Select a row to inspect its scope, context, and public-data limitations.</p></div>}</aside>;

  return (
    <main className="desk-shell">
      <header className="masthead" id="top">
        <a className="brand" href="#top" aria-label="Zenith home"><ZenithMark /><span className="brand-copy"><b>Zenith</b><small>GLOBAL TRADE OBSERVATORY</small></span></a>
        <div className="workspace-tag"><span className="workspace-dot" />ANALYST WORKSPACE</div>
      </header>

      <section className="notice-band" aria-label="Prototype notice"><span className="notice-kicker"><ShieldAlert size={14} /> DEMO DATA</span><span>Leads, the map, and Product watch use real UN Comtrade statistics, Sayari trade-record aggregates, and Tavily news. Trade flows charts are synthetic examples. Scores order review; they are not findings or allegations.</span><button className="notice-help" type="button" title="Only the Trade flows tab uses synthetic examples."><CircleHelp size={15} /></button></section>

      {activeTab === "overview" && <section className="welcome-panel" aria-labelledby="welcome-heading">
          <div className="welcome-copy">
            <p className="welcome-kicker"><Compass size={14} /> ANALYST BRIEFING <span>·</span> GLOBAL TRADE SCREENING</p>
            <h2 id="welcome-heading">Welcome to <em>Zenith.</em></h2>
            <p>Start with public trade patterns, follow a signal to its evidence, and decide what merits a closer look. Every lead stays in human hands.</p>
            <div className="welcome-actions"><button type="button" onClick={() => setActiveTab("signals")}>Review signals <ArrowRight size={15} /></button><button type="button" className="welcome-secondary" onClick={() => document.getElementById("zone-map")?.scrollIntoView({ behavior: "smooth", block: "center" })}>Explore the map <MapPin size={14} /></button></div>
          </div>
          <div className="welcome-side" aria-label="Review workflow">
            <div className="welcome-side-label">A CLEAR REVIEW PATH</div>
            <div className="welcome-step"><span>01</span><i className="welcome-step-mark data-mark"><Activity size={14} /></i><b>Observe</b><small>Public patterns</small></div>
            <div className="welcome-connector"><i /></div>
            <div className="welcome-step"><span>02</span><i className="welcome-step-mark signal-mark-welcome"><Search size={14} /></i><b>Investigate</b><small>Explainable leads</small></div>
            <div className="welcome-connector"><i /></div>
            <div className="welcome-step"><span>03</span><i className="welcome-step-mark person-mark"><Check size={14} /></i><b>Assess</b><small>Human decision</small></div>
          </div>
        </section>}

      <div className="page-intro"><div><p className="eyebrow">GLOBAL TRADE <span>/</span> MULTI-REGION <span>/</span> CORRIDOR MONITOR</p><h1>Trade <em>signal desk</em></h1><p className="intro-copy">Compare public trade patterns across markets; review each lead with its trade, supplier, and policy context.</p></div><div className="view-controls"><label className="period-control"><MapPin size={15} /><select aria-label="Filter region" value={regionScope} onChange={(event) => setRegionScope(event.target.value)}>{regionOptions.map((region) => <option key={region}>{region}</option>)}</select><ChevronDown size={13} /></label><label className="period-control"><Clock3 size={15} /><select aria-label="Reporting period" value={months} onChange={(event) => setMonths(Number(event.target.value) as WindowMonths)}>{WINDOW_OPTIONS.map((option) => <option key={option.months} value={option.months}>{option.label}</option>)}</select><ChevronDown size={13} /></label></div></div>

      <nav className="section-tabs" role="tablist" aria-label="Analyst workspace sections">{tabOptions.map((tab) => <button type="button" role="tab" aria-selected={activeTab === tab.id} className={activeTab === tab.id ? "active" : ""} key={tab.id} onClick={() => setActiveTab(tab.id)}>{tab.icon}<span>{tab.label}</span>{tab.id === "saved" && savedIds.length > 0 && <i className="tab-count">{savedIds.length}</i>}</button>)}</nav>

      {activeTab === "overview" && <>
        <section className="metric-ribbon overview-metrics" aria-label="Overview counts"><div className="metric-cell"><span className="metric-label">REVIEW LEADS</span><strong>{signals.length.toString().padStart(2, "0")}</strong><small>{signals.filter((signal) => signal.severity === "Elevated").length} elevated · {WINDOW_OPTIONS.find((option) => option.months === months)?.label.toLowerCase()}</small></div><div className="metric-cell"><span className="metric-label">REGIONS SHOWN</span><strong>{regionStats.length.toString().padStart(2, "0")}</strong><small>Partner-country regions</small></div><div className="metric-cell"><span className="metric-label">LEAD TYPES</span><strong>{signalGroups.length.toString().padStart(2, "0")}</strong><small>Mirror gap, supplier risk, policy change</small></div><div className="metric-cell metric-note"><span className="metric-label">GLOBAL DATA REALITY</span><strong>Coverage varies by jurisdiction</strong><small>Global trade statistics do not equal FTZ lot-level records.</small></div></section>
        <section className="overview-dashboard-grid">
          <article className="overview-panel region-overview" id="zone-map"><div className="overview-panel-head"><div><p className="eyebrow">CORRIDOR LEADS <span>/</span> PARTNER COUNTRIES</p><h2>Global trade observatory</h2></div><span className="data-chip">COMTRADE · SAYARI · TAVILY</span></div><p className="overview-panel-copy">Choose a marker or row to inspect the lead’s score breakdown, trade pattern, and analyst context.</p><RegionWorldMap leads={signals} onSelect={(signal) => { setActiveSignalId(signal.id); setRegionScope(signal.region); setActiveTab("signals"); }} /></article>
          <article className="overview-panel signal-family-overview"><div className="overview-panel-head"><div><p className="eyebrow">SCREENING TAXONOMY <span>/</span> NOT FINDINGS</p><h2>Signal families</h2></div><Activity size={19} /></div><p className="overview-panel-copy">Expand a category to understand what was flagged, the limits of that signal, and the related example lead.</p><div className="family-list">{signalGroups.map(({ type, count }, index) => { const signal = signals.find((candidate) => candidate.type === type); return <details className="family-disclosure" key={type}><summary className="family-summary"><span className={`family-index family-${index}`}>0{index + 1}</span><span className="family-summary-name">{type}<small>{count.toString().padStart(2, "0")} lead{count === 1 ? "" : "s"}</small></span><ChevronDown size={14} /></summary>{signal && <div className="family-explanation"><p>{signal.description}</p><p className="family-caveat">{signal.why}</p><button type="button" onClick={() => { setActiveSignalId(signal.id); setRegionScope(signal.region); setSignalType(type); setActiveTab("signals"); }}>Open related signal <ArrowRight size={13} /></button></div>}</details>; })}</div><button className="text-action overview-action" type="button" onClick={() => { setSignalType("All signals"); setRegionScope("All regions"); setActiveTab("signals"); }}>Open screening queue <ArrowRight size={14} /></button></article>
        </section>
      </>}

      {activeTab === "signals" && <section className="signal-workspace" id="signals"><div className="signal-column"><div className="section-title-row"><div><p className="eyebrow">01 <span>/</span> SCREENING QUEUE</p><h2>Patterns for human review</h2></div><span className="lead-total">{filteredSignals.length.toString().padStart(2, "0")} LEADS · {WINDOW_OPTIONS.find((option) => option.months === months)?.label.toUpperCase()}</span></div><div className="filter-rack"><label className="search-control"><Search size={16} /><input type="search" placeholder="Search product, country, code…" value={search} onChange={(event) => setSearch(event.target.value)} /></label><label className="filter-control"><Filter size={14} /><select aria-label="Filter by signal type" value={signalType} onChange={(event) => setSignalType(event.target.value)}><option>All signals</option>{[...new Set(signals.map((signal) => signal.type))].map((type) => <option key={type}>{type}</option>)}</select><ChevronDown size={12} /></label><label className="filter-control"><SlidersHorizontal size={14} /><select aria-label="Filter by priority" value={severity} onChange={(event) => setSeverity(event.target.value)}><option>All priorities</option><option>Elevated</option><option>Review</option><option>Watch</option></select><ChevronDown size={12} /></label></div><div className="queue-head"><span>LEAD / PRODUCT</span><span>PERIOD</span><span>REVIEW PRIORITY</span></div>{signalQueue(filteredSignals)}<div className="queue-foot"><span><i className="legend-dot high" /> Elevated <i className="legend-dot medium" /> Review <i className="legend-dot low" /> Watch</span><span>Priority is triage, not probability of wrongdoing.</span></div></div>{signalDetail(activeSignal)}</section>}

      {activeTab === "products" && <ProductWatch key={productFocus} months={months} initialProductId={productFocus} onOpenLead={openLeadForProduct} />}

      {activeTab === "flows" && <section className="tab-page"><div className="section-title-row"><div><p className="eyebrow">03 <span>/</span> TRADE FLOWS</p><h2>Compare reported patterns—not individual cargo</h2></div><span className="data-chip">AGGREGATE PUBLIC DATA</span></div><div className="flow-page-grid"><article className="visual-card"><div className="visual-card-head"><div><p className="eyebrow">TIME SERIES <span>/</span> INDEXED</p><h2>Product group trend</h2></div><span className="chart-legend"><i /> Synthetic example</span></div><TradePulseChart /><p className="visual-footnote">A real implementation would chart sourced public statistics by product, partner, reporter, and period, subject to available fields.</p></article><article className="visual-card"><div className="visual-card-head"><div><p className="eyebrow">PRODUCT GROUPS</p><h2>Compare screening leads</h2></div></div><ProductBars /><p className="visual-footnote">Illustrative index; never interpret as official volumes or a finding.</p></article><article className="visual-card flow-wide"><div className="visual-card-head"><div><p className="eyebrow">PUBLIC DATA CROSS-CHECK</p><h2>Reporter, product, partner</h2></div></div><FlowDiagram /></article></div></section>}

      {activeTab === "saved" && <section className="tab-page"><div className="section-title-row"><div><p className="eyebrow">04 <span>/</span> WORKING FILE</p><h2>Saved review leads</h2></div><span className="lead-total">{savedSignals.length.toString().padStart(2, "0")} SAVED</span></div>{savedSignals.length ? <div className="saved-grid">{savedSignals.map((signal) => <button className="saved-card" key={signal.id} type="button" onClick={() => { setActiveSignalId(signal.id); setActiveTab("signals"); }}><span className="saved-card-top"><SeverityPill severity={signal.severity} /><span>{signal.id}</span></span><b>{signal.title}</b><span>{signal.product} · {signal.code}</span><ScoreBar score={signal.score} /><small>{signal.corridor} · {signal.period}</small></button>)}</div> : <div className="saved-empty"><Bookmark size={24} /><h3>Your working file is empty</h3><p>Open a lead in Signals and choose “Save lead” to keep it here. Saved leads stay in this browser.</p><button type="button" onClick={() => setActiveTab("signals")}>Browse signals <ArrowRight size={14} /></button></div>}</section>}

      {activeTab === "sources" && <section className="tab-page source-page"><div className="section-title-row"><div><p className="eyebrow">05 <span>/</span> DATA &amp; METHOD</p><h2>Know what each layer can support</h2></div><span className="data-chip">GLOBAL FRAME · LOCAL RULES</span></div><div className="coverage-note"><Globe2 size={19} /><div><b>Global trade comparisons, uneven zone-level coverage</b><p>ITC Trade Map supports broad reporter, partner, product, and period comparisons across many markets. It does not identify individual FTZ lots. Census FTZ statistics and USITC DataWeb are U.S.-specific; other jurisdictions require their own official data sources, definitions, and access checks.</p></div></div><div className="source-register">{sourceLinks.map((source) => <a className="register-item" key={source.label} href={source.href} target="_blank" rel="noreferrer"><span className="register-check"><Check size={13} /></span><span className="register-name">{source.label}<small>{source.status} · official external source</small></span><ExternalLink size={14} /></a>)}</div><div className="provider-grid"><article className="provider-card"><h3>Sayari<span className="pending-tag">SNAPSHOT · IN USE</span></h3><p>Bills of lading and customs records for each Product watch corridor, summarized as shipment counts, supplier counts, supplier concentration, and the share of suppliers carrying each category of Sayari risk flag. Zenith shows aggregates only and names no company. Flags describe supplier entities, not the specific shipments in a mirror-gap month.</p></article><article className="provider-card"><h3>Tavily<span className="pending-tag">SNAPSHOT · IN USE</span></h3><p>Web search for recent trade-remedy rulings, tariff actions, and forced-labor enforcement for each watched product. Each item links to its source; official notices are preferred over commentary. Summaries come from search snippets, so confirm against the notice before citing a rate or date.</p></article></div><div className="method-grid"><article><span className="method-number">01</span><h3>Public screening</h3><p>Use public aggregate trade data for product, partner, reporter, and time comparisons where fields are available. Show source, release date, unit, and jurisdiction coverage on each view.</p></article><article><span className="method-number">02</span><h3>Review signal</h3><p>Explain why a pattern was surfaced, what benign explanations may apply, and what evidence is missing. Scores order analyst attention only.</p></article><article><span className="method-number">03</span><h3>Confirm locally</h3><p>Zone records, FTZ definitions, and access rights differ by jurisdiction. Case-level admission, inventory, processing, withdrawal, and entry records require local authority and authorization.</p></article></div><div className="scope-note"><Gauge size={16} /><p><b>Evidence discipline</b> Public trade changes can prioritize review. Confirming movement, inventory discrepancies, origin, trafficking, money laundering, or labor abuse requires relevant records and independent corroboration. The system makes no automated findings.</p><a href="https://www.ecfr.gov/current/title-19/chapter-I/part-146" target="_blank" rel="noreferrer">U.S. FTZ recordkeeping rule <ArrowUpRight size={13} /></a></div></section>}

      <footer className="desk-footer"><span>Zenith <i>·</i> Global trade observatory</span><span>UN Comtrade · Sayari · Tavily <i>·</i> human review only</span></footer>
    </main>
  );
}