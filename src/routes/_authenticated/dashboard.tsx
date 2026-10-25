import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { MessageSquare, FileText, ListChecks, NotebookPen, Sigma, Upload } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/AppShell";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({ meta: [{ title: "Dashboard — Haider AI Research" }, { name: "description", content: "Your study overview." }, { property: "og:title", content: "Dashboard — Haider AI Research" }, { property: "og:description", content: "Your study overview." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary_large_image" }] }),
  component: Dashboard,
});

function Dashboard() {
  const { data } = useQuery({
    queryKey: ["dashboard"],
    queryFn: async () => {
      const [c, d, q, n, p] = await Promise.all([
        supabase.from("conversations").select("id, title, created_at").order("created_at", { ascending: false }).limit(5),
        supabase.from("documents").select("id, name, status, summary, created_at").order("created_at", { ascending: false }).limit(5),
        supabase.from("quizzes").select("id, topic, score, total, created_at").order("created_at", { ascending: false }).limit(5),
        supabase.from("notes").select("id, title, updated_at").order("updated_at", { ascending: false }).limit(5),
        supabase.from("profiles").select("display_name").maybeSingle(),
      ]);
      return { convs: c.data ?? [], docs: d.data ?? [], quizzes: q.data ?? [], notes: n.data ?? [], name: p.data?.display_name };
    },
  });
  const done = data?.quizzes.filter((q) => q.score != null) ?? [];
  const avg = done.length ? Math.round((done.reduce((a, q) => a + (q.score! / q.total), 0) / done.length) * 100) : null;

  return (
    <>
      <PageHeader title={`Welcome${data?.name ? `, ${data.name}` : ""}`} subtitle="Here's your learning activity." />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Conversations" value={data?.convs.length ?? 0} />
        <Stat label="Documents" value={data?.docs.length ?? 0} />
        <Stat label="Quizzes completed" value={done.length} />
        <Stat label="Average quiz score" value={avg == null ? "—" : `${avg}%`} />
      </div>

      <h2 className="mb-3 mt-10 text-lg font-semibold">Quick actions</h2>
      <div className="flex flex-wrap gap-2">
        <Button asChild variant="hero"><Link to="/assistant"><MessageSquare /> Ask the assistant</Link></Button>
        <Button asChild variant="glass"><Link to="/documents"><Upload /> Upload document</Link></Button>
        <Button asChild variant="glass"><Link to="/quiz"><ListChecks /> New quiz</Link></Button>
        <Button asChild variant="glass"><Link to="/math"><Sigma /> Solve math</Link></Button>
        <Button asChild variant="glass"><Link to="/notes"><NotebookPen /> New note</Link></Button>
      </div>

      <div className="mt-10 grid gap-4 lg:grid-cols-2">
        <Panel title="Recent conversations" to="/assistant" empty="No conversations yet." items={data?.convs.map((c) => ({ id: c.id, t: c.title, s: new Date(c.created_at).toLocaleDateString() }))} />
        <Panel title="Documents" to="/documents" empty="No documents uploaded." items={data?.docs.map((d) => ({ id: d.id, t: d.name, s: d.summary ? "Summarised" : d.status }))} />
        <Panel title="Quiz scores" to="/quiz" empty="No quizzes yet." items={data?.quizzes.map((q) => ({ id: q.id, t: q.topic, s: q.score == null ? "Not finished" : `${q.score}/${q.total}` }))} />
        <Panel title="Saved notes" to="/notes" empty="No notes yet." items={data?.notes.map((n) => ({ id: n.id, t: n.title, s: new Date(n.updated_at).toLocaleDateString() }))} />
      </div>
    </>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-2xl glass p-5">
      <div className="text-sm text-muted-foreground">{label}</div>
      <div className="mt-1 text-3xl font-bold text-gradient">{value}</div>
    </div>
  );
}

function Panel({ title, to, empty, items }: { title: string; to: "/assistant" | "/documents" | "/quiz" | "/notes"; empty: string; items?: { id: string; t: string; s: string }[] | undefined }) {
  return (
    <div className="rounded-2xl glass p-5">
      <div className="mb-3 flex items-center justify-between"><h3 className="font-semibold">{title}</h3><Link to={to} className="text-xs text-cyan">Open →</Link></div>
      {!items?.length ? <p className="text-sm text-muted-foreground">{empty}</p> : (
        <ul className="space-y-2">
          {items.map((i) => (
            <li key={i.id} className="flex justify-between gap-3 text-sm"><span className="truncate">{i.t}</span><span className="shrink-0 text-muted-foreground">{i.s}</span></li>
          ))}
        </ul>
      )}
    </div>
  );
}
