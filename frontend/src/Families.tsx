import { ArrowRight, ChevronDown } from "lucide-react";
import { GAP_THRESHOLD, Indication, Lead, formatCount, formatDate, formatGap, indicationLabels } from "./data";

type Family = {
  type: Lead["type"];
  question: string;
  detects: string;
  source: string;
  scoring: string;
  components: string[];
  indications: Indication[];
  indicators: { name: string; measure: string; reading: string }[];
  columns: string[];
  row: (lead: Lead) => (string | number)[];
  caveat: string;
};

const pct = (part: number | null, whole: number | null) => part === null || !whole ? "—" : `${Math.round((part / whole) * 100)}%`;

const families: Family[] = [
  {
    type: "Mirror gap",
    question: "Do the two countries’ trade records agree?",
    detects: `Months where the value the United States records importing differs from the value the partner records exporting to the United States, for the same product code, by more than ±${GAP_THRESHOLD}%.`,
    source: "UN Comtrade monthly mirror statistics: U.S. imports at customs value, partner exports at FOB.",
    scoring: "Share of months flagged × 40, plus recency: 15 if the latest month is flagged, 8 if any of the last three are. A lead takes this type when these parts reach 40% of their 55 points.",
    components: ["Mirror gap", "Recency"],
    indications: ["duty-evasion", "tbml", "illegal-harvest"],
    indicators: [
      { name: "Months flagged", measure: `Months beyond ±${GAP_THRESHOLD}% ÷ months both sides reported`, reading: "Persistence. A few flagged months suggest timing; most months flagged suggests a structural difference such as classification." },
      { name: "Median gap", measure: "Middle monthly gap in the window, signed", reading: "Positive: the U.S. records more than the partner ships (possible origin misattribution or routing through the partner). Negative: the partner reports more than the U.S. records (goods recorded elsewhere, diverted, or entering bonded storage)." },
      { name: "Latest gap", measure: "Gap in the most recent month with both sides reported", reading: "Whether the pattern is still live." },
      { name: "Last three months", measure: "Flagged months among the latest three", reading: "Recency. Drives the recency points." },
    ],
    columns: ["Flagged", "Median", "Latest", "Last 3"],
    row: (lead) => [`${lead.metrics.flaggedMonths}/${lead.metrics.monthsWithGap}`, formatGap(lead.metrics.medianGap), formatGap(lead.metrics.latestGap), `${lead.metrics.flaggedLastThree}/3`],
    caveat: "Valuation basis, shipping time across month ends, re-exports, confidential trade, and classification differences all create gaps. Reconcile codes and routing before treating a gap as unexplained.",
  },
  {
    type: "Supplier risk",
    question: "Do the companies shipping it carry warning flags?",
    detects: "How much of the exporter base on the corridor carries a Sayari risk flag in the forced-labor category.",
    source: "Sayari trade records (bills of lading and customs data) and Sayari's entity risk flags. Aggregates only; no company is named.",
    scoring: "Share of suppliers with a forced-labor-category flag × 25, halved when the corridor has fewer than 10 suppliers. A lead takes this type when it reaches half its points and the gap signal is weaker.",
    components: ["Supplier risk"],
    indications: ["forced-labor", "illegal-harvest"],
    indicators: [
      { name: "Suppliers", measure: "Distinct exporting entities on the corridor in Sayari's records", reading: "Sample size. Under 10, shares swing on one or two entities." },
      { name: "Forced-labor-flagged share", measure: "Suppliers with a forced-labor-category flag ÷ suppliers", reading: "Exposure. Flags come from U.S. Labor Department country-and-product lists, UFLPA or Xinjiang links in tiers 2–3, or Sheffield Hallam reports." },
      { name: "Top-five concentration", measure: "Share of shipment records from the five largest suppliers", reading: "Not scored. High concentration means a few entities to request documentation from first." },
    ],
    columns: ["Suppliers", "FL-flagged", "Top-5 share"],
    row: (lead) => [lead.metrics.suppliers === null ? "No records" : formatCount(lead.metrics.suppliers), pct(lead.metrics.forcedLaborSuppliers, lead.metrics.suppliers), lead.metrics.topFiveShare === null ? "—" : `${lead.metrics.topFiveShare}%`],
    caveat: "A flag describes the supplier entity, often through a country-and-product listing or a sub-tier link. It is a reason to ask for origin and labor documentation, not a finding about these shipments.",
  },
  {
    type: "Policy change",
    question: "Has the government recently acted on this product?",
    detects: "Rulings, tariffs, and enforcement actions on the product since the start of the selected period.",
    source: "Tavily web search, with each item checked by a person before it appears. Official notices are preferred over commentary.",
    scoring: "10 points per reviewed item dated since the window start, up to 20. A lead takes this type only when the trade-data signals are quiet.",
    components: ["Policy activity"],
    indications: ["duty-evasion", "forced-labor", "conflict", "illegal-harvest", "tbml"],
    indicators: [
      { name: "Actions in period", measure: "Reviewed rulings, tariffs, or enforcement items dated in the window", reading: "Pressure on the corridor. New duties change incentives to reroute or relabel." },
      { name: "Latest action", measure: "Most recent item and its type", reading: "What to watch for next: import surges before a duty, partner shifts or origin changes after it." },
    ],
    columns: ["Actions", "Latest action"],
    row: (lead) => [lead.metrics.eventsInWindow, lead.metrics.latestEvent ? `${formatDate(lead.metrics.latestEvent.date)} · ${lead.metrics.latestEvent.kind}` : "—"],
    caveat: "A policy event alone is not evidence about any shipment. Most 2026 actions postdate the latest trade data, so their effect is not visible yet.",
  },
];

