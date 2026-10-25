import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Link, Outlet, useNavigate, useRouterState } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  LayoutDashboard, MessageSquare, FileText, ListChecks, Sigma, NotebookPen, Settings, ShieldHalf, LogOut, Menu, X, ImagePlus,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth, useRoles } from "@/hooks/useAuth";
import { Logo } from "@/components/Logo";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const nav = [
  { to: "/dashboard", label: "Overview", icon: LayoutDashboard },
  { to: "/assistant", label: "AI Assistant & History", icon: MessageSquare },
  { to: "/documents", label: "Documents & Summaries", icon: FileText },
  { to: "/quiz", label: "Quiz Studio", icon: ListChecks },
  { to: "/math", label: "Mathematics Solver", icon: Sigma },
  { to: "/visuals", label: "Visual Studio", icon: ImagePlus },
  { to: "/notes", label: "Research & Notes", icon: NotebookPen },
  { to: "/settings", label: "Settings", icon: Settings },
] as const;

export function AppShell() {
  const { user } = useAuth();
  const roles = useRoles(user?.id);
  const navigate = useNavigate();
  const path = useRouterState({ select: (s) => s.location.pathname });
  const [open, setOpen] = useState(false);
  const [suspended, setSuspended] = useState(false);

  useEffect(() => {
    if (!user) return;
    supabase.from("profiles").select("suspended").eq("id", user.id).maybeSingle().then(({ data }) => setSuspended(!!data?.suspended));
  }, [user]);
  useEffect(() => setOpen(false), [path]);

  async function signOut() {
    await supabase.auth.signOut();
    navigate({ to: "/" });
  }

  if (suspended && !roles.includes("developer")) {
    return (
      <div className="flex min-h-screen items-center justify-center p-6 text-center">
        <div className="max-w-md rounded-3xl glass p-8">
          <h1 className="text-xl font-bold">Account suspended</h1>
          <p className="mt-2 text-muted-foreground">Your account has been suspended by the site owner.</p>
          <Button className="mt-6" onClick={signOut}>Sign out</Button>
        </div>
      </div>
    );
  }

  const isDev = roles.includes("developer");

  return (
    <div className="flex min-h-screen">
      <aside className={cn("fixed inset-y-0 left-0 z-40 w-64 border-r border-sidebar-border bg-sidebar p-4 transition-transform md:translate-x-0", open ? "translate-x-0" : "-translate-x-full")}>
        <div className="mb-8 flex items-center justify-between px-2 pt-1">
          <Logo />
          <button className="md:hidden" onClick={() => setOpen(false)} aria-label="Close menu"><X className="h-5 w-5" /></button>
        </div>
        <nav className="space-y-1">
          {nav.map((n) => (
            <Link key={n.to} to={n.to} className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-sidebar-foreground/80 hover:bg-sidebar-accent" activeProps={{ className: "bg-sidebar-accent text-foreground shadow-cyan" }}>
              <n.icon className="h-4 w-4" /> {n.label}
            </Link>
          ))}
          {isDev && (
            <Link to="/admin" className="mt-4 flex items-center gap-3 rounded-xl border border-magenta/40 px-3 py-2.5 text-sm text-pink hover:bg-sidebar-accent" activeProps={{ className: "bg-sidebar-accent" }}>
              <ShieldHalf className="h-4 w-4" /> Developer Console
            </Link>
          )}
        </nav>
        <div className="absolute inset-x-4 bottom-4 rounded-xl border border-sidebar-border p-3 text-xs">
          <div className="truncate text-muted-foreground">{user?.email}</div>
          <button onClick={signOut} className="mt-2 flex items-center gap-2 text-foreground hover:text-cyan"><LogOut className="h-3.5 w-3.5" /> Sign out</button>
        </div>
      </aside>
      <div className="flex-1 md:pl-64">
        <div className="sticky top-0 z-30 flex h-14 items-center border-b border-border bg-background/70 px-4 backdrop-blur md:hidden">
          <button onClick={() => setOpen(true)} aria-label="Open menu"><Menu className="h-5 w-5" /></button>
          <span className="ml-3 font-semibold">Haider AI Research</span>
        </div>
        <main className="mx-auto max-w-6xl p-5 md:p-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

export function PageHeader({ title, subtitle, children }: { title: string; subtitle?: string; children?: React.ReactNode }) {
  return (
    <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="text-3xl font-bold">{title}</h1>
        {subtitle && <p className="mt-1 text-muted-foreground">{subtitle}</p>}
      </div>
      {children}
    </div>
  );
}

export function Markdown({ children, lang }: { children: string; lang?: string | undefined }) {
  return <MarkdownInner text={children} lang={lang} />;
}

function MarkdownInner({ text, lang }: { text: string; lang?: string | undefined }) {
  return (
    <div className={cn("prose-ai", lang === "ur" && "urdu")}>
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{text}</ReactMarkdown>
    </div>
  );
}
