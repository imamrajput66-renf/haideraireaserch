import { describe, expect, it } from "vitest";
import { preferencesSchema, validatePlan, imageSize, type VisualPlan } from "@/lib/visuals/schema";
import { plotSamples, renderVisual } from "@/lib/visuals/render";
const plan: VisualPlan = { title: "Drag", kind: "diagram", explanation: "Drag opposes motion relative to fluid.", caveat: "Simplified", prompt: "Drag diagram", steps: [], related: [], legend: [], plot: null, nodes: [{ id: "car", label: "Car", x: 350, y: 250, width: 200, height: 100, role: "primary", shape: "rect" }], edges: [], arrows: [{ x1: 450, y1: 200, x2: 650, y2: 200, label: "Relative motion", role: "primary", meaning: "motion" }, { x1: 450, y1: 420, x2: 200, y2: 420, label: "Drag", role: "energy", meaning: "drag" }] };
describe("Educational visual rules", () => {
  it("accepts opposing drag and relative motion", () => expect(validatePlan(plan).arrows).toHaveLength(2));
  it("rejects drag pointing with motion", () => expect(() => validatePlan({ ...plan, arrows: [plan.arrows[0], { ...plan.arrows[1], x2: 700 }] })).toThrow("oppose"));
  it("rejects drag with no relative motion", () => expect(() => validatePlan({ ...plan, arrows: [plan.arrows[1]] })).toThrow("relative motion"));
  it("supports any academic topic rather than a fixed subject list", () => expect(preferencesSchema.parse({ topic: "Visualize medieval irrigation engineering" }).topic).toContain("irrigation"));
  it("enforces topic input size", () => expect(preferencesSchema.safeParse({ topic: "x".repeat(2001) }).success).toBe(false));
  it("sets correct orientation dimensions", () => { expect(imageSize("Square")).toBe("1024x1024"); expect(imageSize("Portrait")).toBe("1024x1536"); expect(imageSize("Landscape")).toBe("1536x1024"); });
  it("plots concrete mathematical values accurately", () => { const samples = plotSamples("x^2", -2, 2); expect(samples[0]?.y).toBe(4); expect(samples[250]?.y).toBe(0); expect(samples[500]?.y).toBe(4); });
  it("rejects executable or assignment math expressions", () => { expect(() => plotSamples("x=2", -2, 2)).toThrow(); expect(() => plotSamples("import(x)", -2, 2)).toThrow(); });
  it("rejects excessive generated text", () => expect(() => validatePlan({ ...plan, title: "x".repeat(161) })).toThrow("too much text"));
  it("rejects unbounded graph axes", () => expect(() => validatePlan({ ...plan, kind: "plot", plot: { expression: "x", xMin: -1, xMax: 1, yMin: -1, yMax: 1e20, xLabel: "x", yLabel: "y" } })).toThrow("numeric limits"));
  it("escapes untrusted diagram labels", () => { const svg = renderVisual({ ...plan, title: "<script>alert(1)</script>" }, { paper: "white", ink: "black" }); expect(svg).not.toContain("<script>"); expect(svg).toContain("&lt;script&gt;"); });
});