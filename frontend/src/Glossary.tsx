import { useId, useState } from "react";
import type { ReactNode } from "react";
import { CircleHelp } from "lucide-react";
import type { Band } from "./data";

// Plain-language definitions for the terms the workspace uses. Term shows one inline; the Data & method tab lists them all.
export const glossary = {
  "mirror gap": { term: "Mirror gap", plain: "The difference between what the U.S. says it imported from a country and what that country says it exported to the U.S. The two should roughly match; a big difference is worth a question." },
  "mirror statistics": { term: "Mirror statistics", plain: "Comparing one country's import records against its partner's export records for the same goods and month." },
  "flagged month": { term: "Flagged month", plain: "A month where the mirror gap is bigger than 25% in either direction." },
  "review threshold": { term: "Review threshold (±25%)", plain: "The size of gap Zenith treats as worth a second look. Smaller gaps are normal because of shipping time and how each side values goods." },
  "score": { term: "Review score (0–100)", plain: "How much a lead deserves attention compared with the others, built from four visible parts. It is not the chance that anything is wrong." },
  "band": { term: "Elevated · Review · Watch", plain: "Plain bands for the score. Elevated: look at this first. Review: worth a look. Watch: keep an eye on it." },
  "lead": { term: "Lead", plain: "A product-and-country pair that the data suggests checking. A lead is a question, not an accusation." },
  "corridor": { term: "Corridor", plain: "One trade route: a product shipped from one country to the U.S." },
  "hs code": { term: "HS code", plain: "The international product code customs uses to classify goods, such as 8541.43 for solar modules. Different codes on each side can create a false gap." },
  "fob": { term: "FOB vs. customs value", plain: "Two ways of valuing the same shipment. Exporters usually report the value when goods leave port (FOB); the U.S. reports customs value. Small gaps from this are normal." },
  "ad/cvd": { term: "AD/CVD duties", plain: "Extra U.S. import taxes. Antidumping (AD) duties counter goods sold below fair price; countervailing (CVD) duties counter foreign subsidies. They give importers a reason to disguise where goods come from." },
  "transshipment": { term: "Transshipment", plain: "Sending goods through a third country, sometimes to relabel where they came from and avoid duties." },
  "uflpa": { term: "UFLPA", plain: "The Uyghur Forced Labor Prevention Act. U.S. Customs presumes goods made in Xinjiang, or by companies on its Entity List, used forced labor and can refuse entry." },
  "entity list": { term: "UFLPA Entity List", plain: "Companies the U.S. government has linked to forced labor in Xinjiang. Goods tied to them are presumed banned from import." },
  "ilab": { term: "U.S. Labor Department lists (ILAB)", plain: "Official lists of goods and countries where forced or child labor has been documented. A supplier that exports a listed good from a listed country gets a flag even if it has done nothing wrong itself." },
  "risk flag": { term: "Sayari risk flag", plain: "A warning label attached to a company in Sayari's data, such as links to sanctioned or forced-labor-listed firms. It describes the company, not a particular shipment." },
  "tbml": { term: "Trade-based money laundering", plain: "Moving money by mis-pricing goods on invoices, so value shifts across borders hidden as ordinary trade." },
  "3tg": { term: "Conflict minerals (3TG)", plain: "Tin, tantalum, tungsten, and gold. Mining them can fund armed groups, so buyers are expected to trace where they were mined." },
  "lacey act": { term: "Lacey Act", plain: "A U.S. law banning trade in illegally harvested plants and wood, and requiring import declarations for many wood products." },
  "eudr": { term: "EUDR", plain: "The EU Deforestation Regulation. Sayari uses its country risk ratings to flag exporters of wood and other goods from high-deforestation-risk countries." },
  "ftz": { term: "Foreign-trade zone (FTZ)", plain: "A secure area where goods can be stored or processed before formally entering the country, which can delay when imports are recorded." },
  "bill of lading": { term: "Bill of lading", plain: "The shipping document for a sea shipment. Sayari's shipment counts come from these and from customs records, so air freight like gold is often missing." },
} as const;

export type GlossaryKey = keyof typeof glossary;

export function Term({ k, children }: { k: GlossaryKey; children?: ReactNode }) {
  const [open, setOpen] = useState(false);
  const id = useId();
  return <span className="term" onMouseEnter={() => setOpen(true)} onMouseLeave={() => setOpen(false)}>
    <button type="button" className="term-label" aria-describedby={open ? id : undefined} aria-expanded={open} onClick={() => setOpen((value) => !value)} onFocus={() => setOpen(true)} onBlur={() => setOpen(false)}>{children ?? glossary[k].term}</button>
    {open && <span role="tooltip" id={id} className="term-tip"><b>{glossary[k].term}</b>{glossary[k].plain}</span>}
  </span>;
}

export function HowToRead({ title = "How to read this page", children }: { title?: string; children: ReactNode }) {
  return <details className="how-to-read" open>
    <summary><CircleHelp size={14} /> {title}</summary>
    <div>{children}</div>
  </details>;
}

export const bandMeaning: Record<Band, string> = { Elevated: "Look at this first", Review: "Worth a look", Watch: "Keep an eye on it" };

export function GlossaryList() {
  return <dl className="glossary-list">{Object.values(glossary).map((entry) => <div key={entry.term}><dt>{entry.term}</dt><dd>{entry.plain}</dd></div>)}</dl>;
}
