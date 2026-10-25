import { useEffect, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setUser(s?.user ?? null));
    supabase.auth.getUser().then(({ data }) => {
      setUser(data.user ?? null);
      setLoading(false);
    });
    return () => sub.subscription.unsubscribe();
  }, []);
  return { user, loading };
}

export function useRoles(userId: string | undefined) {
  const [roles, setRoles] = useState<string[]>([]);
  useEffect(() => {
    if (!userId) return;
    supabase.from("user_roles").select("role").eq("user_id", userId).then(({ data }) => setRoles((data ?? []).map((r) => r.role)));
  }, [userId]);
  return roles;
}
