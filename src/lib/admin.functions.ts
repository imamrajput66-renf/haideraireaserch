import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { isDeveloperAuthorized } from "@/lib/dev-access";

type Ctx = { supabase: any; userId: string };

async function assertDeveloper(context: Ctx, code: string) {
  const { data: isDev } = await context.supabase.rpc("has_role", { _user_id: context.userId, _role: "developer" });
  if (!isDeveloperAuthorized(!!isDev, code, process.env["DEVELOPER_CODE"])) {
    throw new Error("Access denied: developer role and correct code required.");
  }
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

export const checkDeveloper = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { code: string }) => d)
  .handler(async ({ data, context }) => {
    const admin = await assertDeveloper(context as Ctx, data.code);
    await admin.from("admin_audit").insert({ actor_id: context.userId, action: "developer_unlock", target: null });
    return { ok: true };
  });

export const getDeveloperData = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { code: string }) => d)
  .handler(async ({ data, context }) => {
    const admin = await assertDeveloper(context as Ctx, data.code);
    const [usersRes, profiles, roles, logins, audit, settings, counts] = await Promise.all([
      admin.auth.admin.listUsers({ page: 1, perPage: 500 }),
      admin.from("profiles").select("id, display_name, suspended, preferred_language"),
      admin.from("user_roles").select("user_id, role"),
      admin.from("login_events").select("id, user_id, email, event, user_agent, created_at").order("created_at", { ascending: false }).limit(200),
      admin.from("admin_audit").select("id, actor_id, action, target, created_at").order("created_at", { ascending: false }).limit(100),
      admin.from("app_settings").select("key, value"),
      Promise.all(
        (["conversations", "messages", "documents", "document_chunks", "quizzes", "notes"] as const).map(async (t) => {
          const { count } = await admin.from(t).select("*", { count: "exact", head: true });
          return [t, count ?? 0] as const;
        }),
      ),
    ]);
    const { data: docs } = await admin.from("documents").select("id, name, status, user_id, created_at").order("created_at", { ascending: false }).limit(20);
    const profMap = new Map((profiles.data ?? []).map((p) => [p.id, p]));
    const users = (usersRes.data?.users ?? []).map((u) => ({
      id: u.id,
      email: u.email ?? "",
      createdAt: u.created_at,
      lastSignIn: u.last_sign_in_at ?? null,
      confirmed: !!u.email_confirmed_at,
      provider: (u.app_metadata?.provider as string) ?? "email",
      name: profMap.get(u.id)?.display_name ?? "",
      suspended: profMap.get(u.id)?.suspended ?? false,
      roles: (roles.data ?? []).filter((r) => r.user_id === u.id).map((r) => r.role),
    }));
    return {
      users,
      logins: logins.data ?? [],
      audit: audit.data ?? [],
      settings: Object.fromEntries((settings.data ?? []).map((s) => [s.key, s.value])),
      counts: Object.fromEntries(counts),
      recentDocs: docs ?? [],
      ai: { configured: !!process.env["LOVABLE_API_KEY"], model: "openai/gpt-6-astra", provider: "Lovable AI" },
    };
  });

export const setUserSuspended = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { code: string; userId: string; suspended: boolean }) => d)
  .handler(async ({ data, context }) => {
    const admin = await assertDeveloper(context as Ctx, data.code);
    if (data.userId === context.userId) throw new Error("You can't suspend yourself.");
    await admin.from("profiles").update({ suspended: data.suspended }).eq("id", data.userId);
    await admin.from("admin_audit").insert({ actor_id: context.userId, action: data.suspended ? "suspend_user" : "reactivate_user", target: data.userId });
    return { ok: true };
  });

export const setUserAdmin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { code: string; userId: string; admin: boolean }) => d)
  .handler(async ({ data, context }) => {
    const admin = await assertDeveloper(context as Ctx, data.code);
    if (data.admin) await admin.from("user_roles").upsert({ user_id: data.userId, role: "admin" }, { onConflict: "user_id,role" });
    else await admin.from("user_roles").delete().eq("user_id", data.userId).eq("role", "admin");
    await admin.from("admin_audit").insert({ actor_id: context.userId, action: data.admin ? "grant_admin" : "revoke_admin", target: data.userId });
    return { ok: true };
  });

export const updateSetting = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { code: string; key: string; value: Record<string, unknown> }) => d)
  .handler(async ({ data, context }) => {
    if (!["features", "branding"].includes(data.key)) throw new Error("Unknown setting.");
    const admin = await assertDeveloper(context as Ctx, data.code);
    await admin.from("app_settings").upsert({ key: data.key, value: data.value as never, updated_at: new Date().toISOString() });
    await admin.from("admin_audit").insert({ actor_id: context.userId, action: `update_${data.key}`, target: null });
    return { ok: true };
  });

export const deleteUserAccount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { code: string; userId: string }) => d)
  .handler(async ({ data, context }) => {
    const admin = await assertDeveloper(context as Ctx, data.code);
    if (data.userId === context.userId) throw new Error("You can't delete your own developer account here.");
    await admin.auth.admin.deleteUser(data.userId);
    await admin.from("admin_audit").insert({ actor_id: context.userId, action: "delete_user", target: data.userId });
    return { ok: true };
  });

/** Lets any signed-in user permanently delete their own account and data. */
export const deleteMyAccount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    for (const t of ["conversations", "messages", "documents", "document_chunks", "quizzes", "notes"] as const) {
      await supabaseAdmin.from(t).delete().eq("user_id", context.userId);
    }
    const { error } = await supabaseAdmin.auth.admin.deleteUser(context.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