const familyPoints = (lead: Lead, family: Family) => lead.components.filter((component) => family.components.includes(component.label));

export default function SignalFamilies({ leads, onOpenLead, onShowType }: { leads: Lead[]; onOpenLead: (lead: Lead) => void; onShowType: (type: Lead["type"]) => void }) {
  return <div className="family-list">{families.map((family, index) => {
    const typed = leads.filter((lead) => lead.type === family.type).length;
    const max = familyPoints(leads[0], family).reduce((sum, component) => sum + component.max, 0);
    const ranked = [...leads].sort((a, b) => familyPoints(b, family).reduce((sum, c) => sum + c.points, 0) - familyPoints(a, family).reduce((sum, c) => sum + c.points, 0));
    return <details className="family-disclosure" key={family.type}>
      <summary className="family-summary"><span className={`family-index family-${index}`}>0{index + 1}</span><span className="family-summary-name">{family.type}<em>{family.question}</em><small>{typed.toString().padStart(2, "0")} lead{typed === 1 ? "" : "s"} of this type · up to {max} of 100 points</small></span><ChevronDown size={14} /></summary>
      <div className="family-explanation family-detail">
        <p><b>Detects.</b> {family.detects}</p>
        <p><b>Source.</b> {family.source}</p>
        <p><b>Scoring.</b> {family.scoring}</p>
        <h4>Indicators</h4>
        <dl className="family-indicators">{family.indicators.map((indicator) => <div key={indicator.name}><dt>{indicator.name}</dt><dd><span>{indicator.measure}</span>{indicator.reading}</dd></div>)}</dl>
        <h4>Risk indications it speaks to</h4>
        <div className="indicator-list">{family.indications.map((key) => <span key={key}>{indicationLabels[key]}</span>)}</div>
        <h4>Current values, all leads</h4>
        <div className="family-table"><table>
          <thead><tr><th>Lead</th>{family.columns.map((column) => <th key={column}>{column}</th>)}<th>Points</th></tr></thead>
          <tbody>{ranked.map((lead) => { const parts = familyPoints(lead, family); const points = parts.reduce((sum, c) => sum + c.points, 0);
            return <tr key={lead.id} className={lead.type === family.type ? "typed" : ""} onClick={() => onOpenLead(lead)}>
              <td><button type="button" onClick={(event) => { event.stopPropagation(); onOpenLead(lead); }}>{lead.product}</button><small>{lead.partner}</small></td>
              {family.row(lead).map((value, column) => <td key={column}>{value}</td>)}
              <td className="family-points"><span><i style={{ width: `${(points / max) * 100}%` }} /></span>{points}/{max}</td>
            </tr>; })}</tbody>
        </table></div>
        <p className="family-caveat">{family.caveat}</p>
        {typed > 0 && <button type="button" onClick={() => onShowType(family.type)}>Show {family.type.toLowerCase()} leads in the queue <ArrowRight size={13} /></button>}
      </div>
    </details>; })}</div>;
}
