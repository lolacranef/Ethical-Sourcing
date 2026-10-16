import type { Indication } from "./data";

// Analyst assessment written on the date below from data through the stated month. The live
// numbers in the Analysis views are recomputed from the data files; this text is not.
export const ASSESSED_ON = "2026-10-15";
export const DATA_THROUGH = "2026-07";

export type Priority = "High" | "Medium" | "Low";

export const indicationGuide: Record<Indication, { meaning: string; confirm: string }> = {
  "forced-labor": {
    meaning: "Inputs may be made with forced labor, especially in Xinjiang. Under the UFLPA, U.S. Customs presumes such goods are barred unless the importer proves the supply chain is clean.",
    confirm: "Tracing back to the raw material, supplier names checked against the UFLPA Entity List, and isotopic testing for cotton.",
  },
  "duty-evasion": {
    meaning: "Goods routed through or relabeled in a third country to avoid antidumping or countervailing duties.",
    confirm: "Partner shifts after a duty order, import surges just before duties, and origin documents that don't match production capacity.",
  },
  tbml: {
    meaning: "Value moved by mis-invoicing high-value goods. FATF identifies gold as especially attractive for this.",
    confirm: "Unit values out of line with market price, and gaps between declared value and payment flows.",
  },
  conflict: {
    meaning: "Tin, tantalum, tungsten, or gold (3TG) that may finance armed groups.",
    confirm: "A smelter or refiner audited under the Responsible Minerals Initiative, and mine-of-origin evidence.",
  },
  "illegal-harvest": {
    meaning: "Timber, honey, or similar goods harvested illegally or mislabeled by origin.",
    confirm: "Lacey Act declarations, species and origin testing, and harvest permits.",
  },
};

export type ProductAssessment = { priority: Priority; rationale: string; pattern: string; benign: string; checks: string[] };

export const productAssessments: Record<string, ProductAssessment> = {
  solar: {
    priority: "High",
    rationale: "Sharpest reversal in the dataset, timed with the preliminary duties; forced-labor flags are common among suppliers.",
    pattern: "U.S.-recorded imports climbed from about $50M a month in early 2025 to $408M in November 2025, well above what Indonesia reported exporting. After preliminary countervailing duties took effect on February 26, 2026, U.S. imports fell to about $7M a month, while Indonesia still reported $126–161M a month and rising.",
    benign: "Goods entering bonded warehouses or foreign-trade zones, a shift between cell (8541.42) and module (8541.43) codes, or reporting lags.",
    checks: ["U.S. imports of 8541.42 and 8541.43 from other origins since March 2026", "How Indonesia records the destination of its 2026 solar exports", "Entries ahead of the November 2, 2026 AD/CVD orders"],
  },
  cotton: {
    priority: "High",
    rationale: "Persistent shortfall in U.S.-recorded imports plus broad forced-labor exposure in the sector.",
    pattern: "U.S. imports fell about a third year on year. India consistently reports about 20% more than the U.S. records, and half the months are flagged, including the latest.",
    benign: "Valuation and timing differences, or goods recorded against another destination. Most supplier flags come from India's garments appearing on the U.S. Labor Department lists, so they describe the sector, not individual suppliers.",
    checks: ["Yarn and fabric origin for the main exporters, not only the garment origin", "Exposure to the 43 UFLPA Entity List additions of August 2026", "Whether lost U.S. volume moved to other garment origins"],
  },
  timber: {
    priority: "Medium",
    rationale: "Score is driven by a gap that is probably a classification artifact, but import growth and deforestation flags keep it on watch.",
    pattern: "Every month is flagged: the U.S. records about eight times what Brazil reports. U.S. imports rose about 150% year on year.",
    benign: "A gap this large and steady usually means the two sides classify the wood under different 4407 subheadings.",
    checks: ["Brazil's exports to the U.S. under neighboring 4407 codes", "Lacey Act declarations for the species involved", "Effect of the 25% Section 301 tariff from July 22, 2026"],
  },
  tin: {
    priority: "Medium",
    rationale: "Large positive gap in a conflict mineral, but only two suppliers and likely route-attribution effects.",
    pattern: "The U.S. records about twice what Bolivia reports over 12 months, with lumpy monthly swings. Sayari holds records for only two suppliers, ending December 2024.",
    benign: "Bolivia is landlocked and ships through Chilean ports, so the two sides may attribute the trade differently. Bolivia is not a covered country under the Dodd-Frank conflict-minerals rule.",
    checks: ["Whether the smelter is audited under the Responsible Minerals Initiative", "Chilean transit and export records for Bolivian tin", "Newer shipment records after 2024"],
  },
  honey: {
    priority: "Medium",
    rationale: "Annual totals reconcile; the risk is origin switching under an active antidumping order.",
    pattern: "Across 12 months the two sides match, but single months swing from −69% to +170%. U.S. imports fell about a quarter.",
    benign: "Shipping time across month ends explains most of the monthly swings when annual totals match.",
    checks: ["Shifts between India, Argentina, Brazil, and Vietnam under the 2022 AD orders", "Unit values against world honey prices (adulteration risk)", "Exporters added or dropped in the 2024–25 review"],
  },
  gold: {
    priority: "Medium",
    rationale: "High inherent risk, but the persistent gap looks structural and shipment records can't see this trade.",
    pattern: "The U.S. records far less than Switzerland reports in all 24 months (median −71%). In January 2025 alone Switzerland reported $17B of gold exports to the U.S. against $0.6B recorded by the U.S.",
    benign: "A gap this steady is usually classification or origin attribution. The early-2025 spike fits widely reported tariff-driven gold movements (not verified here).",
    checks: ["Refiner due diligence under LBMA guidance", "Unit values and payment flows, since bills of lading don't capture air-freighted gold", "How each side classifies monetary vs. non-monetary gold"],
  },
  seafood: {
    priority: "Medium",
    rationale: "Inherent forced-labor and duty risk; the trade data itself mostly reconciles.",
    pattern: "Over 12 months the gap is small (+7%). The flagged months look like timing effects. U.S. imports fell about a fifth.",
    benign: "Monthly gaps that offset over the year usually reflect shipping time and seasonal packing.",
    checks: ["Vessel-level forced-labor evidence for the main processors", "Sourcing shifts toward other shrimp origins", "Exporters still in the 2025–26 antidumping review"],
  },
  aluminum: {
    priority: "Low",
    rationale: "Clean, stable reconciliation; the inherent risk sits upstream, not in this corridor.",
    pattern: "Monthly gaps stay between 1% and 18%, and none is flagged. U.S. imports fell about 14%. Few suppliers carry risk flags.",
    benign: "Small positive gaps are normal valuation and timing effects.",
    checks: ["Whether Canadian smelters re-melt metal of Chinese origin", "Effect of the 50% Section 338 tariffs on Canadian aluminum from September 15, 2026"],
  },
};

export const flowObservations = [
  { title: "Duties move trade fast", body: "Solar shows the textbook pattern: imports surge ahead of duties, then collapse once they apply. Expect similar moves when the solar AD/CVD orders, the Brazil tariff, and the Canada tariffs show up in August–October data." },
  { title: "India's flows are shrinking across the board", body: "Cotton, shrimp, and honey are all down sharply year on year. The cause isn't in Zenith's data, but it's worth checking whether that sourcing moved to other origins." },
  { title: "Twelve-month totals can hide offsetting swings", body: "Solar's modest annual gap combines a large positive gap in 2025 with a large negative one in 2026. Read the monthly chart, not the annual total." },
];
