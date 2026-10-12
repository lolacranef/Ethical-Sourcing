import { useEffect, useState } from "react";
import {
  AlertTriangle,
  ArrowDownToLine,
  ChevronDown,
  FileUp,
  Filter,
  Network,
  RefreshCw,
  Search,
  X,
} from "lucide-react";
import GraphView from "./GraphView";

const API_BASE = import.meta.env.VITE_API_BASE_URL || "http://127.0.0.1:8000";

type Evidence = {
  id: string;
  provider: string;
  source_ref: string;
  snippet: string;
  retrieved_at?: string;
};

type GraphNode = {
  id: string;
  label: string;
  entity_type: string;
  country?: string | null;
  tier: number;
  priority_score: number;
  score_factors: Record<string, number>;
  risk_flags: unknown[];
  is_seed: boolean;
  resolution_status: string;
  overflow_count: number;
};

type GraphEdge = {
  id: string;
  source: string;
  target: string;
  label: string;
  basis: string;
  confidence: number;
  evidence: Evidence[];
};

type GraphData = {
  nodes: { data: GraphNode }[];
  edges: { data: GraphEdge }[];
};

type Investigation = {
  investigation_id: string;
  status: string;
  progress: number;
  error?: string | null;
  params?: { expansion_note?: string };
};

type EntityDetails = {
  id: string;
  canonical_name: string;
  entity_type: string;
  country?: string | null;
  priority_score: number;
  score_factors: Record<string, number>;
  tier: number;
  is_seed: boolean;
  resolution_status: string;
  evidence: Evidence[];
};

type ProviderStatus = { active: string[]; inactive: string[] };

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, options);
  if (!response.ok) {
    const body = await response.json().catch(() => ({ detail: response.statusText }));
    throw new Error(body.detail || `Request failed (${response.status})`);
  }
  return response.json() as Promise<T>;
}

