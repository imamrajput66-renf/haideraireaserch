import { createFileRoute } from "@tanstack/react-router";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, type UIMessage } from "ai";
import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Copy, Mic, Plus, RotateCcw, Send, Trash2, FileText, Square } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Markdown } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/assistant")({
  head: () => ({ meta: [{ title: "AI Assistant — Haider AI Research" }, { name: "description", content: "Chat with your AI study assistant." }, { property: "og:title", content: "AI Assistant — Haider AI Research" }, { property: "og:description", content: "Chat with your AI study assistant." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary_large_image" }] }),
  component: AssistantPage,
});

function textOf(m: UIMessage) {
  return m.parts.map((p) => (p.type === "text" ? p.text : "")).join("");
}

function AssistantPage() {
  const qc = useQueryClient();
  const [convId, setConvId] = useState<string | null>(null);
  const [initial, setInitial] = useState<UIMessage[]>([]);
  const { data: convs } = useQuery({
    queryKey: ["conversations"],
    queryFn: async () => (await supabase.from("conversations").select("id, title, created_at").order("created_at", { ascending: false })).data ?? [],
  });

  async function open(id: string) {
    const { data } = await supabase.from("messages").select("id, role, content").eq("conversation_id", id).order("created_at");
    setInitial((data ?? []).map((m) => ({ id: m.id, role: m.role as "user" | "assistant", parts: [{ type: "text", text: m.content }] })));
    setConvId(id);
  }
  async function remove(id: string) {
    await supabase.from("conversations").delete().eq("id", id);
    if (id === convId) { setConvId(null); setInitial([]); }
    qc.invalidateQueries({ queryKey: ["conversations"] });
  }

  return (
    <div className="grid h-[calc(100vh-7rem)] gap-4 md:grid-cols-[240px_1fr]">
      <aside className="hidden flex-col rounded-2xl glass p-3 md:flex">
        <Button variant="hero" onClick={() => { setConvId(null); setInitial([]); }}><Plus /> New conversation</Button>
        <div className="mt-3 flex-1 space-y-1 overflow-y-auto">
          {convs?.map((c) => (
            <div key={c.id} className={cn("group flex items-center rounded-lg px-2 py-2 text-sm hover:bg-accent", c.id === convId && "bg-accent")}>
              <button className="flex-1 truncate text-left" onClick={() => open(c.id)}>{c.title}</button>
              <button className="opacity-0 group-hover:opacity-100" onClick={() => remove(c.id)} aria-label="Delete"><Trash2 className="h-3.5 w-3.5" /></button>
            </div>
          ))}
          {!convs?.length && <p className="p-2 text-xs text-muted-foreground">Saved conversations appear here.</p>}
        </div>
      </aside>
      <ChatPanel key={convId ?? "new"} convId={convId} initial={initial} onCreated={(id) => { setConvId(id); qc.invalidateQueries({ queryKey: ["conversations"] }); }} />
    </div>
  );
}

function ChatPanel({ convId, initial, onCreated }: { convId: string | null; initial: UIMessage[]; onCreated: (id: string) => void }) {
  const [input, setInput] = useState("");
  const [lang, setLang] = useState<"en" | "ur">("en");
  const [docIds, setDocIds] = useState<string[]>([]);
  const convRef = useRef<string | null>(convId);
  const bottom = useRef<HTMLDivElement>(null);
  const langRef = useRef(lang); langRef.current = lang;
  const docsRef = useRef(docIds); docsRef.current = docIds;

  const { data: docs } = useQuery({
    queryKey: ["docs-ready"],
    queryFn: async () => (await supabase.from("documents").select("id, name").eq("status", "ready")).data ?? [],
  });

  const transport = useMemo(() => new DefaultChatTransport({
    api: "/api/chat",
    headers: async (): Promise<Record<string, string>> => {
      const { data } = await supabase.auth.getSession();
      return { Authorization: `Bearer ${data.session?.access_token ?? ""}` };
    },
    body: () => ({ language: langRef.current, documentIds: docsRef.current }),
  }), []);

  const { messages, sendMessage, status, error, regenerate, stop } = useChat({
    transport,
    messages: initial,
    onFinish: async ({ message }) => {
      if (convRef.current) await supabase.from("messages").insert({ conversation_id: convRef.current, role: "assistant", content: textOf(message) });
    },
  });

  useEffect(() => { bottom.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  async function send(text: string) {
    if (!text.trim() || status === "streaming" || status === "submitted") return undefined;
    if (!convRef.current) {
      const { data, error } = await supabase.from("conversations").insert({ title: text.slice(0, 60) }).select("id").single();
      if (error) { toast.error("Couldn't save conversation."); return undefined; }
      convRef.current = data.id;
      onCreated(data.id);
    }
    await supabase.from("messages").insert({ conversation_id: convRef.current, role: "user", content: text });
    setInput("");
    sendMessage({ text });
    return undefined;
  }

  function voice() {
    const SR = (window as unknown as { SpeechRecognition?: new () => any; webkitSpeechRecognition?: new () => any }).SpeechRecognition
      ?? (window as unknown as { webkitSpeechRecognition?: new () => any }).webkitSpeechRecognition;
    if (!SR) { toast.error("Voice input isn't supported in this browser. Try Chrome or Edge."); return; }
    const r = new SR();
    r.lang = lang === "ur" ? "ur-PK" : "en-US";
    r.onresult = (e: any) => setInput((v) => (v ? v + " " : "") + e.results[0][0].transcript);
    r.onerror = () => toast.error("Couldn't hear you — check microphone permission.");
    r.start();
    toast("Listening…");
  }

  const busy = status === "streaming" || status === "submitted";

  return (
    <section className="flex min-h-0 flex-col rounded-2xl glass">
      <div className="flex flex-wrap items-center gap-2 border-b border-border p-3 text-sm">
        <div className="flex rounded-lg border border-border p-0.5">
          {(["en", "ur"] as const).map((l) => (
            <button key={l} onClick={() => setLang(l)} className={cn("rounded-md px-3 py-1", lang === l && "bg-primary")}>{l === "en" ? "English" : "اردو"}</button>
          ))}
        </div>
        <span className="ml-2 text-muted-foreground">Ground in documents:</span>
        {docs?.length ? docs.map((d) => (
          <button key={d.id} onClick={() => setDocIds((x) => x.includes(d.id) ? x.filter((i) => i !== d.id) : [...x, d.id])}
            className={cn("flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs", docIds.includes(d.id) ? "border-cyan text-cyan" : "border-border text-muted-foreground")}>
            <FileText className="h-3 w-3" />{d.name}
          </button>
        )) : <span className="text-xs text-muted-foreground">none uploaded</span>}
      </div>

      <div className="flex-1 space-y-4 overflow-y-auto p-5">
        {messages.length === 0 && (
          <div className="mx-auto mt-16 max-w-md text-center text-muted-foreground">
            <h2 className="text-2xl font-bold text-foreground">What do you want to learn?</h2>
            <div className="mt-6 grid gap-2">
              {["Explain Newton's laws with everyday examples", "Make study notes on the French Revolution", "Compare mitosis and meiosis in a table"].map((s) => (
                <button key={s} onClick={() => send(s)} className="rounded-xl border border-border p-3 text-sm hover:border-cyan">{s}</button>
              ))}
            </div>
          </div>
        )}
        {messages.map((m) => (
          <div key={m.id} className={cn("max-w-[85%]", m.role === "user" ? "ml-auto" : "")}>
            <div className={cn("rounded-2xl px-4 py-3", m.role === "user" ? "bg-primary/80" : "bg-secondary")}>
              {m.role === "user" ? <p className="whitespace-pre-wrap">{textOf(m)}</p> : <Markdown lang={lang}>{textOf(m)}</Markdown>}
            </div>
            {m.role === "assistant" && textOf(m) && (
              <div className="mt-1 flex gap-3 text-xs text-muted-foreground">
                <button onClick={() => { navigator.clipboard.writeText(textOf(m)); toast.success("Copied"); }} className="flex items-center gap-1 hover:text-cyan"><Copy className="h-3 w-3" /> Copy</button>
                <button onClick={() => regenerate({ messageId: m.id })} className="flex items-center gap-1 hover:text-cyan"><RotateCcw className="h-3 w-3" /> Retry</button>
              </div>
            )}
          </div>
        ))}
        {status === "submitted" && <div className="flex gap-1 p-2">{[0, 1, 2].map((i) => <span key={i} className="h-2 w-2 rounded-full bg-magenta animate-pulse-dot" style={{ animationDelay: `${i * 0.2}s` }} />)}</div>}
        {error && <p className="rounded-xl border border-destructive/50 p-3 text-sm text-destructive">{parseError(error.message)}</p>}
        <div ref={bottom} />
      </div>

      <form onSubmit={(e) => { e.preventDefault(); send(input); }} className="flex items-end gap-2 border-t border-border p-3">
        <Button type="button" variant="ghost" size="icon" onClick={voice} aria-label="Voice input"><Mic /></Button>
        <Textarea value={input} onChange={(e) => setInput(e.target.value)} dir={lang === "ur" ? "rtl" : "ltr"}
          onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(input); } }}
          placeholder={lang === "ur" ? "اپنا سوال لکھیں…" : "Ask anything… (Enter to send)"} rows={1} className="max-h-40 min-h-10 resize-none" />
        {busy ? <Button type="button" variant="secondary" size="icon" onClick={stop} aria-label="Stop"><Square /></Button>
          : <Button type="submit" variant="hero" size="icon" aria-label="Send"><Send /></Button>}
      </form>
    </section>
  );
}

function parseError(m: string) {
  try { return JSON.parse(m).error ?? m; } catch { return m || "Something went wrong."; }
}
