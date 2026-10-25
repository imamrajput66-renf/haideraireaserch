import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { KeyRound, ShieldHalf, Users, Activity, Settings2, Bot, Database, ScrollText, Globe, LifeBuoy, Lock } from "lucide-react";
import { toast } from "sonner";
import { useAuth, useRoles } from "@/hooks/useAuth";
import { PageHeader } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { checkDeveloper, getDeveloperData, setUserSuspended, setUserAdmin, updateSetting, deleteUserAccount } from "@/lib/admin.functions";

export const Route = createFileRoute("/_authenticated/admin")({
  head: () => ({ meta: [{ title: "Developer Console — Haider AI Research" }, { name: "description", content: "Owner and developer console." }, { property: "og:title", content: "Developer Console — Haider AI Research" }, { property: "og:description", content: "Owner and developer console." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary_large_image" }] }),
  component: AdminPage,
});

const CODE_KEY = "hair-dev-code";

function AdminPage() {
  const { user, loading } = useAuth();
  const roles = useRoles(user?.id);
  const [code, setCode] = useState<string | null>(null);
  useEffect(() => { setCode(sessionStorage.getItem(CODE_KEY)); }, []);

  if (loading) return null;
  if (!roles.includes("developer")) {
    return (
      <div className="mx-auto mt-20 max-w-md rounded-3xl glass p-8 text-center">
        <Lock className="mx-auto h-10 w-10 text-magenta" />
        <h1 className="mt-4 text-xl font-bold">Developer access only</h1>
        <p className="mt-2 text-sm text-muted-foreground">This console is only available to the site owner's developer account.</p>
        <Button asChild className="mt-6" variant="glass"><Link to="/dashboard">Back to dashboard</Link></Button>
      </div>
    );
  }
  if (!code) return <CodeGate onOk={(c) => { sessionStorage.setItem(CODE_KEY, c); setCode(c); }} />;
  return <Console code={code} onLock={() => { sessionStorage.removeItem(CODE_KEY); setCode(null); }} />;
}

function CodeGate({ onOk }: { onOk: (c: string) => void }) {
  const check = useServerFn(checkDeveloper);
  const [v, setV] = useState("");
  const [busy, setBusy] = useState(false);
  async function go(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try { await check({ data: { code: v } }); onOk(v); }
    catch { toast.error("Wrong developer code."); }
    setBusy(false);
  }
  return (
    <form onSubmit={go} className="mx-auto mt-20 max-w-sm rounded-3xl glass p-8 text-center shadow-glow">
      <KeyRound className="mx-auto h-10 w-10 text-cyan" />
      <h1 className="mt-4 text-xl font-bold">Enter developer code</h1>
      <p className="mt-1 text-sm text-muted-foreground">Your secret code unlocks the console for this browser tab.</p>
      <Input type="password" inputMode="numeric" className="mt-5 text-center text-lg tracking-[0.5em]" value={v} onChange={(e) => setV(e.target.value)} autoFocus />
      <Button type="submit" variant="hero" className="mt-4 w-full" disabled={busy || !v}>Unlock</Button>
    </form>
  );
}

function Console({ code, onLock }: { code: string; onLock: () => void }) {
  const qc = useQueryClient();
  const get = useServerFn(getDeveloperData);
  const suspend = useServerFn(setUserSuspended);
  const mkAdmin = useServerFn(setUserAdmin);
  const save = useServerFn(updateSetting);
  const del = useServerFn(deleteUserAccount);
  const { user } = useAuth();
  const { data, error, isLoading } = useQuery({ queryKey: ["dev-data"], queryFn: () => get({ data: { code } }), retry: false });
  const refresh = () => qc.invalidateQueries({ queryKey: ["dev-data"] });

  useEffect(() => { if (error) { toast.error((error as Error).message); onLock(); } }, [error, onLock]);
  if (isLoading || !data) return <p className="text-muted-foreground">Loading console…</p>;

  async function act(fn: () => Promise<unknown>, msg: string) {
    try { await fn(); toast.success(msg); refresh(); } catch (e) { toast.error((e as Error).message); }
  }

  const features = (data.settings["features"] ?? {}) as Record<string, boolean>;
  const branding = (data.settings["branding"] ?? {}) as Record<string, string>;
  const emailOf = (id: string) => data.users.find((u) => u.id === id)?.email ?? id.slice(0, 8);
  const since = (d: string) => Date.now() - new Date(d).getTime() < 86400000;

  return (
    <>
      <PageHeader title="Developer Console" subtitle="Everything happening on Haider AI Research.">
        <Button variant="ghost" onClick={onLock}><Lock /> Lock console</Button>
      </PageHeader>

      <Tabs defaultValue="overview">
        <TabsList className="mb-6 flex h-auto flex-wrap gap-1 bg-secondary">
          <TabsTrigger value="overview"><ShieldHalf className="mr-1 h-4 w-4" />Overview</TabsTrigger>
          <TabsTrigger value="users"><Users className="mr-1 h-4 w-4" />Users</TabsTrigger>
          <TabsTrigger value="logins"><Activity className="mr-1 h-4 w-4" />Login activity</TabsTrigger>
          <TabsTrigger value="site"><Settings2 className="mr-1 h-4 w-4" />Website & features</TabsTrigger>
          <TabsTrigger value="ai"><Bot className="mr-1 h-4 w-4" />AI</TabsTrigger>
          <TabsTrigger value="data"><Database className="mr-1 h-4 w-4" />Data</TabsTrigger>
          <TabsTrigger value="audit"><ScrollText className="mr-1 h-4 w-4" />Security & audit</TabsTrigger>
          <TabsTrigger value="deploy"><Globe className="mr-1 h-4 w-4" />Deployment</TabsTrigger>
          <TabsTrigger value="help"><LifeBuoy className="mr-1 h-4 w-4" />Help</TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Card label="Registered users" value={data.users.length} />
            <Card label="Sign-ins (24h)" value={data.logins.filter((l) => since(l.created_at)).length} />
            <Card label="Documents" value={data.counts["documents"] ?? 0} />
            <Card label="AI service" value={data.ai.configured ? "Online" : "Not set"} />
          </div>
          <div className="mt-6 grid gap-4 lg:grid-cols-2">
            <Box title="Latest sign-ins">
              {data.logins.slice(0, 8).map((l) => <Row key={l.id} a={l.email ?? emailOf(l.user_id)} b={new Date(l.created_at).toLocaleString()} />)}
              {!data.logins.length && <Empty />}
            </Box>
            <Box title="Document processing">
              {data.recentDocs.slice(0, 8).map((d) => <Row key={d.id} a={`${d.name} · ${emailOf(d.user_id)}`} b={d.status} />)}
              {!data.recentDocs.length && <Empty />}
            </Box>
          </div>
        </TabsContent>

        <TabsContent value="users">
          <div className="overflow-x-auto rounded-2xl glass">
            <table className="w-full text-sm">
              <thead className="text-left text-muted-foreground"><tr>{["Email", "Name", "Joined", "Last sign-in", "Via", "Roles", "Status", ""].map((h) => <th key={h} className="p-3 font-medium">{h}</th>)}</tr></thead>
              <tbody>
                {data.users.map((u) => (
                  <tr key={u.id} className="border-t border-border">
                    <td className="p-3">{u.email}{!u.confirmed && <span className="ml-1 text-xs text-cyan">(unconfirmed)</span>}</td>
                    <td className="p-3">{u.name}</td>
                    <td className="p-3 text-muted-foreground">{new Date(u.createdAt).toLocaleDateString()}</td>
                    <td className="p-3 text-muted-foreground">{u.lastSignIn ? new Date(u.lastSignIn).toLocaleString() : "Never"}</td>
                    <td className="p-3">{u.provider}</td>
                    <td className="p-3">{u.roles.join(", ")}</td>
                    <td className="p-3">{u.suspended ? <span className="text-destructive">Suspended</span> : <span className="text-success">Active</span>}</td>
                    <td className="p-3">
                      {u.id !== user?.id && (
                        <div className="flex gap-1">
                          <Button size="sm" variant="ghost" onClick={() => confirm(`${u.suspended ? "Reactivate" : "Suspend"} ${u.email}?`) && act(() => suspend({ data: { code, userId: u.id, suspended: !u.suspended } }), "Updated")}>{u.suspended ? "Reactivate" : "Suspend"}</Button>
                          <Button size="sm" variant="ghost" onClick={() => confirm(`Change admin role for ${u.email}?`) && act(() => mkAdmin({ data: { code, userId: u.id, admin: !u.roles.includes("admin") } }), "Role updated")}>{u.roles.includes("admin") ? "Remove admin" : "Make admin"}</Button>
                          <Button size="sm" variant="ghost" className="text-destructive" onClick={() => confirm(`Permanently delete ${u.email}?`) && act(() => del({ data: { code, userId: u.id } }), "User deleted")}>Delete</Button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </TabsContent>

        <TabsContent value="logins">
          <Box title={`Sign-in history (${data.logins.length} most recent)`}>
            {data.logins.map((l) => <Row key={l.id} a={`${l.email ?? emailOf(l.user_id)} — ${shortAgent(l.user_agent)}`} b={new Date(l.created_at).toLocaleString()} />)}
            {!data.logins.length && <Empty />}
          </Box>
        </TabsContent>

        <TabsContent value="site">
          <div className="grid gap-4 lg:grid-cols-2">
            <Box title="Feature visibility">
              {Object.entries(features).map(([k, v]) => (
                <div key={k} className="flex items-center justify-between py-2 text-sm">
                  <span className="capitalize">{k}</span>
                  <Switch checked={v} onCheckedChange={(nv) => act(() => save({ data: { code, key: "features", value: { ...features, [k]: nv } } }), "Saved")} />
                </div>
              ))}
            </Box>
            <BrandingForm initial={branding} onSave={(v) => act(() => save({ data: { code, key: "branding", value: v } }), "Branding saved")} />
          </div>
        </TabsContent>

        <TabsContent value="ai">
          <Box title="AI configuration">
            <Row a="Provider" b={data.ai.provider} /><Row a="Model" b={data.ai.model} /><Row a="Connection" b={data.ai.configured ? "Connected (key stored securely, never shown)" : "Missing"} />
            <Row a="Messages stored" b={String(data.counts["messages"] ?? 0)} />
            <p className="mt-3 text-sm text-muted-foreground">AI usage is billed from your Lovable workspace credits (Settings → Plans & credits). If AI stops, check credits first.</p>
          </Box>
        </TabsContent>

        <TabsContent value="data">
          <Box title="Record counts">
            {Object.entries(data.counts).map(([k, v]) => <Row key={k} a={k.replace("_", " ")} b={String(v)} />)}
            <p className="mt-3 text-sm text-muted-foreground">The database is managed by Lovable Cloud with automatic backups. Raw database access is intentionally not available from the browser — open it from the Lovable editor (Cloud → Database).</p>
          </Box>
        </TabsContent>

        <TabsContent value="audit">
          <Box title="Administrative actions">
            {data.audit.map((a) => <Row key={a.id} a={`${a.action.replaceAll("_", " ")}${a.target ? ` → ${emailOf(a.target)}` : ""} (by ${emailOf(a.actor_id)})`} b={new Date(a.created_at).toLocaleString()} />)}
            {!data.audit.length && <Empty />}
          </Box>
        </TabsContent>

        <TabsContent value="deploy">
          <Box title="Deployment & domain">
            <ul className="list-disc space-y-2 pl-5 text-sm text-muted-foreground">
              <li>Publish or re-publish from the <b className="text-foreground">Publish</b> button at the top-right of the Lovable editor.</li>
              <li>Connect your own domain in Lovable: Project Settings → Domains.</li>
              <li>Export the source code by connecting GitHub in Project Settings.</li>
              <li>Secrets (AI key, developer code) live in Lovable Cloud and are never shown here.</li>
            </ul>
          </Box>
        </TabsContent>

        <TabsContent value="help">
          <Box title="The three kinds of account">
            <ul className="list-disc space-y-2 pl-5 text-sm text-muted-foreground">
              <li><b className="text-foreground">Website-builder account</b> — your Lovable login. Used to edit, publish and manage the project at lovable.dev.</li>
              <li><b className="text-foreground">Developer/owner account</b> — imamhaider2121@gmail.com inside this website. It gets the developer role automatically once the email is confirmed, and this console also needs your secret code.</li>
              <li><b className="text-foreground">Regular user accounts</b> — students and researchers who sign up. They never see this console.</li>
            </ul>
            <p className="mt-3 text-sm text-muted-foreground">To change your developer code, ask in the Lovable chat to update the DEVELOPER_CODE secret.</p>
          </Box>
        </TabsContent>
      </Tabs>
    </>
  );
}

function shortAgent(ua: string | null) {
  if (!ua) return "unknown device";
  const b = /Edg\//.test(ua) ? "Edge" : /Chrome\//.test(ua) ? "Chrome" : /Firefox\//.test(ua) ? "Firefox" : /Safari\//.test(ua) ? "Safari" : "Browser";
  const os = /Android/.test(ua) ? "Android" : /iPhone|iPad/.test(ua) ? "iOS" : /Windows/.test(ua) ? "Windows" : /Mac OS/.test(ua) ? "macOS" : /Linux/.test(ua) ? "Linux" : "";
  return `${b}${os ? " on " + os : ""}`;
}

function BrandingForm({ initial, onSave }: { initial: Record<string, string>; onSave: (v: Record<string, string>) => void }) {
  const [v, setV] = useState(initial);
  return (
    <Box title="Branding">
      <div className="space-y-3">
        <Input value={v["siteName"] ?? ""} onChange={(e) => setV({ ...v, siteName: e.target.value })} placeholder="Site name" />
        <Input value={v["tagline"] ?? ""} onChange={(e) => setV({ ...v, tagline: e.target.value })} placeholder="Tagline" />
        <Button variant="hero" size="sm" onClick={() => onSave(v)}>Save branding</Button>
      </div>
    </Box>
  );
}

function Card({ label, value }: { label: string; value: string | number }) {
  return <div className="rounded-2xl glass p-5"><div className="text-sm text-muted-foreground">{label}</div><div className="mt-1 text-3xl font-bold text-gradient">{value}</div></div>;
}
function Box({ title, children }: { title: string; children: React.ReactNode }) {
  return <div className="rounded-2xl glass p-5"><h3 className="mb-3 font-semibold">{title}</h3>{children}</div>;
}
function Row({ a, b }: { a: string; b: string }) {
  return <div className="flex justify-between gap-4 border-b border-border/50 py-2 text-sm last:border-0"><span className="truncate capitalize-first">{a}</span><span className="shrink-0 text-muted-foreground">{b}</span></div>;
}
function Empty() { return <p className="text-sm text-muted-foreground">Nothing yet.</p>; }