export default function App() {
  const [providers, setProviders] = useState<ProviderStatus>({ active: [], inactive: [] });
  const [investigation, setInvestigation] = useState<Investigation | null>(null);
  const [graph, setGraph] = useState<GraphData>({ nodes: [], edges: [] });
  const [selectedEntity, setSelectedEntity] = useState<EntityDetails | null>(null);
  const [selectedEdge, setSelectedEdge] = useState<GraphEdge | null>(null);
  const [minimumPriority, setMinimumPriority] = useState(0);
  const [maximumTier, setMaximumTier] = useState(3);
  const [basisFilter, setBasisFilter] = useState("all");
  const [edgeTypeFilter, setEdgeTypeFilter] = useState("all");
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    request<{ providers: ProviderStatus }>("/health")
      .then((health) => setProviders(health.providers))
      .catch(() => setError("The API is unavailable. Start the backend to upload and analyze a document."));
  }, []);

  useEffect(() => {
    if (!investigation?.investigation_id || ["completed", "failed"].includes(investigation.status)) return;
    let cancelled = false;
    const poll = async () => {
      try {
        const updated = await request<Investigation>(`/investigations/${investigation.investigation_id}`);
        if (cancelled) return;
        setInvestigation(updated);
        if (updated.status === "completed") {
          setGraph(await request<GraphData>(`/investigations/${investigation.investigation_id}/graph`));
        }
      } catch (reason) {
        if (!cancelled) setError(reason instanceof Error ? reason.message : "Unable to retrieve investigation status.");
      }
    };
    void poll();
    const timer = window.setInterval(poll, 1300);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [investigation?.investigation_id, investigation?.status]);

  const visibleNodes = graph.nodes.filter(({ data }) =>
    data.tier <= maximumTier && data.priority_score >= minimumPriority,
  );
  const visibleIds = new Set(visibleNodes.map(({ data }) => data.id));
  const visibleEdges = graph.edges.filter(({ data }) =>
    visibleIds.has(data.source) && visibleIds.has(data.target)
    && (basisFilter === "all" || data.basis === basisFilter)
    && (edgeTypeFilter === "all" || data.label === edgeTypeFilter),
  );
  const rankedNodes = [...visibleNodes].sort((left, right) => right.data.priority_score - left.data.priority_score);
  const edgeTypes = [...new Set(graph.edges.map(({ data }) => data.label))].sort();

  const uploadFile = async (file?: File) => {
    if (!file) return;
    setIsUploading(true);
    setError("");
    setSelectedEntity(null);
    setSelectedEdge(null);
    setGraph({ nodes: [], edges: [] });
    setInvestigation(null);
    try {
      const form = new FormData();
      form.append("file", file);
      const document = await request<{ document_id: string }>("/documents", { method: "POST", body: form });
      const started = await request<{ investigation_id: string; status: string }>("/investigations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ document_id: document.document_id }),
      });
      setInvestigation({ ...started, progress: 0 });
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Upload failed.");
    } finally {
      setIsUploading(false);
    }
  };

  const selectEntity = async (id: string) => {
    setSelectedEdge(null);
    try {
      setSelectedEntity(await request<EntityDetails>(`/entities/${id}`));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to load entity evidence.");
    }
  };

  const exportRanked = () => {
    if (!investigation) return;
    window.open(`${API_BASE}/investigations/${investigation.investigation_id}/export.csv`, "_blank", "noopener,noreferrer");
  };

  return (
    <main className="app-shell">
      <header className="topbar">
        <div className="brand-lockup">
          <div className="brand-mark"><Network size={19} strokeWidth={2.2} /></div>
          <div><strong>SourceSight</strong><span>ETHICAL SOURCING TRACER</span></div>
        </div>
        <div className="provider-status" aria-label="Active data providers">
          <span className="status-light" />
          <span>{providers.active.length ? providers.active.join(" · ") : "No live providers"}</span>
          <span className="provider-separator">/</span>
          <span className="muted">{providers.inactive.join(" · ")}</span>
        </div>
        <label className={`upload-button ${isUploading ? "is-busy" : ""}`}>
          {isUploading ? <RefreshCw size={16} className="spin" /> : <FileUp size={16} />}
          <span>{isUploading ? "Uploading" : "Upload source"}</span>
          <input
            type="file"
            accept=".pdf,.docx,.xlsx,.xlsm,.csv,.txt,.md"
            disabled={isUploading}
            onChange={(event) => { void uploadFile(event.target.files?.[0]); event.currentTarget.value = ""; }}
          />
        </label>
      </header>

      <section className="notice-strip">
        <AlertTriangle size={15} />
        <span>Web-inferred links are unverified leads. Priority is for review only, not a finding or legal determination.</span>
        {investigation?.params?.expansion_note && <span className="notice-extra">{investigation.params.expansion_note}</span>}
      </section>

      {error && <div className="error-strip" role="alert"><span>{error}</span><button type="button" onClick={() => setError("")} aria-label="Dismiss error"><X size={16} /></button></div>}

      <section className="workspace-head">
        <div>
          <p className="eyebrow">INVESTIGATION WORKSPACE</p>
          <h1>{investigation ? "Supply chain map" : "Evidence-led supply chain research"}</h1>
        </div>
        {investigation && <div className="run-status">
          <span className={`run-dot ${investigation.status}`} />
          <span>{investigation.status.replaceAll("_", " ")}</span>
          <strong>{investigation.progress}%</strong>
        </div>}
      </section>

      {investigation && !["completed", "failed"].includes(investigation.status) && (
        <div className="progress-track"><span style={{ width: `${investigation.progress}%` }} /></div>
      )}
      {investigation?.status === "failed" && <div className="failure-panel"><strong>Investigation stopped</strong><span>{investigation.error}</span><small>Document text remains stored locally. Configure the required provider key, then upload this source again.</small></div>}

      {graph.nodes.length === 0 ? (
        <section className="empty-state">
          <div className="empty-grid"><div className="empty-orbit orbit-a" /><div className="empty-orbit orbit-b" /><Network size={34} /></div>
          <h2>{investigation?.status === "completed" ? "No entities were extracted" : "Start with a source document"}</h2>
          <p>{investigation?.status === "completed" ? "The extraction returned no source-grounded entities." : "Upload a notice, filing, customs record, report, spreadsheet, or text file to begin."}</p>
          {!investigation && <label className="empty-upload">Choose document<input type="file" accept=".pdf,.docx,.xlsx,.xlsm,.csv,.txt,.md" onChange={(event) => { void uploadFile(event.target.files?.[0]); event.currentTarget.value = ""; }} /></label>}
        </section>
      ) : (
        <>
          <section className="summary-row" aria-label="Investigation summary">
            <div><span>VISIBLE ENTITIES</span><strong>{visibleNodes.length}</strong></div>
            <div><span>EVIDENCED LINKS</span><strong>{visibleEdges.length}</strong></div>
            <div><span>DEEPEST TIER</span><strong>{Math.max(0, ...visibleNodes.map(({ data }) => data.tier))}</strong></div>
            <div className="summary-actions">
              <a href={`${API_BASE}/investigations/${investigation?.investigation_id}/export.md`} target="_blank" rel="noreferrer" title="Download evidence report as Markdown"><ArrowDownToLine size={15} /> Evidence report</a>
              <button type="button" onClick={exportRanked} title="Export entity table as CSV"><ArrowDownToLine size={15} /> CSV</button>
            </div>
          </section>

          <section className="filter-bar">
            <div className="filter-label"><Filter size={15} /><span>FILTERS</span></div>
            <label className="range-filter">Minimum priority <strong>{minimumPriority}</strong><input type="range" min="0" max="100" step="5" value={minimumPriority} onChange={(event) => setMinimumPriority(Number(event.target.value))} /></label>
            <label className="select-filter">Tier depth <span className="select-wrap"><select value={maximumTier} onChange={(event) => setMaximumTier(Number(event.target.value))}><option value="0">Tier 0</option><option value="1">Through 1</option><option value="2">Through 2</option><option value="3">Through 3</option></select><ChevronDown size={13} /></span></label>
            <label className="select-filter">Evidence basis <span className="select-wrap"><select value={basisFilter} onChange={(event) => setBasisFilter(event.target.value)}><option value="all">All bases</option><option value="document_stated">Document stated</option><option value="registry">Registry</option><option value="web_inferred">Web inferred</option></select><ChevronDown size={13} /></span></label>
            <label className="select-filter">Link type <span className="select-wrap"><select value={edgeTypeFilter} onChange={(event) => setEdgeTypeFilter(event.target.value)}><option value="all">All types</option>{edgeTypes.map((type) => <option key={type} value={type}>{type.replaceAll("_", " ")}</option>)}</select><ChevronDown size={13} /></span></label>
          </section>

          <section className="content-grid">
            <div className="main-column">
              <div className="section-heading"><div><span className="section-index">01</span><h2>Relationship map</h2></div><span className="layout-note">SEED <i /> UPSTREAM TIERS</span></div>
              <GraphView
                elements={[
                  ...visibleNodes.map(({ data }) => ({ data: { ...data, sanctioned: data.risk_flags.some((flag) => String(flag).toLowerCase().includes("sanction")) } })),
                  ...visibleEdges.map(({ data }) => ({ data })),
                ]}
                onEntitySelect={(id) => { void selectEntity(id); }}
                onEdgeSelect={(edge) => { setSelectedEntity(null); setSelectedEdge(edge as unknown as GraphEdge); }}
                onExport={exportRanked}
              />
              <div className="legend-row">
                <span><i className="legend-line stated" /> Document stated</span>
                <span><i className="legend-line registry" /> Registry</span>
                <span><i className="legend-line inferred" /> Web-inferred lead</span>
                <span className="legend-note">Link opacity reflects confidence</span>
              </div>

              <div className="section-heading table-heading"><div><span className="section-index">02</span><h2>Priority queue</h2></div><span className="table-count">{rankedNodes.length} ENTITIES</span></div>
              <div className="table-wrap">
                <table>
                  <thead><tr><th>ENTITY</th><th>TYPE</th><th>COUNTRY</th><th>TIER</th><th>PRIORITY</th><th>RESOLUTION</th><th /></tr></thead>
                  <tbody>{rankedNodes.map(({ data }) => <tr key={data.id} onClick={() => { void selectEntity(data.id); }}>
                    <td><span className={`entity-dot ${data.is_seed ? "seed" : ""}`} /><strong>{data.label}</strong>{data.is_seed && <span className="seed-tag">SOURCE</span>}</td>
                    <td>{data.entity_type}</td><td>{data.country || "—"}</td><td>{data.tier}</td>
                    <td><div className="score-cell"><span className="score-track"><i style={{ width: `${data.priority_score}%` }} /></span><b>{Math.round(data.priority_score)}</b></div></td>
                    <td><span className={`resolution-pill ${data.resolution_status}`}>{data.resolution_status}</span></td>
                    <td><Search size={14} className="row-search" /></td>
                  </tr>)}</tbody>
                </table>
                {rankedNodes.length === 0 && <div className="filter-empty">No entities match these filters.</div>}
              </div>
            </div>

            <aside className={`detail-panel ${selectedEntity || selectedEdge ? "has-selection" : ""}`}>
              {selectedEntity ? <EntityPanel entity={selectedEntity} onClose={() => setSelectedEntity(null)} />
                : selectedEdge ? <EvidencePanel edge={selectedEdge} onClose={() => setSelectedEdge(null)} />
                  : <div className="detail-empty"><div className="detail-mark"><Search size={19} /></div><p>Select a node or link to inspect its evidence.</p></div>}
            </aside>
          </section>
        </>
      )}

      <footer className="app-footer"><span>SourceSight <b>·</b> Local research workspace</span><span>Evidence first <b>·</b> Inference clearly labeled</span></footer>
    </main>
  );
}

