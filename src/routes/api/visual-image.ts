import { createFileRoute } from "@tanstack/react-router";
import { visualAccess, visualFailure } from "@/lib/visuals/access.server";
import { generateImage, editImage, imageSettings } from "@/lib/visuals/image-gateway.server";
import { imageSize, preferencesSchema, validatePlan } from "@/lib/visuals/schema";
import { getLovableAiGatewayResponseHeaders } from "@/lib/ai/run-id";
import { createParser } from "eventsource-parser";
export const Route = createFileRoute("/api/visual-image")({ server: { handlers: { POST: async ({ request }) => {
  let userId: string | undefined;
  let visualId: string | undefined;
  try {
    const user = await visualAccess(request); userId = user.userId;
    let body: { id?: string; stream?: boolean; runId?: string }; try { body = await request.json(); } catch { return Response.json({ error: "Invalid request JSON." }, { status: 400 }); }
    if (typeof body.id !== "string" || !/^[\da-f-]{36}$/i.test(body.id)) return Response.json({ error: "Invalid visual." }, { status: 400 });
    const { data: row } = await user.supabase.from("educational_visuals").select("*").eq("id", body.id).single();
    if (!row || !row.plan) return Response.json({ error: "Visual not found." }, { status: 404 });
    const preferences = preferencesSchema.parse(row.preferences); const plan = validatePlan(row.plan);
    if (plan.kind !== "image") return Response.json({ error: "This visual uses structured rendering." }, { status: 400 });
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: block } = await supabaseAdmin.from("visual_ai_blocks").select("message").eq("user_id", user.userId).maybeSingle();
    if (block) return Response.json({ error: block.message }, { status: 403 });
    // Atomic claim prevents double-clicks and concurrent billed duplicates. One zero-event replay is allowed.
    const expected = body.stream === false ? "generating" : "planned";
    const { data: claimed } = await supabaseAdmin.from("educational_visuals").update({ status: body.stream === false ? "replaying" : "generating" }).eq("id", row.id).eq("user_id", user.userId).eq("status", expected).select("id").maybeSingle();
    if (!claimed) return Response.json({ error: "This request has already started. Regenerate to create a new visual." }, { status: 409 });
    visualId = row.id;
    const apiKey = process.env["LOVABLE_API_KEY"]; if (!apiKey) throw new Error("AI is not configured.");
    const config = { ...imageSettings, apiKey, size: imageSize(preferences.orientation), runId: typeof body.runId === "string" ? body.runId : undefined };
    let upstream: Response;
    if (preferences.sourceId) {
      const { data: source } = await user.supabase.from("educational_visuals").select("storage_path").eq("id", preferences.sourceId).single();
      if (!source?.storage_path) throw new Error("The original image is unavailable for refinement.");
      const { data: file, error } = await user.supabase.storage.from("educational-visuals").download(source.storage_path);
      if (error || !file) throw new Error("Could not load the original image.");
      const form = new FormData(); form.set("image", file, "original.png"); form.set("prompt", `Refine this educational image: ${preferences.topic}. Preserve the original subject and all scientifically correct unchanged relationships. ${plan.prompt}`); form.set("size", config.size); form.set("quality", "medium"); form.set("stream", String(body.stream !== false));
      upstream = await editImage(config, form);
    } else upstream = await generateImage(config, plan.prompt, body.stream !== false);
    if (!upstream.ok) { const text = await upstream.text(); let message = text; try { const json = JSON.parse(text); message = json.error?.message ?? json.message ?? text; } catch {} if (upstream.status === 402 || upstream.status === 403) { const { error } = await supabaseAdmin.from("visual_ai_blocks").upsert({ user_id: user.userId, message }); if (error) console.error("Could not persist visual AI pause", error.code); } await supabaseAdmin.from("educational_visuals").update({ status: "failed", error: message }).eq("id", row.id); return Response.json({ error: message }, { status: upstream.status }); }
    let responseBody = upstream.body;
    if (responseBody && upstream.headers.get("content-type")?.includes("text/event-stream")) {
      // Observe terminal errors for durable safeguards; forward every upstream byte unchanged.
      const decoder = new TextDecoder(); let terminal: { message: string; block: boolean } | null = null;
      const parser = createParser({ onEvent(event) { try { const p = JSON.parse(event.data); if (event.event === "error" || p.type === "error") { const e = p.error ?? p; const code = `${e.code ?? ""} ${e.type ?? ""}`; const status = Number(e.status ?? e.status_code ?? p.status); terminal = { message: e.message ?? "Image generation failed.", block: status === 402 || status === 403 || /permission_error|access_denied|credit|vendor_not_enabled|retention_consent|provider_not_available/.test(code) }; } } catch {} } });
      responseBody = responseBody.pipeThrough(new TransformStream<Uint8Array<ArrayBuffer>, Uint8Array<ArrayBuffer>>({ async transform(chunk, controller) {
        parser.feed(decoder.decode(chunk, { stream: true }));
        if (terminal) { const failed = terminal as { message: string; block: boolean }; terminal = null; await supabaseAdmin.from("educational_visuals").update({ status: "failed", error: failed.message }).eq("id", row.id); if (failed.block) { const { error } = await supabaseAdmin.from("visual_ai_blocks").upsert({ user_id: user.userId, message: failed.message }); if (error) console.error("Could not persist streamed AI pause", error.code); } }
        controller.enqueue(chunk);
      } }));
    }
    return new Response(responseBody, { status: upstream.status, headers: getLovableAiGatewayResponseHeaders(upstream.headers, { "Content-Type": upstream.headers.get("Content-Type") ?? "application/json", "Cache-Control": "no-store" }) });
  } catch (error) { if (visualId) { const { supabaseAdmin } = await import("@/integrations/supabase/client.server"); await supabaseAdmin.from("educational_visuals").update({ status: "failed", error: error instanceof Error ? error.message : "Generation failed." }).eq("id", visualId); } return visualFailure(error, userId); }
} } } });