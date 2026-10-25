import { createOpenAI } from "@ai-sdk/openai";
import { streamText, type ModelMessage } from "ai";
import {
  createLovableAiGatewayRunIdFetch,
  getLovableAiGatewayRunId,
  withLovableAiGatewayRunIdHeader,
} from "./run-id";

export const AI_MODEL = "openai/gpt-6-astra";
const BASE_URL = "https://ai.gateway.lovable.dev/v1";

function makeCall(messages: ModelMessage[], instructions: string, signal?: AbortSignal, runId?: string) {
  const apiKey = process.env["LOVABLE_API_KEY"];
  if (!apiKey) throw new Error("AI is not configured (missing LOVABLE_API_KEY).");
  const runIdFetch = createLovableAiGatewayRunIdFetch(runId);
  const provider = createOpenAI({
    baseURL: BASE_URL,
    apiKey,
    headers: { "Lovable-API-Key": apiKey, "X-Lovable-AIG-SDK": "vercel-ai-sdk" },
    fetch: runIdFetch.fetch,
  });
  const result = streamText({
    model: provider.responses(AI_MODEL),
    instructions,
    messages,
    ...(signal ? { abortSignal: signal } : {}),
    providerOptions: {
      openai: {
        forceReasoning: true,
        reasoningEffort: "low",
        reasoningSummary: "auto",
        store: false,
        include: ["reasoning.encrypted_content"],
      },
    },
  });
  return { result, runIdFetch };
}

export function streamChatResponse(request: Request, messages: ModelMessage[], instructions: string) {
  const { result, runIdFetch } = makeCall(messages, instructions, request.signal, getLovableAiGatewayRunId(request));
  return withLovableAiGatewayRunIdHeader(result.toUIMessageStreamResponse({ sendReasoning: true }), runIdFetch);
}

/** Streams server-side and returns the final text. */
export async function generateTextOnce(prompt: string, instructions: string) {
  const { result } = makeCall([{ role: "user", content: prompt }], instructions);
  let text = "";
  try {
    for await (const part of result.textStream) text += part;
  } catch (e) {
    throw new Error(friendlyAiError(e));
  }
  return text;
}

/** Streams server-side and returns the final text, for multimodal messages. */
export async function generateFromMessages(messages: ModelMessage[], instructions: string) {
  const { result } = makeCall(messages, instructions);
  let text = "";
  try {
    for await (const part of result.textStream) text += part;
  } catch (e) {
    throw new Error(friendlyAiError(e));
  }
  return text;
}

export function friendlyAiError(e: unknown): string {
  const anyE = e as { statusCode?: number; message?: string };
  const s = anyE?.statusCode;
  if (s === 402) return "AI credits are used up. Add credits in Settings → Plans & credits.";
  if (s === 429) return "The AI is busy right now. Please wait a moment and try again.";
  if (s === 403) return "AI access is blocked for this workspace.";
  return anyE?.message || "The AI request failed.";
}
