import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { Loader2, Sigma, Copy } from "lucide-react";
import { toast } from "sonner";
import { PageHeader, Markdown } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { solveMath } from "@/lib/ai.functions";

export const Route = createFileRoute("/_authenticated/math")({
  head: () => ({ meta: [{ title: "Mathematics Solver — Haider AI Research" }, { name: "description", content: "Step-by-step math solutions." }, { property: "og:title", content: "Mathematics Solver — Haider AI Research" }, { property: "og:description", content: "Step-by-step math solutions." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary_large_image" }] }),
  component: MathPage,
});

function MathPage() {
  const solve = useServerFn(solveMath);
  const [problem, setProblem] = useState("");
  const [lang, setLang] = useState("en");
  const [solution, setSolution] = useState("");
  const [busy, setBusy] = useState(false);

  async function run() {
    if (!problem.trim()) return;
    setBusy(true); setSolution("");
    try { setSolution((await solve({ data: { problem, language: lang } })).solution); }
    catch (e) { toast.error((e as Error).message); }
    setBusy(false);
  }

  return (
    <>
      <PageHeader title="Mathematics Solver" subtitle="Type a problem — algebra, calculus, statistics, word problems — and get worked steps." />
      <div className="rounded-2xl glass p-5">
        <Textarea rows={4} value={problem} onChange={(e) => setProblem(e.target.value)} placeholder="e.g. Solve 2x² − 7x + 3 = 0, or differentiate sin(x)·eˣ" />
        <div className="mt-3 flex flex-wrap gap-2">
          {["Solve 2x^2 - 7x + 3 = 0", "Integrate x·e^x dx", "A train travels 300 km in 2.5 h. Average speed?"].map((ex) => (
            <button key={ex} onClick={() => setProblem(ex)} className="rounded-full border border-border px-3 py-1 text-xs hover:border-cyan">{ex}</button>
          ))}
          <select className="ml-auto h-9 rounded-md border border-input bg-transparent px-3 text-sm" value={lang} onChange={(e) => setLang(e.target.value)}><option value="en">English</option><option value="ur">اردو</option></select>
          <Button variant="hero" onClick={run} disabled={busy}>{busy ? <Loader2 className="animate-spin" /> : <Sigma />} Solve</Button>
        </div>
      </div>
      {solution && (
        <div className="mt-6 rounded-2xl glass p-6">
          <Markdown lang={lang}>{solution}</Markdown>
          <Button size="sm" variant="ghost" className="mt-3" onClick={() => { navigator.clipboard.writeText(solution); toast.success("Copied"); }}><Copy /> Copy</Button>
        </div>
      )}
    </>
  );
}
