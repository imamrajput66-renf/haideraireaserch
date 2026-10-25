import { createFileRoute } from "@tanstack/react-router";
import { convertToModelMessages, type UIMessage } from "ai";
import { streamChatResponse, friendlyAiError } from "@/lib/ai/gateway.server";
import { userClientFromRequest } from "@/lib/user-client.server";
import { rankChunks } from "@/lib/rag";

export const Route = createFileRoute("/api/chat")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const user = await userClientFromRequest(request);
        if (!user) return Response.json({ error: "Please sign in again." }, { status: 401 });
        const { data: profile } = await user.supabase.from("profiles").select("suspended").eq("id", user.userId).maybeSingle();
        if (profile?.suspended) return Response.json({ error: "Your account is suspended." }, { status: 403 });

        const body = (await request.json()) as { messages: UIMessage[]; language?: "en" | "ur"; documentIds?: string[] };
        // Only accept user/assistant turns with text parts; system roles are set by the server.
        const messages: UIMessage[] = (Array.isArray(body.messages) ? body.messages : [])
          .filter((m) => m && (m.role === "user" || m.role === "assistant") && Array.isArray(m.parts))
          .slice(-40)
          .map((m) => ({
            id: String(m.id ?? ""),
            role: m.role,
            parts: m.parts
              .filter((p) => p?.type === "text" && typeof (p as { text?: unknown }).text === "string")
              .map((p) => ({ type: "text" as const, text: (p as { text: string }).text.slice(0, 20000) })),
          }))
          .filter((m) => m.parts.length > 0);
        const lastUser = [...messages].reverse().find((m) => m.role === "user");
        const query = lastUser?.parts.map((p) => (p.type === "text" ? p.text : "")).join(" ") ?? "";

        let context = "";
        if (body.documentIds?.length) {
          const { data: chunks } = await user.supabase
            .from("document_chunks")
            .select("idx, content, document_id, documents(name)")
            .in("document_id", body.documentIds.slice(0, 10))
            .limit(800);
          const top = rankChunks(query, (chunks ?? []) as Array<{ idx: number; content: string; documents: { name: string } | null }>, 6);
          if (top.length) {
            context =
              "\n\nAnswer using ONLY these document excerpts when relevant, and cite them like [Source: filename, part N]. If the excerpts don't contain the answer, say so clearly.\n" +
              top.map((c) => `--- [${c.documents?.name ?? "document"}, part ${c.idx + 1}]\n${c.content}`).join("\n");
          } else {
            context = "\n\nThe user selected documents but no relevant excerpts matched. Tell them the documents don't appear to cover this, then answer generally and label it as general knowledge.";
          }
        }

        const lang = body.language === "ur" ? "Respond in clear Urdu (اردو) script." : "Respond in clear English.";
        const instructions = `You are Haider AI Research, a patient study and research assistant for students. Explain clearly with examples, use markdown headings and lists, and show math step by step. ${lang}${context}`;
        try {
          return await streamChatResponse(request, await convertToModelMessages(messages), instructions);
        } catch (e) {
          return Response.json({ error: friendlyAiError(e) }, { status: 500 });
        }
      },
    },
  },
});
