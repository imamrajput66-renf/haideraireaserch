import { userClientFromRequest } from "@/lib/user-client.server";
export async function visualAccess(request: Request) {
  const user = await userClientFromRequest(request);
  if (!user) throw Object.assign(new Error("Please sign in again."), { status: 401 });
  const { data, error } = await user.supabase.from("profiles").select("suspended").eq("id", user.userId).single();
  if (error || !data || data.suspended) throw Object.assign(new Error("Your account cannot use this tool."), { status: 403 });
  return user;
}
export async function visualFailure(error: unknown, userId?: string) {
  const e = error as { status?: number; statusCode?: number; message?: string; responseBody?: string };
  const status = e.status ?? e.statusCode ?? 500;
  let message = e.message ?? "Unable to generate this visual. Please try again.";
  if (e.responseBody) { try { const body = JSON.parse(e.responseBody); message = body.error?.message ?? body.message ?? message; } catch {} }
  if (userId && (status === 402 || status === 403) && !e.status) {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error: blockError } = await supabaseAdmin.from("visual_ai_blocks").upsert({ user_id: userId, message });
    if (blockError) console.error("Could not persist visual AI pause", blockError.code);
  }
  return Response.json({ error: message }, { status, headers: { "Cache-Control": "no-store" } });
}