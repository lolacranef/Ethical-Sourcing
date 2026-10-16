import { ArrowRight, BookOpenCheck, ChevronDown, Database, Search } from "lucide-react";
import { ASSESSED_ON, DATA_THROUGH, Priority, flowObservations, indicationGuide, productAssessments } from "./analysisNotes";
import { HowToRead } from "./Glossary";
import { Band, Indication, WINDOW_OPTIONS, WindowMonths, buildLeads, formatDate, formatGap, fullSeries, indicationLabels, mirrorData, products, shortPartner } from "./data";

const priorityOrder: Record<Priority, number> = { High: 0, Medium: 1, Low: 2 };
const priorityClass: Record<Priority, string> = { High: "elevated", Medium: "review", Low: "watch" };
const formatUsd = (value: number) => value >= 1e9 ? `$${(value / 1e9).toFixed(2)}B` : `$${Math.round(value / 1e6)}M`;
const windowLabel = (months: WindowMonths) => WINDOW_OPTIONS.find((option) => option.months === months)?.label.toLowerCase() ?? "";

function Pill({ band, label }: { band: string; label: string }) {
  return <span className={`severity-pill ${band}`}><i />{label}</span>;
}

function AssessmentNote({ months }: { months: WindowMonths }) {
  return <p className="analysis-note"><BookOpenCheck size={14} /> Analyst assessment written {formatDate(ASSESSED_ON)} from data through {formatDate(DATA_THROUGH)}. Scores and figures below follow the period selector ({windowLabel(months)}); the written assessment does not. Ratings order review; they are not findings about any country or company.</p>;
}

export function ProductAnalysis({ months, onOpenTrend, onOpenLead }: { months: WindowMonths; onOpenTrend: (productId: string) => void; onOpenLead: (productId: string) => void }) {
  const leads = Object.fromEntries(buildLeads(months).map((lead) => [lead.productId, lead]));
  const rated = products.filter((product) => productAssessments[product.id] && leads[product.id])
    .sort((a, b) => priorityOrder[productAssessments[a.id].priority] - priorityOrder[productAssessments[b.id].priority] || leads[b.id].score - leads[a.id].score);

  return <div className="analysis-view">
    <AssessmentNote months={months} />
    <HowToRead><p>Start with <b>Review priority by product</b>: High means look at it first. The <b>Zenith score</b> comes straight from the data; the <b>overall priority</b> is an analyst’s judgment after allowing for known reporting quirks. Open a <b>product brief</b> for what the data shows, innocent explanations, and what to check next.</p></HowToRead>

    <article className="visual-card analysis-card">
      <div className="visual-card-head"><div><p className="eyebrow">ANALYSIS <span>/</span> RISK INDICATIONS</p><h2>What each indication means</h2></div></div>
      <div className="table-scroll analysis-table"><table>
        <thead><tr><th>Indication</th><th>What it means</th><th>What would confirm it</th><th>Products</th></tr></thead>
        <tbody>{(Object.keys(indicationGuide) as Indication[]).map((key) => <tr key={key}>
          <td><b>{indicationLabels[key]}</b></td><td>{indicationGuide[key].meaning}</td><td>{indicationGuide[key].confirm}</td>
          <td><span className="analysis-chips">{products.filter((product) => product.indications.includes(key)).map((product) => <button type="button" key={product.id} onClick={() => onOpenTrend(product.id)}>{product.name}</button>)}</span></td>
        </tr>)}</tbody>
      </table></div>
      <p className="visual-footnote">An indication is the reason a product is watched. It says nothing yet about any specific corridor, supplier, or shipment.</p>
    </article>

    <article className="visual-card analysis-card">
      <div className="visual-card-head"><div><p className="eyebrow">ANALYSIS <span>/</span> RISK RATINGS</p><h2>Review priority by product</h2></div></div>
      <p className="analysis-legend"><b>Zenith score</b> is computed from the data (mirror gap, recency, supplier risk, policy activity). <b>Overall priority</b> is the analyst’s read of that score after discounting signals that are likely reporting artifacts.</p>
      <div className="table-scroll analysis-table"><table>
        <thead><tr><th>Product (partner)</th><th>Indications</th><th>Zenith score</th><th>Overall priority</th><th>Why</th><th /></tr></thead>
        <tbody>{rated.map((product) => { const lead = leads[product.id]; const assessment = productAssessments[product.id];
          return <tr key={product.id}>
            <td><b>{product.name}</b><small>{shortPartner(mirrorData[product.id].partner.name)} · {product.hs}</small></td>
            <td><small>{product.indications.map((key) => indicationLabels[key]).join(" · ")}</small></td>
            <td><span className="analysis-score"><b>{lead.score}</b><Pill band={lead.severity.toLowerCase()} label={lead.severity as Band} /></span></td>
            <td><Pill band={priorityClass[assessment.priority]} label={assessment.priority} /></td>
            <td>{assessment.rationale}</td>
            <td><button type="button" className="text-action" onClick={() => onOpenLead(product.id)}>Lead <ArrowRight size={12} /></button></td>
          </tr>; })}</tbody>
      </table></div>
    </article>

    <article className="visual-card analysis-card">
      <div className="visual-card-head"><div><p className="eyebrow">ANALYSIS <span>/</span> FURTHER INQUIRY</p><h2>Product briefs</h2></div></div>
      <div className="brief-list">{rated.map((product) => { const assessment = productAssessments[product.id]; const lead = leads[product.id];
        return <details className="brief" key={product.id}>
          <summary><Pill band={priorityClass[assessment.priority]} label={assessment.priority} /><b>{product.name}</b><span>{shortPartner(mirrorData[product.id].partner.name)} → U.S. · score {lead.score}</span><ChevronDown size={14} /></summary>
          <div className="brief-body">
            <div><h3>What the data shows</h3><p>{assessment.pattern}</p></div>
            <div><h3>Possible benign explanations</h3><p>{assessment.benign}</p></div>
            <div><h3>Check next</h3><ul>{assessment.checks.map((check) => <li key={check}><Search size={11} />{check}</li>)}</ul></div>
            <div className="brief-actions"><button type="button" onClick={() => onOpenTrend(product.id)}>Open trend and corridor intelligence <ArrowRight size={13} /></button><button type="button" className="secondary" onClick={() => onOpenLead(product.id)}>Open review lead <ArrowRight size={13} /></button></div>
          </div>
        </details>; })}</div>
    </article>
  </div>;
}

