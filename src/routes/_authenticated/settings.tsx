import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { PageHeader } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useServerFn } from "@tanstack/react-start";
import { deleteMyAccount } from "@/lib/admin.functions";

export const Route = createFileRoute("/_authenticated/settings")({
  head: () => ({ meta: [{ title: "Settings — Haider AI Research" }, { name: "description", content: "Profile and account settings." }, { property: "og:title", content: "Settings — Haider AI Research" }, { property: "og:description", content: "Profile and account settings." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary_large_image" }] }),
  component: SettingsPage,
});

function SettingsPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const delAccount = useServerFn(deleteMyAccount);
  const [name, setName] = useState("");
  const [lang, setLang] = useState("en");
  const [cur, setCur] = useState("");
  const [pw, setPw] = useState("");
  useEffect(() => {
    if (!user) return;
    supabase.from("profiles").select("display_name, preferred_language").eq("id", user.id).maybeSingle().then(({ data }) => {
      setName(data?.display_name ?? ""); setLang(data?.preferred_language ?? "en");
    });
  }, [user]);

  async function saveProfile() {
    if (!user) return;
    const { error } = await supabase.from("profiles").update({ display_name: name, preferred_language: lang }).eq("id", user.id);
    error ? toast.error(error.message) : toast.success("Profile saved");
  }
  async function changePw() {
    const { error } = await supabase.auth.updateUser({ password: pw, current_password: cur } as never);
    error ? toast.error(error.message) : (toast.success("Password changed"), setPw(""), setCur(""));
  }
  async function deleteData() {
    if (!confirm("Delete ALL your conversations, documents, quizzes and notes? This cannot be undone.")) return;
    await Promise.all(["conversations", "documents", "quizzes", "notes"].map((t) => supabase.from(t as "notes").delete().neq("id", "00000000-0000-0000-0000-000000000000")));
    toast.success("Your data was deleted.");
  }

  return (
    <>
      <PageHeader title="Settings" />
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="space-y-4 rounded-2xl glass p-6">
          <h2 className="font-semibold">Profile</h2>
          <div><Label>Email</Label><Input value={user?.email ?? ""} disabled /></div>
          <div><Label>Display name</Label><Input value={name} onChange={(e) => setName(e.target.value)} /></div>
          <div><Label>Preferred language</Label>
            <select className="h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm" value={lang} onChange={(e) => setLang(e.target.value)}>
              <option value="en">English</option><option value="ur">اردو (Urdu)</option>
            </select>
          </div>
          <Button variant="hero" onClick={saveProfile}>Save profile</Button>
        </div>
        <div className="space-y-4 rounded-2xl glass p-6">
          <h2 className="font-semibold">Account security</h2>
          <div><Label>Current password</Label><Input type="password" value={cur} onChange={(e) => setCur(e.target.value)} /></div>
          <div><Label>New password</Label><Input type="password" minLength={6} value={pw} onChange={(e) => setPw(e.target.value)} /></div>
          <Button variant="glass" onClick={changePw} disabled={pw.length < 6}>Change password</Button>
          <hr className="border-border" />
          <h2 className="font-semibold text-destructive">Danger zone</h2>
          <p className="text-sm text-muted-foreground">Delete your study data, or permanently delete your whole account.</p>
          <div className="flex gap-2">
            <Button variant="destructive" onClick={deleteData}>Delete my data</Button>
            <Button variant="destructive" onClick={async () => {
              if (!confirm("Permanently delete your account and everything in it?")) return;
              try { await delAccount(); await supabase.auth.signOut(); navigate({ to: "/" }); } catch (e) { toast.error((e as Error).message); }
            }}>Delete account</Button>
          </div>
        </div>
      </div>
    </>
  );
}
