import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, type UIMessage } from "ai";
import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { BrainCircuit, Send, Square, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Markdown } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const textOf = (m: UIMessage) => m.parts.map((p) => (p.type === "text" ? p.text : "")).join("");

export default function ChatWidget() {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const bottom = useRef<HTMLDivElement>(null);

  const transport = useMemo(() => new DefaultChatTransport({
    api: "/api/chat",
    headers: async (): Promise<Record<string, string>> => {
      const { data } = await supabase.auth.getSession();
      return { Authorization: `Bearer ${data.session?.access_token ?? ""}` };
    },
  }), []);
  const { messages, sendMessage, status, error, stop } = useChat({ transport });
  const busy = status === "submitted" || status === "streaming";

  useEffect(() => { bottom.current?.scrollIntoView({ behavior: "smooth" }); }, [messages, open]);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const t = input.trim();
    if (!t || busy) return;
    setInput("");
    void sendMessage({ text: t });
  }

  return (
    <div className="fixed bottom-4 right-4 z-50">
      {open && (
        <div className="mb-3 flex h-[min(520px,75vh)] w-[min(380px,calc(100vw-2rem))] flex-col overflow-hidden rounded-2xl glass shadow-glow">
          <div className="flex items-center justify-between border-b border-border px-4 py-3">
            <div className="flex items-center gap-2 text-sm font-semibold"><BrainCircuit className="h-4 w-4 text-cyan" /> Haider AI</div>
            <button onClick={() => setOpen(false)} aria-label="Close chat"><X className="h-4 w-4" /></button>
          </div>
          {!user ? (
            <div className="flex flex-1 flex-col items-center justify-center gap-3 p-6 text-center text-sm text-muted-foreground">
              Sign in to chat with Haider AI.
              <Button asChild variant="hero" size="sm"><Link to="/auth">Sign in</Link></Button>
            </div>
          ) : (
            <>
              <div className="flex-1 space-y-3 overflow-y-auto p-4 text-sm">
                {messages.length === 0 && <p className="text-muted-foreground">Ask me anything about your studies.</p>}
                {messages.map((m) => m.role === "user" ? (
                  <div key={m.id} className="ml-auto w-fit max-w-[85%] rounded-2xl rounded-br-sm bg-primary px-3 py-2 text-primary-foreground">{textOf(m)}</div>
                ) : (
                  <div key={m.id} className="max-w-full"><Markdown>{textOf(m)}</Markdown></div>
                ))}
                {status === "submitted" && <p className="text-muted-foreground">Thinking…</p>}
                {error && <p className="text-destructive">{error.message || "Something went wrong."}</p>}
                <div ref={bottom} />
              </div>
              <form onSubmit={submit} className="flex gap-2 border-t border-border p-3">
                <input value={input} onChange={(e) => setInput(e.target.value)} placeholder="Type a question…" className="flex-1 rounded-xl border border-input bg-background/60 px-3 py-2 text-sm outline-none focus:border-ring" />
                {busy ? (
                  <Button type="button" size="icon" variant="glass" onClick={() => stop()} aria-label="Stop"><Square /></Button>
                ) : (
                  <Button type="submit" size="icon" variant="hero" aria-label="Send"><Send /></Button>
                )}
              </form>
            </>
          )}
        </div>
      )}
      <button
        onClick={() => setOpen((o) => !o)}
        aria-label="Open chat"
        className={cn("ml-auto flex h-14 w-14 items-center justify-center rounded-full bg-brand text-primary-foreground shadow-glow transition-transform hover:scale-105")}
      >
        {open ? <X className="h-6 w-6" /> : <BrainCircuit className="h-6 w-6" />}
      </button>
    </div>
  );
}