function EntityPanel({ entity, onClose }: { entity: EntityDetails; onClose: () => void }) {
  return <>
    <div className="panel-header"><div><span className="eyebrow">ENTITY RECORD · TIER {entity.tier}</span><h3>{entity.canonical_name}</h3></div><button className="icon-button" type="button" onClick={onClose} title="Close details" aria-label="Close details"><X size={16} /></button></div>
    <div className="entity-meta"><span>{entity.entity_type}</span>{entity.country && <span>{entity.country}</span>}<span>{entity.resolution_status}</span></div>
    <div className="priority-block"><span>REVIEW PRIORITY</span><strong>{Math.round(entity.priority_score)}<small>/100</small></strong></div>
    <h4>Score factors</h4>
    <div className="factor-list">{Object.entries(entity.score_factors).map(([name, value]) => <div key={name}><span>{name.replaceAll("_", " ")}</span><b>{value}</b></div>)}</div>
    <h4>Evidence <span className="evidence-count">{entity.evidence.length}</span></h4>
    <EvidenceList items={entity.evidence} />
  </>;
}

function EvidencePanel({ edge, onClose }: { edge: GraphEdge; onClose: () => void }) {
  return <>
    <div className="panel-header"><div><span className="eyebrow">RELATIONSHIP · {edge.basis.replaceAll("_", " ")}</span><h3>{edge.label}</h3></div><button className="icon-button" type="button" onClick={onClose} title="Close evidence" aria-label="Close evidence"><X size={16} /></button></div>
    <div className="edge-confidence"><span>CONFIDENCE</span><strong>{Math.round(edge.confidence * 100)}%</strong></div>
    <div className="lead-label"><AlertTriangle size={14} />{edge.basis === "web_inferred" ? "Unverified web lead" : "Source-supported relationship"}</div>
    <h4>Supporting evidence <span className="evidence-count">{edge.evidence.length}</span></h4>
    <EvidenceList items={edge.evidence} />
  </>;
}

function EvidenceList({ items }: { items: Evidence[] }) {
  if (!items.length) return <p className="no-evidence">No evidence records are available.</p>;
  return <div className="evidence-list">{items.map((item) => <article className="evidence-item" key={item.id}>
    <div className="evidence-provider"><span>{item.provider}</span>{item.retrieved_at && <time>{new Date(item.retrieved_at).toLocaleDateString()}</time>}</div>
    <blockquote>{item.snippet}</blockquote>
    {item.source_ref.startsWith("http") ? <a href={item.source_ref} target="_blank" rel="noreferrer">Open source <ArrowDownToLine size={12} /></a> : <span className="source-ref">{item.source_ref}</span>}
  </article>)}</div>;
}