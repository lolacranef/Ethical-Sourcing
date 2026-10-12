import { useEffect, useRef } from "react";
import cytoscape, { type EdgeSingular, type ElementDefinition, type NodeSingular, type StylesheetStyle } from "cytoscape";
import dagre from "cytoscape-dagre";

cytoscape.use(dagre);

type GraphViewProps = {
  elements: ElementDefinition[];
  onEntitySelect: (id: string) => void;
  onEdgeSelect: (edge: Record<string, unknown>) => void;
  onExport: () => void;
};

const baseStyle: StylesheetStyle[] = [
  {
    selector: "node",
    style: {
      label: "data(label)",
      width: "mapData(priority_score, 0, 100, 34, 72)",
      height: "mapData(priority_score, 0, 100, 34, 72)",
      "background-color": "mapData(priority_score, 0, 100, #8db8a9, #ef795b)",
      color: "#182b2c",
      "font-family": "DM Sans, sans-serif",
      "font-size": 11,
      "font-weight": 600,
      "text-wrap": "wrap",
      "text-max-width": "110px",
      "text-valign": "bottom",
      "text-margin-y": 8,
      "border-width": 1,
      "border-color": "#fcfcf8",
      "overlay-opacity": 0,
      opacity: (node: NodeSingular) => 0.55 + node.data("priority_score") * 0.0045,
    },
  },
  { selector: "node[?is_seed]", style: { "border-width": 4, "border-color": "#253b39" } },
  { selector: "node[?sanctioned]", style: { shape: "octagon", "border-color": "#c84d3d" } },
  {
    selector: "edge",
    style: {
      width: "mapData(confidence, 0, 1, 1, 4)",
      "line-color": "#89a39e",
      "target-arrow-color": "#89a39e",
      "target-arrow-shape": "triangle",
      "curve-style": "bezier",
      opacity: (edge: EdgeSingular) => 0.25 + edge.data("confidence") * 0.65,
      label: "data(label)",
      "font-size": 9,
      color: "#51615e",
      "text-background-color": "#f7f8f5",
      "text-background-opacity": 0.9,
      "text-background-padding": "2px",
    },
  },
  { selector: 'edge[basis = "document_stated"]', style: { "line-color": "#246b62", "target-arrow-color": "#246b62" } },
  { selector: 'edge[basis = "registry"]', style: { "line-color": "#4e78a0", "target-arrow-color": "#4e78a0" } },
  { selector: 'edge[basis = "web_inferred"]', style: { "line-color": "#d18a3c", "target-arrow-color": "#d18a3c" } },
  { selector: 'edge[label = "OWNS"], edge[label = "CONTROLS"], edge[label = "DIRECTOR_OF"]', style: { "line-style": "dashed" } },
  { selector: 'edge[label = "SHARES_ADDRESS"], edge[label = "NAMED_TOGETHER"]', style: { "line-style": "dotted", "target-arrow-shape": "none" } },
];

export default function GraphView({ elements, onEntitySelect, onEdgeSelect, onExport }: GraphViewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const graphRef = useRef<cytoscape.Core | null>(null);
  const entityCallback = useRef(onEntitySelect);
  const edgeCallback = useRef(onEdgeSelect);

  useEffect(() => { entityCallback.current = onEntitySelect; }, [onEntitySelect]);
  useEffect(() => { edgeCallback.current = onEdgeSelect; }, [onEdgeSelect]);

  useEffect(() => {
    if (!containerRef.current) return;
    const graph = cytoscape({
      container: containerRef.current,
      elements,
      style: baseStyle,
      layout: {
        name: "dagre",
        rankDir: "LR",
        rankSep: 105,
        nodeSep: 48,
        edgeSep: 18,
        fit: true,
        padding: 48,
      } as cytoscape.LayoutOptions,
      minZoom: 0.25,
      maxZoom: 2.5,
      wheelSensitivity: 0.2,
    });
    graphRef.current = graph;
    graph.on("tap", "node", (event) => entityCallback.current(event.target.id()));
    graph.on("tap", "edge", (event) => edgeCallback.current(event.target.data()));
    return () => {
      graph.destroy();
      graphRef.current = null;
    };
  }, [elements]);

  const downloadPng = () => {
    const image = graphRef.current?.png({ full: true, bg: "#fffefa", scale: 2 });
    if (!image) return;
    const anchor = document.createElement("a");
    anchor.download = "ethical-sourcing-graph.png";
    anchor.href = image;
    anchor.click();
  };

  return (
    <section className="graph-wrap" aria-label="Supply chain graph">
      <div ref={containerRef} className="graph-canvas" />
      <button className="icon-button graph-export" type="button" onClick={downloadPng} title="Export graph as PNG" aria-label="Export graph as PNG">
        <span>PNG</span>
      </button>
      <button className="graph-export-data" type="button" onClick={onExport}>Open ranked export</button>
    </section>
  );
}