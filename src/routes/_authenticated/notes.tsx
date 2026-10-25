import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Plus, Trash2, Save } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/notes")({
  head: () => ({ meta: [{ title: "Research & Notes — Haider AI Research" }, { name: "description", content: "Your research workspace and notes." }, { property: "og:title", content: "Research & Notes — Haider AI Research" }, { property: "og:description", content: "Your research workspace and notes." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary_large_image" }] }),
  component: NotesPage,
});

function NotesPage() {
  const qc = useQueryClient();
  const { data: notes } = useQuery({ queryKey: ["notes"], queryFn: async () => (await supabase.from("notes").select("*").order("updated_at", { ascending: false })).data ?? [] });
  const [id, setId] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  useEffect(() => {
    const n = notes?.find((x) => x.id === id);
    setTitle(n?.title ?? ""); setContent(n?.content ?? "");
  }, [id, notes]);

  async function create() {
    const { data } = await supabase.from("notes").insert({ title: "Untitled note" }).select("id").single();
    await qc.invalidateQueries({ queryKey: ["notes"] });
    if (data) setId(data.id);
  }
  async function save() {
    if (!id) return;
    await supabase.from("notes").update({ title, content, updated_at: new Date().toISOString() }).eq("id", id);
    qc.invalidateQueries({ queryKey: ["notes"] });
    toast.success("Saved");
  }
  async function remove() {
    if (!id) return;
    await supabase.from("notes").delete().eq("id", id);
    setId(null);
    qc.invalidateQueries({ queryKey: ["notes"] });
  }

  return (
    <>
      <PageHeader title="Research & Notes" subtitle="Collect ideas, findings and summaries for your research projects.">
        <Button variant="hero" onClick={create}><Plus /> New note</Button>
      </PageHeader>
      <div className="grid gap-4 md:grid-cols-[260px_1fr]">
        <div className="space-y-1 rounded-2xl glass p-2">
          {notes?.map((n) => (
            <button key={n.id} onClick={() => setId(n.id)} className={cn("block w-full truncate rounded-lg px-3 py-2 text-left text-sm hover:bg-accent", n.id === id && "bg-accent")}>{n.title}</button>
          ))}
          {notes && !notes.length && <p className="p-3 text-sm text-muted-foreground">No notes yet.</p>}
        </div>
        {id ? (
          <div className="rounded-2xl glass p-5">
            <Input value={title} onChange={(e) => setTitle(e.target.value)} className="text-lg font-semibold" />
            <Textarea value={content} onChange={(e) => setContent(e.target.value)} rows={16} className="mt-3" placeholder="Write your notes…" />
            <div className="mt-3 flex gap-2">
              <Button variant="hero" onClick={save}><Save /> Save</Button>
              <Button variant="ghost" onClick={remove}><Trash2 /> Delete</Button>
            </div>
          </div>
        ) : <div className="flex items-center justify-center rounded-2xl glass p-10 text-muted-foreground">Select or create a note.</div>}
      </div>
    </>
  );
}
