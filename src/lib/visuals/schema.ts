import { z } from "zod";

export const visualModes = ["Scientific Diagram", "Concept Illustration", "Step-by-Step Diagram", "Educational Infographic", "Labeled Illustration", "Flowchart", "Comparison Diagram", "Realistic Educational Image", "Mathematical Visualization", "Custom Visual"] as const;
export const preferencesSchema = z.object({
  topic: z.string().trim().min(5, "Describe your concept in at least 5 characters.").max(2000),
  mode: z.enum(visualModes).default("Scientific Diagram"),
  level: z.enum(["Beginner", "School", "College", "Advanced"]).default("School"),
  style: z.enum(["Simple textbook", "Technical", "Realistic", "Colorful infographic", "Hand-drawn"]).default("Simple textbook"),
  orientation: z.enum(["Square", "Landscape", "Portrait"]).default("Landscape"),
  language: z.enum(["English", "Urdu", "Arabic", "Spanish", "French"]).default("English"),
  detail: z.enum(["Simple", "Medium", "Detailed"]).default("Medium"),
  sourceId: z.string().uuid().nullable().default(null),
});
export type VisualPreferences = z.infer<typeof preferencesSchema>;
export const defaultPreferences: VisualPreferences = { topic: "", mode: "Scientific Diagram", level: "School", style: "Simple textbook", orientation: "Landscape", language: "English", detail: "Medium", sourceId: null };

// Small strict schema: AI cannot supply raw SVG, scripts, HTML, or arbitrary styles.
export const visualPlanSchema = z.object({
  title: z.string(), kind: z.enum(["diagram", "flowchart", "plot", "image"]),
  explanation: z.string(), caveat: z.string(), prompt: z.string(),
  steps: z.array(z.string()), related: z.array(z.string()),
  legend: z.array(z.object({ role: z.enum(["primary", "energy", "secondary", "neutral"]), meaning: z.string() })),
  nodes: z.array(z.object({ id: z.string(), label: z.string(), x: z.number(), y: z.number(), width: z.number(), height: z.number(), shape: z.enum(["rect", "circle", "diamond"]), role: z.enum(["primary", "energy", "secondary", "neutral"]) })),
  edges: z.array(z.object({ from: z.string(), to: z.string(), label: z.string(), role: z.enum(["primary", "energy", "secondary", "neutral"]) })),
  arrows: z.array(z.object({ x1: z.number(), y1: z.number(), x2: z.number(), y2: z.number(), label: z.string(), role: z.enum(["primary", "energy", "secondary", "neutral"]), meaning: z.enum(["motion", "drag", "other"]) })),
  plot: z.object({ expression: z.string(), xMin: z.number(), xMax: z.number(), yMin: z.number(), yMax: z.number(), xLabel: z.string(), yLabel: z.string() }).nullable(),
});
export type VisualPlan = z.infer<typeof visualPlanSchema>;
export function validatePlan(input: unknown): VisualPlan {
  const plan = visualPlanSchema.parse(input);
  if (plan.title.length > 160 || plan.explanation.length > 4000 || plan.caveat.length > 2000 || plan.prompt.length > 10000 || plan.steps.length > 10 || plan.related.length > 6 || plan.legend.length > 8 || plan.steps.some(s => s.length > 800) || plan.related.some(s => s.length > 160) || plan.legend.some(l => l.meaning.length > 300) || plan.edges.some(e => e.label.length > 100) || plan.arrows.some(a => a.label.length > 100)) throw new Error("The generated visual contains too much text. Request a simpler visual.");
  if (plan.plot && ([plan.plot.xMin, plan.plot.xMax, plan.plot.yMin, plan.plot.yMax].some(n => !Number.isFinite(n) || Math.abs(n) > 1e6) || plan.plot.expression.length > 240 || plan.plot.xLabel.length > 100 || plan.plot.yLabel.length > 100)) throw new Error("The graph exceeded safe numeric limits.");
  if (plan.nodes.length > 16 || plan.edges.length > 24 || plan.arrows.length > 16) throw new Error("This diagram is too crowded. Request a simpler visual.");
  if (plan.nodes.some(n => n.label.length > 100 || n.x < 10 || n.x > 950 || n.y < 10 || n.y > 600 || n.width < 40 || n.width > 320 || n.height < 35 || n.height > 180 || n.x + n.width > 990 || n.y + n.height > 640)) throw new Error("Diagram layout exceeded the safe drawing area. Please request a simpler visual.");
  const ids = new Set(plan.nodes.map(n => n.id));
  if (ids.size !== plan.nodes.length || plan.edges.some(e => !ids.has(e.from) || !ids.has(e.to))) throw new Error("The diagram contains an invalid connection.");
  if (plan.arrows.some(a => [a.x1, a.x2].some(x => x < 10 || x > 990) || [a.y1, a.y2].some(y => y < 10 || y > 640))) throw new Error("An arrow falls outside the drawing area.");
  const motion = plan.arrows.find(a => a.meaning === "motion");
  const drag = plan.arrows.find(a => a.meaning === "drag");
  if (drag && !motion) throw new Error("A drag diagram must specify relative motion.");
  if (drag && motion && (drag.x2 - drag.x1) * (motion.x2 - motion.x1) + (drag.y2 - drag.y1) * (motion.y2 - motion.y1) >= 0) throw new Error("The drag arrow must oppose relative motion. The generated diagram failed the direction check.");
  if (plan.kind === "plot" && (!plan.plot || plan.plot.xMin >= plan.plot.xMax || plan.plot.yMin >= plan.plot.yMax)) throw new Error("The graph needs valid increasing axis ranges.");
  if (["diagram", "flowchart"].includes(plan.kind) && !plan.nodes.length) throw new Error("The AI returned an empty diagram.");
  return plan;
}
export function imageSize(orientation: VisualPreferences["orientation"]) { return orientation === "Square" ? "1024x1024" : orientation === "Portrait" ? "1024x1536" : "1536x1024"; }