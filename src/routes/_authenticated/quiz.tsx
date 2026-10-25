import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { Loader2, Sparkles, CheckCircle2, XCircle } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { generateQuiz, type QuizQuestion } from "@/lib/ai.functions";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/quiz")({
  head: () => ({ meta: [{ title: "Quiz Studio — Haider AI Research" }, { name: "description", content: "Generate and take AI quizzes." }, { property: "og:title", content: "Quiz Studio — Haider AI Research" }, { property: "og:description", content: "Generate and take AI quizzes." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary_large_image" }] }),
  component: QuizPage,
});

function QuizPage() {
  const qc = useQueryClient();
  const gen = useServerFn(generateQuiz);
  const [topic, setTopic] = useState("");
  const [docId, setDocId] = useState("");
  const [count, setCount] = useState(5);
  const [difficulty, setDifficulty] = useState("medium");
  const [lang, setLang] = useState("en");
  const [busy, setBusy] = useState(false);
  const [quiz, setQuiz] = useState<{ id: string; questions: QuizQuestion[] } | null>(null);
  const [answers, setAnswers] = useState<Record<number, number>>({});
  const [submitted, setSubmitted] = useState(false);

  const { data: docs } = useQuery({ queryKey: ["docs-ready"], queryFn: async () => (await supabase.from("documents").select("id, name").eq("status", "ready")).data ?? [] });
  const { data: past } = useQuery({ queryKey: ["quizzes"], queryFn: async () => (await supabase.from("quizzes").select("id, topic, score, total, created_at").order("created_at", { ascending: false }).limit(10)).data ?? [] });

  async function create() {
    if (!topic.trim() && !docId) { toast.error("Enter a topic or pick a document."); return; }
    setBusy(true);
    try {
      let source: string | undefined;
      let t = topic;
      if (docId) {
        const { data } = await supabase.from("documents").select("name, content").eq("id", docId).single();
        source = data?.content ?? undefined;
        if (!t) t = data?.name ?? "Document";
      }
      const { questions } = await gen({ data: { topic: t, ...(source ? { source } : {}), count, difficulty, language: lang } });
      const { data: row, error } = await supabase.from("quizzes").insert({ topic: t, questions: questions as never, total: questions.length }).select("id").single();
      if (error) throw error;
      setQuiz({ id: row.id, questions });
      setAnswers({}); setSubmitted(false);
    } catch (e) { toast.error((e as Error).message); }
    setBusy(false);
  }

  async function submit() {
    if (!quiz) return;
    const picked = quiz.questions.map((_, i) => answers[i] ?? -1);
    const { data: score, error } = await supabase.rpc("submit_quiz", { _quiz_id: quiz.id, _answers: picked });
    if (error) { toast.error("Couldn't save your score."); return; }
    setSubmitted(true);
    qc.invalidateQueries({ queryKey: ["quizzes"] });
    toast.success(`You scored ${score}/${quiz.questions.length}`);
  }

  const sel = "h-9 rounded-md border border-input bg-transparent px-3 text-sm";

  return (
    <>
      <PageHeader title="Quiz Studio" subtitle="Generate a quiz from any topic or from one of your documents." />
      <div className="grid gap-3 rounded-2xl glass p-5 md:grid-cols-6">
        <Input className="md:col-span-2" placeholder="Topic, e.g. Cell biology" value={topic} onChange={(e) => setTopic(e.target.value)} />
        <select className={sel} value={docId} onChange={(e) => setDocId(e.target.value)}>
          <option value="">No document</option>
          {docs?.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
        </select>
        <select className={sel} value={difficulty} onChange={(e) => setDifficulty(e.target.value)}>
          <option value="easy">Easy</option><option value="medium">Medium</option><option value="hard">Hard</option>
        </select>
        <select className={sel} value={count} onChange={(e) => setCount(+e.target.value)}>
          {[5, 10, 15].map((n) => <option key={n} value={n}>{n} questions</option>)}
        </select>
        <div className="flex gap-2">
          <select className={sel} value={lang} onChange={(e) => setLang(e.target.value)}><option value="en">EN</option><option value="ur">اردو</option></select>
          <Button variant="hero" onClick={create} disabled={busy} className="flex-1">{busy ? <Loader2 className="animate-spin" /> : <Sparkles />} Generate</Button>
        </div>
      </div>

      {quiz && (
        <div className={cn("mt-8 space-y-4", lang === "ur" && "urdu")}>
          {quiz.questions.map((q, i) => (
            <div key={i} className="rounded-2xl glass p-5">
              <p className="font-semibold">{i + 1}. {q.question}</p>
              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                {q.options.map((o, j) => {
                  const chosen = answers[i] === j;
                  const correct = submitted && j === q.answer;
                  const wrong = submitted && chosen && j !== q.answer;
                  return (
                    <button key={j} disabled={submitted} onClick={() => setAnswers((a) => ({ ...a, [i]: j }))}
                      className={cn("flex items-center gap-2 rounded-xl border p-3 text-left text-sm", chosen && !submitted && "border-cyan bg-cyan/10", correct && "border-success bg-success/10", wrong && "border-destructive bg-destructive/10", !chosen && !correct && "border-border")}>
                      {correct && <CheckCircle2 className="h-4 w-4 text-success" />}{wrong && <XCircle className="h-4 w-4 text-destructive" />}{o}
                    </button>
                  );
                })}
              </div>
              {submitted && <p className="mt-3 text-sm text-muted-foreground">{q.explanation}</p>}
            </div>
          ))}
          {!submitted && <Button variant="hero" size="lg" onClick={submit} disabled={Object.keys(answers).length < quiz.questions.length}>Submit answers</Button>}
        </div>
      )}

      <h2 className="mb-3 mt-10 text-lg font-semibold">Past quizzes</h2>
      <div className="space-y-2">
        {past?.map((p) => (
          <div key={p.id} className="flex justify-between rounded-xl glass px-4 py-3 text-sm">
            <span>{p.topic}</span><span className="text-muted-foreground">{p.score == null ? "Not finished" : `${p.score}/${p.total}`} · {new Date(p.created_at).toLocaleDateString()}</span>
          </div>
        ))}
        {past && !past.length && <p className="text-sm text-muted-foreground">No quizzes yet.</p>}
      </div>
    </>
  );
}
