import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
export const failVisual = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).inputValidator((d: unknown) => z.object({ id: z.string().uuid(), message: z.string().max(1000) }).parse(d)).handler(async ({ data, context }) => {
  const { data: row } = await context.supabase.from("educational_visuals").select("id").eq("id", data.id).single(); if (!row) return { ok: false };
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  await supabaseAdmin.from("educational_visuals").update({ status: "failed", error: data.message }).eq("id", data.id).eq("user_id", context.userId).neq("status", "ready"); return { ok: true };
});
export const finishVisual = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).inputValidator((d: unknown) => z.object({ id: z.string().uuid(), path: z.string().max(200) }).parse(d)).handler(async ({ data, context }) => {
  if (!data.path.startsWith(`${context.userId}/${data.id}.`) || !/\.(png|webp)$/.test(data.path)) throw new Error("Invalid image path.");
  const { data: row } = await context.supabase.from("educational_visuals").select("id").eq("id", data.id).single(); if (!row) throw new Error("Visual not found.");
  const { data: file } = await context.supabase.storage.from("educational-visuals").download(data.path); if (!file) throw new Error("Image was not saved.");
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { error } = await supabaseAdmin.from("educational_visuals").update({ storage_path: data.path, status: "ready" }).eq("id", data.id).eq("user_id", context.userId); if (error) throw error;
  return { ok: true };
});