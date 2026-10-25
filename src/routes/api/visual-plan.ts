import { createFileRoute } from "@tanstack/react-router";
import { preferencesSchema } from "@/lib/visuals/schema";
import { visualAccess, visualFailure } from "@/lib/visuals/access.server";
import { interpretVisual } from "@/lib/visuals/responses.server";
import type { Json } from "@/integrations/supabase/types";
export const Route = createFileRoute("/api/visual-plan")({ server: { handlers: { POST: async ({ request }) => {
  let userId: string | undefined;
  try {
    if (Number(request.headers.get("content-length") ?? 0) > 12000) return Response.json({ error: "Request too large." }, { status: 413 });
    const user = await visualAccess(request); userId = user.userId;
    const raw = await request.text(); if (new TextEncoder().encode(raw).length > 12000) return Response.json({ error: "Request too large." }, { status: 413 });
    let input: unknown; try { input = JSON.parse(raw); } catch { return Response.json({ error: "Invalid request JSON." }, { status: 400 }); }
    const parsed = preferencesSchema.safeParse(input);
    if (!parsed.success) return Response.json({ error: parsed.error.issues[0]?.message ?? "Invalid preferences." }, { status: 400 });
    const preferences = parsed.data;
    const apiKey = process.env["LOVABLE_API_KEY"]; if (!apiKey) throw new Error("AI is not configured.");
    let previous: unknown = null;
    if (preferences.sourceId) { const { data, error } = await user.supabase.from("educational_visuals").select("plan, topic").eq("id", preferences.sourceId).single(); if (error || !data) return Response.json({ error: "Original visual not found." }, { status: 404 }); previous = data; }
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error: limit } = await supabaseAdmin.rpc("claim_visual_usage", { _user_id: user.userId });
    if (limit) return Response.json({ error: limit.message }, { status: /paused|suspended/i.test(limit.message) ? 403 : 429 });
    const { data: record, error: insertError } = await supabaseAdmin.from("educational_visuals").insert({ user_id: user.userId, topic: preferences.topic, preferences: preferences as unknown as Json }).select("id").single();
    if (insertError || !record) throw new Error("Could not save the visual request.");
    try {
      const result = await interpretVisual(request, { baseURL: "https://ai.gateway.lovable.dev/v1", apiKey, model: "openai/gpt-6-astra" }, preferences, previous);
      const { error } = await supabaseAdmin.from("educational_visuals").update({ plan: result.plan as unknown as Json, status: result.plan.kind === "image" ? "planned" : "ready" }).eq("id", record.id);
      if (error) throw error;
      return Response.json({ id: record.id, ...result }, { headers: { "Cache-Control": "no-store" } });
    } catch (error) { await supabaseAdmin.from("educational_visuals").update({ status: "failed", error: error instanceof Error ? error.message : "Generation failed" }).eq("id", record.id); throw error; }
  } catch (error) { return visualFailure(error, userId); }
} } } });