type FlowRow = { id: string; name: string; partner: string; imports: number; prior: number | null; exports: number; volatility: number };
const volatilityLabel = (cv: number) => cv < 0.3 ? "Low" : cv < 0.5 ? "Moderate" : cv < 0.8 ? "High" : "Very high";

export function FlowsAnalysis({ months, onOpenProduct }: { months: WindowMonths; onOpenProduct: (productId: string) => void }) {
  const rows: FlowRow[] = products.filter((product) => fullSeries[product.id]).map((product) => {
    const points = fullSeries[product.id], current = points.slice(-months), earlier = points.length >= months * 2 ? points.slice(-months * 2, -months) : null;
    const total = (values: (number | null)[]) => values.reduce<number>((sum, value) => sum + (value ?? 0), 0);
    const monthly = current.map((point) => point.reported).filter((value): value is number => value !== null);
    const mean = total(monthly) / Math.max(1, monthly.length);
    const sd = Math.sqrt(total(monthly.map((value) => (value - mean) ** 2)) / Math.max(1, monthly.length));
    return { id: product.id, name: product.name, partner: shortPartner(mirrorData[product.id].partner.name), imports: total(current.map((point) => point.reported)), prior: earlier ? total(earlier.map((point) => point.reported)) : null, exports: total(current.map((point) => point.mirror)), volatility: mean ? sd / mean : 0 };
  }).sort((a, b) => b.imports - a.imports);
  const lastMonth = fullSeries[products[0].id].at(-1)!.month;

  return <div className="analysis-view">
    <AssessmentNote months={months} />
    <HowToRead><p>Each row is one trade route. <b>U.S. imports</b> is what the U.S. recorded; <b>partner-reported exports</b> is what the other country recorded sending. The <b>gap</b> compares the two (red when they differ by more than 25%). <b>Volatility</b> shows how much monthly imports jump around; very high volatility often follows new duties.</p></HowToRead>
    <article className="visual-card analysis-card">
      <div className="visual-card-head"><div><p className="eyebrow">ANALYSIS <span>/</span> CORRIDOR FLOWS <span>/</span> {windowLabel(months).toUpperCase()} TO {lastMonth.toUpperCase()}</p><h2>Real trade flows behind each lead</h2></div><span className="data-chip">UN COMTRADE</span></div>
      <div className="table-scroll analysis-table"><table>
        <thead><tr><th>Corridor</th><th>U.S. imports</th><th>Change vs prior {months} mo</th><th>Partner-reported exports</th><th>Gap</th><th>Monthly volatility</th><th /></tr></thead>
        <tbody>{rows.map((row) => { const change = row.prior ? Math.round(((row.imports - row.prior) / row.prior) * 1000) / 10 : null; const gap = row.exports ? Math.round(((row.imports - row.exports) / row.exports) * 1000) / 10 : null;
          return <tr key={row.id}>
            <td><b>{row.name}</b><small>{row.partner} → U.S.</small></td>
            <td className="num">{formatUsd(row.imports)}</td>
            <td className="num">{change === null ? <small>Needs {months * 2} months</small> : formatGap(change)}</td>
            <td className="num">{formatUsd(row.exports)}</td>
            <td className={`num ${gap !== null && Math.abs(gap) > 25 ? "over" : ""}`}>{formatGap(gap)}</td>
            <td>{volatilityLabel(row.volatility)}</td>
            <td><button type="button" className="text-action" onClick={() => onOpenProduct(row.id)}>Trend <ArrowRight size={12} /></button></td>
          </tr>; })}</tbody>
      </table></div>
      <p className="visual-footnote">Gap = U.S. imports ÷ partner-reported exports − 1 over the period; above ±25% is highlighted. Volatility is the spread of monthly U.S. import values around their average. Only the largest supplier country per product is tracked, so moves between origins are not visible yet.</p>
    </article>
    <div className="observation-grid">{flowObservations.map((item) => <article key={item.title} className="provider-card"><h3>{item.title}</h3><p>{item.body}</p></article>)}</div>
    <p className="data-provenance"><Database size={12} /> Source: UN Comtrade monthly mirror statistics. Figures recompute with the period selector.</p>
  </div>;
}
