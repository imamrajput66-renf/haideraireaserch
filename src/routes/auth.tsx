import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { LogoMark } from "@/components/Logo";

export const Route = createFileRoute("/auth")({
  validateSearch: (s: Record<string, unknown>) => ({ mode: s["mode"] === "signup" ? ("signup" as const) : undefined }) as { mode?: "signup" },
  head: () => ({
    meta: [
      { title: "Sign in — Haider AI Research" },
      { name: "description", content: "Sign in or create your Haider AI Research account." },
      { property: "og:title", content: "Sign in — Haider AI Research" },
      { property: "og:description", content: "Access your AI study dashboard." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const search = Route.useSearch();
  const navigate = useNavigate();
  const [mode, setMode] = useState<"signin" | "signup" | "forgot">(search.mode === "signup" ? "signup" : "signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => { if (data.session) navigate({ to: "/dashboard" }); });
    const { data } = supabase.auth.onAuthStateChange((_e, s) => { if (s) navigate({ to: "/dashboard" }); });
    return () => data.subscription.unsubscribe();
  }, [navigate]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({
          email, password,
          options: { emailRedirectTo: window.location.origin + "/auth", data: { display_name: name } },
        });
        if (error) throw error;
        setSent("Check your email to confirm your account, then sign in.");
      } else if (mode === "forgot") {
        const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: `${window.location.origin}/reset-password` });
        if (error) throw error;
        setSent("If that email has an account, a reset link is on its way.");
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        navigate({ to: "/dashboard" });
      }
    } catch (err) {
      const msg = (err as Error).message;
      toast.error(msg.includes("Invalid login") ? "Wrong email or password." : msg.includes("already registered") ? "An account with this email already exists." : msg);
    } finally {
      setBusy(false);
    }
  }

  async function google() {
    const r = await lovable.auth.signInWithOAuth("google", { redirect_uri: window.location.origin + "/auth" });
    if (r.error) toast.error("Google sign-in failed.");
    else if (!r.redirected) navigate({ to: "/dashboard" });
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden px-4 grid-lines">
      <div className="absolute -top-40 left-1/2 h-96 w-96 -translate-x-1/2 rounded-full bg-magenta/30 blur-3xl" />
      <div className="relative w-full max-w-md rounded-3xl glass p-8 shadow-glow">
        <Link to="/" className="mx-auto mb-6 flex w-fit"><LogoMark className="h-12 w-12" /></Link>
        <h1 className="text-center text-2xl font-bold">
          {mode === "signup" ? "Create your account" : mode === "forgot" ? "Reset password" : "Welcome back"}
        </h1>
        {sent ? (
          <p className="mt-6 rounded-xl bg-secondary p-4 text-center text-sm">{sent}</p>
        ) : (
          <form onSubmit={submit} className="mt-6 space-y-4">
            {mode === "signup" && (
              <div><Label htmlFor="name">Name</Label><Input id="name" value={name} onChange={(e) => setName(e.target.value)} required /></div>
            )}
            <div><Label htmlFor="email">Email</Label><Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required /></div>
            {mode !== "forgot" && (
              <div><Label htmlFor="pw">Password</Label><Input id="pw" type="password" minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} required /></div>
            )}
            <Button type="submit" variant="hero" className="w-full" size="lg" disabled={busy}>
              {busy ? "Please wait…" : mode === "signup" ? "Sign up" : mode === "forgot" ? "Send reset link" : "Sign in"}
            </Button>
            {mode !== "forgot" && (
              <Button type="button" variant="glass" className="w-full" size="lg" onClick={google}>Continue with Google</Button>
            )}
          </form>
        )}
        <div className="mt-6 flex justify-between text-sm text-muted-foreground">
          {mode === "signin" ? (
            <>
              <button onClick={() => { setMode("signup"); setSent(null); }} className="hover:text-cyan">Create account</button>
              <button onClick={() => { setMode("forgot"); setSent(null); }} className="hover:text-cyan">Forgot password?</button>
            </>
          ) : (
            <button onClick={() => { setMode("signin"); setSent(null); }} className="hover:text-cyan">← Back to sign in</button>
          )}
        </div>
      </div>
    </div>
  );
}
