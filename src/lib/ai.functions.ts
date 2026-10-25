import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type QuizQuestion = { question: string; options: string[]; answer: number; explanation: string };

function langLine(lang?: string) {
  return lang === "ur" ? "Write everything in Urdu script." : "Write in English.";
}

async function assertActive(context: { supabase: any; userId: string }) {
  const { data } = await context.supabase.from("profiles").select("suspended").eq("id", context.userId).maybeSingle();
  if (data?.suspended) throw new Error("Your account is suspended.");
}

function extractJson(text: string) {
  const m = text.match(/\[[\s\S]*\]|\{[\s\S]*\}/);
  if (!m) throw new Error("The AI returned an unexpected format. Please try again.");
  return JSON.parse(m[0]);
}

export const generateQuiz = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { topic: string; source?: string; count: number; difficulty: string; language?: string }) => d)
  .handler(async ({ data, context }) => {
    await assertActive(context as never);
    const { generateTextOnce } = await import("@/lib/ai/gateway.server");
    const count = Math.min(Math.max(data.count, 3), 15);
    const text = await generateTextOnce(
      `Topic: ${data.topic}\nDifficulty: ${data.difficulty}\nNumber of questions: ${count}\n${data.source ? `Base the questions on this material:\n${data.source.slice(0, 12000)}` : ""}`,
      `You create multiple-choice study quizzes. ${langLine(data.language)} Output ONLY a JSON array, no prose. Each item: {"question": string, "options": [4 strings], "answer": index 0-3 of correct option, "explanation": short string}.`,
    );
    const questions = extractJson(text) as QuizQuestion[];
    return { questions: questions.filter((q) => Array.isArray(q.options) && q.options.length >= 2).slice(0, count) };
  });

export const solveMath = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { problem: string; language?: string }) => d)
  .handler(async ({ data, context }) => {
    await assertActive(context as never);
    const { generateTextOnce } = await import("@/lib/ai/gateway.server");
    const text = await generateTextOnce(
      data.problem,
      `You are a careful mathematics tutor. ${langLine(data.language)} Solve step by step with numbered steps in markdown, check the answer, and end with a line "**Final answer:** ...".`,
    );
    return { solution: text };
  });

export const summarizeDocument = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { documentId: string; language?: string }) => d)
  .handler(async ({ data, context }) => {
    await assertActive(context as never);
    const { data: doc, error } = await context.supabase.from("documents").select("id, name, content").eq("id", data.documentId).single();
    if (error || !doc) throw new Error("Document not found.");
    const { generateTextOnce } = await import("@/lib/ai/gateway.server");
    const summary = await generateTextOnce(
      `Document "${doc.name}":\n${(doc.content ?? "").slice(0, 30000)}`,
      `Summarize this study document. ${langLine(data.language)} Use markdown: a 2-sentence overview, then "Key points" bullets, then "Key terms" with short definitions.`,
    );
    await context.supabase.from("documents").update({ summary }).eq("id", doc.id);
    return { summary };
  });

/** OCR: reads text from scanned page images (JPEG/PNG/WebP data URLs). */
export const ocrImages = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { images: string[] }) => {
    const images = (d.images ?? []).filter((x) => typeof x === "string" && /^data:image\/(jpeg|png|webp);base64,/.test(x));
    if (!images.length) throw new Error("No image to read.");
    if (images.length > 4) throw new Error("Send at most 4 pages at a time.");
    return { images };
  })
  .handler(async ({ data, context }) => {
    await assertActive(context as never);
    const { generateFromMessages } = await import("@/lib/ai/gateway.server");
    const text = await generateFromMessages(
      [{ role: "user", content: [
        { type: "text", text: `Transcribe all text from these ${data.images.length} scanned page image(s), in order.` },
        ...data.images.map((url) => ({ type: "image" as const, image: new URL(url) })),
      ] }],
      "You are an OCR engine. Output ONLY the exact text visible in the images, preserving paragraphs, headings and reading order (handle multi-column layouts column by column). Separate pages with a line '--- page break ---'. Write equations in plain text. Do not summarise, translate or add commentary. If an image has no readable text, output nothing for it.",
    );
    return { text: text.trim() };
  });
