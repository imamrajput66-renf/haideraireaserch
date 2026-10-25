import { parse, type MathNode } from "mathjs";
import dagre from "@dagrejs/dagre";
import type { VisualPlan } from "./schema";

const esc = (s: string) => s.replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;" }[c] ?? c));
const colors = { primary: "var(--visual-primary)", energy: "var(--visual-energy)", secondary: "var(--visual-secondary)", neutral: "var(--visual-neutral)" };
const functions = new Set(["sin", "cos", "tan", "sqrt", "abs", "exp", "log", "log10", "asin", "acos", "atan"]);
export function plotSamples(expression: string, min: number, max: number) {
  if (expression.length > 240 || !Number.isFinite(min) || !Number.isFinite(max) || min >= max || Math.abs(min) > 1e6 || Math.abs(max) > 1e6) throw new Error("Unsupported graph expression or range.");
  const tree = parse(expression);
  let count = 0;
  tree.traverse((node: MathNode) => {
    count++;
    if (count > 100 || !["OperatorNode", "ConstantNode", "SymbolNode", "FunctionNode", "ParenthesisNode"].includes(node.type)) throw new Error("Only numerical expressions in x are supported.");
    if (node.type === "SymbolNode" && !["x", "pi", "e", ...functions].includes((node as unknown as { name: string }).name)) throw new Error("Unsupported symbol in graph.");
    if (node.type === "FunctionNode" && !functions.has((node as unknown as { fn: { name: string } }).fn.name)) throw new Error("Unsupported graph function.");
    if (node.type === "OperatorNode" && !["+", "-", "*", "/", "^"].includes((node as unknown as { op: string }).op)) throw new Error("Unsupported graph operator.");
  });
  const compiled = tree.compile();
  return Array.from({ length: 501 }, (_, i) => {
    const x = min + (max - min) * i / 500;
    try { const y = compiled.evaluate({ x }); return { x, y: typeof y === "number" && Number.isFinite(y) ? y : null }; }
    catch { return { x, y: null }; }
  });
}
function text(label: string, x: number, y: number, max = 26) {
  const words = label.split(/\s+/); const lines: string[] = []; let line = "";
  for (const word of words) { if ((line + " " + word).trim().length > max && line) { lines.push(line); line = word; } else line = (line + " " + word).trim(); }
  if (line) lines.push(line);
  return `<text x="${x}" y="${y - (lines.length - 1) * 11}" text-anchor="middle" fill="var(--visual-ink)" font-family="Arial, sans-serif" font-size="18">${lines.map((s, i) => `<tspan x="${x}" dy="${i ? 22 : 0}">${esc(s)}</tspan>`).join("")}</text>`;
}
export function renderVisual(plan: VisualPlan, palette: Record<string, string>): string {
  let content = ""; let width = 1000; let height = 680;
  const marker = (role: string) => `url(#arrow-${role})`;
  if (plan.kind === "plot" && plan.plot) {
    const p = plan.plot; const pts = plotSamples(p.expression, p.xMin, p.xMax);
    const px = (x: number) => 90 + (x - p.xMin) / (p.xMax - p.xMin) * 820;
    const py = (y: number) => 570 - (y - p.yMin) / (p.yMax - p.yMin) * 480;
    for (let i = 0; i <= 10; i++) {
      const x = p.xMin + (p.xMax - p.xMin) * i / 10, y = p.yMin + (p.yMax - p.yMin) * i / 10;
      content += `<path d="M${px(x)} 90 V570 M90 ${py(y)} H910" stroke="var(--visual-grid)"/>` + text(String(Number(x.toFixed(2))), px(x), 603) + text(String(Number(y.toFixed(2))), 45, py(y) + 5);
    }
    const xAxis = py(Math.max(p.yMin, Math.min(p.yMax, 0))), yAxis = px(Math.max(p.xMin, Math.min(p.xMax, 0)));
    content += `<path d="M90 ${xAxis} H920 M${yAxis} 580 V80" stroke="var(--visual-ink)" stroke-width="2"/>`;
    let d = ""; let pen = false; let last: number | null = null;
    for (const pt of pts) {
      if (pt.y === null || pt.y < p.yMin || pt.y > p.yMax || (last !== null && Math.abs(pt.y - last) > (p.yMax - p.yMin) / 3)) { pen = false; last = pt.y; continue; }
      d += `${pen ? "L" : "M"}${px(pt.x).toFixed(2)} ${py(pt.y).toFixed(2)} `; pen = true; last = pt.y;
    }
    content += `<path d="${d}" fill="none" stroke="var(--visual-primary)" stroke-width="4"/>` + text(p.xLabel, 500, 650) + text(p.yLabel, 500, 45);
  } else {
    let nodes = plan.nodes.map(n => ({ ...n })); let edges: string[] = [];
    if (plan.kind === "flowchart") {
      const g = new dagre.graphlib.Graph().setGraph({ rankdir: "TB", nodesep: 50, ranksep: 85, marginx: 45, marginy: 60 }).setDefaultEdgeLabel(() => ({}));
      for (const n of nodes) g.setNode(n.id, { width: 230, height: Math.max(90, Math.ceil(n.label.length / 24) * 24 + 30) });
      for (const e of plan.edges) g.setEdge(e.from, e.to, { width: Math.min(220, e.label.length * 9), height: 30, labelpos: "r" });
      dagre.layout(g); width = Math.max(600, g.graph().width ?? 1000); height = Math.max(450, g.graph().height ?? 680);
      nodes = nodes.map(n => { const p = g.node(n.id); return { ...n, x: p.x - p.width / 2, y: p.y - p.height / 2, width: p.width, height: p.height }; });
      edges = plan.edges.map(e => { const p = g.edge(e.from, e.to); const points = p.points; return `<polyline points="${points.map((a: { x: number; y: number }) => `${a.x},${a.y}`).join(" ")}" fill="none" stroke="${colors[e.role]}" stroke-width="3" marker-end="${marker(e.role)}"/>` + (e.label ? text(e.label, p.x ?? points[0].x + 35, p.y ?? points[0].y, 24) : ""); });
    } else {
      edges = plan.edges.map(e => {
        const a = nodes.find(n => n.id === e.from), b = nodes.find(n => n.id === e.to); if (!a || !b) return "";
        const ac = { x: a.x + a.width / 2, y: a.y + a.height / 2 }, bc = { x: b.x + b.width / 2, y: b.y + b.height / 2 };
        const dx = bc.x - ac.x, dy = bc.y - ac.y; const scale = Math.max(Math.abs(dx) / (a.width / 2 + 8), Math.abs(dy) / (a.height / 2 + 8));
        const bs = Math.max(Math.abs(dx) / (b.width / 2 + 8), Math.abs(dy) / (b.height / 2 + 8));
        if (!scale || !bs) return "";
        return `<path d="M${ac.x + dx / scale} ${ac.y + dy / scale} L${bc.x - dx / bs} ${bc.y - dy / bs}" fill="none" stroke="${colors[e.role]}" stroke-width="3" marker-end="${marker(e.role)}"/>` + text(e.label, (ac.x + bc.x) / 2, (ac.y + bc.y) / 2 - 15);
      });
    }
    content += edges.join("");
    for (const n of nodes) {
      const cx = n.x + n.width / 2, cy = n.y + n.height / 2;
      const attrs = `fill="var(--visual-paper)" stroke="${colors[n.role]}" stroke-width="3"`;
      content += n.shape === "circle" ? `<ellipse cx="${cx}" cy="${cy}" rx="${n.width / 2}" ry="${n.height / 2}" ${attrs}/>` : n.shape === "diamond" ? `<polygon points="${cx},${n.y} ${n.x + n.width},${cy} ${cx},${n.y + n.height} ${n.x},${cy}" ${attrs}/>` : `<rect x="${n.x}" y="${n.y}" width="${n.width}" height="${n.height}" rx="8" ${attrs}/>`;
      content += text(n.label, cx, cy + 6, Math.max(12, Math.floor(n.width / 10)));
    }
    for (const a of plan.arrows) content += `<line x1="${a.x1}" y1="${a.y1}" x2="${a.x2}" y2="${a.y2}" stroke="${colors[a.role]}" stroke-width="4" marker-end="${marker(a.role)}"/>` + text(a.label, (a.x1 + a.x2) / 2, (a.y1 + a.y2) / 2 - 20);
  }
  const variables = Object.entries(palette).map(([key, value]) => `--visual-${key}:${value}`).join(";");
  let svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" style="${esc(variables)}"><title>${esc(plan.title)}</title><desc>${esc(plan.explanation)}</desc><defs>${Object.entries(colors).map(([role, c]) => `<marker id="arrow-${role}" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="8" markerHeight="8" orient="auto-start-reverse"><path d="M0 0 L10 5 L0 10 Z" fill="${c}"/></marker>`).join("")}</defs><rect width="100%" height="100%" fill="var(--visual-paper)"/>${content}</svg>`;
  // Resolve semantic tokens for portable downloads independent of page CSS.
  for (const [key, value] of Object.entries(palette)) svg = svg.replaceAll(`var(--visual-${key})`, value);
  return svg;
}