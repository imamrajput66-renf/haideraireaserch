import { createFileRoute } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { Sparkles, ImagePlus, Download, Copy, RotateCcw, SlidersHorizontal, Pencil, Flag, LoaderCircle, Trash2, History, ArrowRight, X, Maximize } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { PageHeader } from "@/components/AppShell";
import { defaultPreferences, visualModes, validatePlan, type VisualPreferences, type VisualPlan } from "@/lib/visuals/schema";
import { streamImage } from "@/lib/visuals/stream-image";
import { finishVisual, failVisual } from "@/lib/visuals.functions";
import { cn } from "@/lib/utils";

const historyQuery = queryOptions({ queryKey: ["visual-history"], queryFn: async () => {
  const { data, error } = await supabase.from("educational_visuals").select("*").order("created_at", { ascending: false }).limit(30);
  if (error) throw error; return data;
} });
export const Route = createFileRoute("/_authenticated/visuals")({
  loader: ({ context }) => context.queryClient.ensureQueryData(historyQuery),
  head: () => ({ meta: [{ title: "Visual Studio — Haider AI Research" }, { name: "description", content: "Create educational images, labeled diagrams, flowcharts and mathematical graphs with Haider AI Research." }, { property: "og:title", content: "Visual Studio — Haider AI Research" }, { property: "og:description", content: "Turn academic concepts into clear educational visuals." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary_large_image" }] }),
  component: VisualStudio,
});
const choices = {
  level: ["Beginner", "School", "College", "Advanced"], style: ["Simple textbook", "Technical", "Realistic", "Colorful infographic", "Hand-drawn"],
  orientation: ["Square", "Landscape", "Portrait"], language: ["English", "Urdu", "Arabic", "Spanish", "French"], detail: ["Simple", "Medium", "Detailed"],
} as const;
const examples = ["Show drag force on a car moving right through still air", "Explain the greenhouse effect with a diagram", "Plot y = sin(x) from -6 to 6", "Show the parts of a plant cell"];
type Result = { id: string; plan: VisualPlan; image: string; preferences: VisualPreferences; complete: boolean; svg?: string };
function palette() { const css = getComputedStyle(document.documentElement); return Object.fromEntries(["paper", "ink", "primary", "energy", "secondary", "neutral", "grid"].map(k => [k, css.getPropertyValue(`--visual-${k}`).trim()])); }
async function diagramImage(plan: VisualPlan) {
  const { renderVisual } = await import("@/lib/visuals/render"); const svg = renderVisual(plan, palette());
  return { svg, image: `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}` };
}
function VisualStudio() {
  const { data: history } = useSuspenseQuery(historyQuery); const qc = useQueryClient(); const finish = useServerFn(finishVisual); const fail = useServerFn(failVisual);
  const [preferences, setPreferences] = useState<VisualPreferences>(defaultPreferences);
  const [result, setResult] = useState<Result | null>(null); const [busy, setBusy] = useState(false); const [stage, setStage] = useState(""); const [error, setError] = useState("");
  const [settings, setSettings] = useState(false); const [showHistory, setShowHistory] = useState(false); const [refining, setRefining] = useState(false); const [refinement, setRefinement] = useState(""); const [reporting, setReporting] = useState(false); const [reason, setReason] = useState("");
  const [expanded, setExpanded] = useState(false);
  async function authHeaders() { const { data } = await supabase.auth.getSession(); if (!data.session) throw new Error("Please sign in again."); return { Authorization: `Bearer ${data.session.access_token}` }; }
  async function generate(input = preferences) {
    let activeId: string | undefined;
    setBusy(true); setError(""); setStage("Checking the concept and planning your visual…");
    try {
      const headers = await authHeaders();
      const response = await fetch("/api/visual-plan", { method: "POST", headers: { ...headers, "Content-Type": "application/json" }, body: JSON.stringify(input) });
      const data = await response.json(); if (!response.ok) throw new Error(data.error ?? "Could not interpret this concept.");
      activeId = data.id;
      const plan = validatePlan(data.plan); const next: Result = { id: data.id, plan, image: "", complete: false, preferences: input };
      setResult(next);
      if (plan.kind === "image") {
        setStage(input.sourceId ? "Refining your original image…" : "Generating your educational image…"); let finalImage = "";
        await streamImage("/api/visual-image", { id: data.id, runId: data.runId }, (image, complete) => { setResult({ ...next, image, complete }); if (complete) finalImage = image; }, undefined, headers);
        if (!finalImage) throw new Error("No completed image was returned.");
        const blob = await (await fetch(finalImage)).blob(); const { data: session } = await supabase.auth.getSession(); if (!session.session) throw new Error("Sign in to save this image.");
        const path = `${session.session.user.id}/${data.id}.png`;
        const { error: uploadError } = await supabase.storage.from("educational-visuals").upload(path, blob, { contentType: "image/png", upsert: false }); if (uploadError) throw new Error("Your image is ready, but saving failed. Download it now.");
        await finish({ data: { id: data.id, path } });
      } else { setStage("Rendering precise labels and relationships…"); const rendered = await diagramImage(plan); setResult({ ...next, ...rendered, complete: true }); }
      setRefining(false); setRefinement("");
    } catch (e) { const message = e instanceof Error ? e.message : "Generation failed."; setError(message); if (activeId) await fail({ data: { id: activeId, message: message.slice(0, 1000) } }).catch(() => {}); }
    finally { setBusy(false); setStage(""); qc.invalidateQueries({ queryKey: ["visual-history"] }); }
  }
  async function openHistory(row: typeof history[number]) {
    if (!row.plan || row.status === "failed") { setError(row.error ?? "This visual did not finish."); return; }
    try {
      const plan = validatePlan(row.plan); const prefs = { ...defaultPreferences, ...(row.preferences as object), sourceId: null } as VisualPreferences;
      let rendered: { image: string; svg?: string };
      if (plan.kind === "image") { if (!row.storage_path) throw new Error("This image has not been saved."); const { data, error } = await supabase.storage.from("educational-visuals").createSignedUrl(row.storage_path, 3600); if (error || !data) throw new Error("Could not load this private image."); rendered = { image: data.signedUrl }; }
      else rendered = await diagramImage(plan);
      setResult({ id: row.id, plan, preferences: prefs, complete: true, ...rendered }); setPreferences(prefs); setError(""); setShowHistory(false);
    } catch (e) { setError(e instanceof Error ? e.message : "Unable to open visual."); }
  }
  async function download() {
    if (!result?.complete) return;
    try {
      let blob: Blob;
      if (result.svg) {
        const img = new Image(); img.src = result.image; await img.decode(); const canvas = document.createElement("canvas"); canvas.width = img.naturalWidth * 2; canvas.height = img.naturalHeight * 2; const ctx = canvas.getContext("2d"); if (!ctx) throw new Error("Download is unavailable."); ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob(b => b ? resolve(b) : reject(new Error("Could not export image.")), "image/png"));
      } else blob = await (await fetch(result.image)).blob();
      const url = URL.createObjectURL(blob); const a = document.createElement("a"); a.href = url; a.download = `${result.plan.title.replace(/[^\p{L}\p{N} -]/gu, "").slice(0, 70) || "educational-visual"}.png`; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (e) { toast.error(e instanceof Error ? e.message : "Download failed."); }
  }
  async function report() {
    if (!result) return; const { error } = await supabase.from("visual_accuracy_reports").insert({ visual_id: result.id, reason: reason.trim() }); if (error) { toast.error(error.message); return; } toast.success("Accuracy report saved."); setReporting(false); setReason("");
  }
  async function remove(row: typeof history[number]) {
    const { error } = await supabase.from("educational_visuals").delete().eq("id", row.id); if (error) { toast.error(error.message); return; }
    if (row.storage_path) await supabase.storage.from("educational-visuals").remove([row.storage_path]); if (result?.id === row.id) setResult(null); qc.invalidateQueries({ queryKey: ["visual-history"] });
  }
  return <>
    <PageHeader title="Visual Studio" subtitle="Educational images & diagrams"><Button variant="glass" onClick={() => setShowHistory(!showHistory)} disabled={busy}><History /> History <span className="text-muted-foreground">{history.length}</span></Button></PageHeader>
    <div className="grid min-w-0 gap-8 xl:grid-cols-[320px_minmax(0,1fr)]">
      <section className="min-w-0 space-y-5">
        <div><label htmlFor="visual-topic" className="mb-2 block text-sm font-semibold">What are you studying?</label><Textarea id="visual-topic" value={preferences.topic} onChange={e => setPreferences({ ...preferences, topic: e.target.value, sourceId: null })} placeholder="Describe any concept you want to visualize..." rows={5} maxLength={2000} disabled={busy} /><div className="mt-1 text-right text-xs text-muted-foreground">{preferences.topic.length}/2000</div></div>
        <div><label htmlFor="visual-mode" className="mb-2 block text-sm font-semibold">Visual type</label><select id="visual-mode" className="w-full rounded-lg border border-input bg-background px-3 py-2.5 text-sm" value={preferences.mode} disabled={busy} onChange={e => setPreferences({ ...preferences, mode: e.target.value as VisualPreferences["mode"] })}>{visualModes.map(m => <option key={m}>{m}</option>)}</select></div>
        <Button variant="ghost" className="w-full justify-between" onClick={() => setSettings(!settings)} aria-expanded={settings}><span className="flex items-center gap-2"><SlidersHorizontal className="h-4 w-4" /> Customize</span><span className="text-xs text-muted-foreground">{preferences.language} · {preferences.orientation}</span></Button>
        {settings && <div className="grid grid-cols-2 gap-3">{Object.entries(choices).map(([key, opts]) => <div key={key}><label htmlFor={`visual-${key}`} className="mb-1 block text-xs capitalize text-muted-foreground">{key}</label><select id={`visual-${key}`} className="w-full min-w-0 rounded-lg border border-input bg-background p-2 text-xs" disabled={busy} value={preferences[key as keyof typeof choices]} onChange={e => setPreferences({ ...preferences, [key]: e.target.value })}>{opts.map(v => <option key={v}>{v}</option>)}</select></div>)}</div>}
        <Button variant="hero" className="w-full" size="lg" onClick={() => generate({ ...preferences, sourceId: null })} disabled={busy || preferences.topic.trim().length < 5}>{busy ? <LoaderCircle className="animate-spin" /> : <Sparkles />} Generate Image</Button>
        {!result && <div className="space-y-2 border-t border-border pt-5"><h2 className="text-xs font-semibold uppercase text-muted-foreground">Try a concept</h2>{examples.map(t => <Button key={t} variant="ghost" className="h-auto w-full justify-between whitespace-normal text-left text-xs" onClick={() => setPreferences({ ...preferences, topic: t })} disabled={busy}>{t}<ArrowRight className="shrink-0" /></Button>)}</div>}
        <p className="text-xs text-muted-foreground">20 requests per day · 20 seconds between requests. AI generation uses workspace credits.</p>
      </section>
      <section className="min-w-0">
        {error && <div role="alert" className="mb-4 rounded-lg border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive">{error}</div>}
        {showHistory ? <div><div className="mb-4 flex items-center justify-between"><h2 className="text-lg font-semibold">Your visuals</h2><Button variant="ghost" size="icon" aria-label="Close history" onClick={() => setShowHistory(false)}><X /></Button></div>{!history.length && <p className="text-muted-foreground">No visuals yet.</p>}<div className="divide-y divide-border">{history.map(row => <div key={row.id} className="flex items-center gap-2 py-3"><Button variant="ghost" className="h-auto min-w-0 flex-1 justify-start whitespace-normal text-left" onClick={() => openHistory(row)}><span><span className="block">{row.topic}</span><span className="text-xs text-muted-foreground">{row.status} · {new Date(row.created_at).toLocaleDateString()}</span></span></Button><Button variant="ghost" size="icon" aria-label={`Delete ${row.topic}`} onClick={() => remove(row)}><Trash2 /></Button></div>)}</div></div> : <>
          <div className={cn("relative flex w-full min-w-0 items-center justify-center overflow-hidden rounded-lg border border-border bg-card", preferences.orientation === "Portrait" ? "aspect-[2/3]" : preferences.orientation === "Square" ? "aspect-square" : "aspect-[3/2]")}>
            {result?.complete && <Button className="absolute right-2 top-2 z-10" variant="glass" size="icon" aria-label="Expand image" title="Expand image" onClick={() => setExpanded(true)}><Maximize /></Button>}
            {result?.image ? <img src={result.image} alt={result.plan.title} className={cn("h-full w-full object-contain transition-[filter]", !result.complete && "blur-2xl")} /> : !busy && <div className="flex flex-col items-center gap-4 text-muted-foreground"><ImagePlus className="h-16 w-16 text-cyan/60" /><span className="text-sm">Your visual</span></div>}
            {busy && <div role="status" className="absolute inset-x-4 bottom-4 flex items-center justify-center gap-3 rounded-lg bg-background/90 p-4 text-sm"><LoaderCircle className="h-5 w-5 shrink-0 animate-spin text-cyan" />{stage}</div>}
          </div>
          {result && <><div className="mt-4 flex flex-wrap gap-2"><Button variant="hero" onClick={download} disabled={busy || !result.complete}><Download /> Download Image</Button><Button variant="glass" onClick={() => generate({ ...result.preferences, sourceId: null })} disabled={busy}><RotateCcw /> Regenerate</Button><Button variant="glass" onClick={() => setRefining(!refining)} disabled={busy || !result.complete}><Pencil /> Refine</Button><Button variant="ghost" size="icon" title="Copy prompt" aria-label="Copy prompt" onClick={async () => { try { await navigator.clipboard.writeText(result.plan.prompt); toast.success("Prompt copied."); } catch { toast.error("Clipboard is unavailable."); } }}><Copy /></Button><Button variant="ghost" size="icon" title="Report inaccuracy" aria-label="Report inaccuracy" onClick={() => setReporting(!reporting)} disabled={!result.complete}><Flag /></Button><Button variant="ghost" onClick={() => { setResult(null); setError(""); setPreferences(defaultPreferences); }} disabled={busy}>Start Again</Button></div>
            {refining && <div className="mt-4 space-y-2"><label htmlFor="visual-refine" className="text-sm">What should change?</label><Textarea id="visual-refine" value={refinement} onChange={e => setRefinement(e.target.value)} placeholder="Add clearer labels, simplify the explanation…" maxLength={1000} /><Button variant="hero" disabled={busy || refinement.trim().length < 5} onClick={() => generate({ ...result.preferences, topic: refinement, sourceId: result.id })}><Pencil /> Apply refinement</Button></div>}
            {reporting && <div className="mt-4 space-y-2"><label htmlFor="visual-report" className="text-sm">What is inaccurate or confusing?</label><Textarea id="visual-report" value={reason} onChange={e => setReason(e.target.value)} maxLength={2000} /><Button variant="glass" onClick={report} disabled={reason.trim().length < 10}><Flag /> Send report</Button></div>}
            <div className="mt-7 selectable"><div className="mb-2 flex flex-wrap items-center gap-3"><h2 className="text-xl font-semibold">{result.plan.title}</h2><span className="text-xs text-cyan">{result.plan.kind === "image" ? "AI illustration" : result.plan.kind === "plot" ? "Numerically plotted" : "Structured diagram"}</span></div><p className="text-sm leading-relaxed text-muted-foreground" dir={["Urdu", "Arabic"].includes(result.preferences.language) ? "rtl" : undefined}>{result.plan.explanation}</p><p className="mt-3 border-l-2 border-cyan pl-3 text-xs leading-relaxed text-muted-foreground">{result.plan.caveat || "Simplified educational model. Check important details against reliable sources."} AI-generated labels and scientific details can contain errors.</p>
              {!!result.plan.legend.length && <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-xs">{result.plan.legend.map((l, i) => <span key={i} className="flex items-center gap-2"><span className={cn("h-2.5 w-2.5 rounded-full", l.role === "primary" ? "bg-cyan" : l.role === "energy" ? "bg-magenta" : l.role === "secondary" ? "bg-success" : "bg-muted-foreground")} />{l.meaning}</span>)}</div>}
              {!!result.plan.steps.length && <ol className="mt-5 list-decimal space-y-2 pl-5 text-sm">{result.plan.steps.map((step, i) => <li key={i}>{step}</li>)}</ol>}
            </div><div className="mt-6 flex flex-wrap gap-2">{result.plan.related.slice(0, 3).map(topic => <Button key={topic} variant="ghost" size="sm" disabled={busy} onClick={() => setPreferences({ ...preferences, topic, sourceId: null })}>{topic}<ArrowRight /></Button>)}</div>
          </>}
        </>}
      </section>
    </div>
    <Dialog open={expanded} onOpenChange={setExpanded}><DialogContent className="max-h-[90svh] max-w-[95vw] overflow-auto"><DialogTitle>{result?.plan.title ?? "Visual"}</DialogTitle><DialogDescription className="sr-only">Expanded educational visual</DialogDescription>{result?.image && <img src={result.image} alt={result.plan.title} className="mx-auto h-auto max-w-full" />}</DialogContent></Dialog>
  </>;
}