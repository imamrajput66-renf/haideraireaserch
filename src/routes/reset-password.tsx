import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export const Route = createFileRoute("/reset-password")({
  head: () => ({
    meta: [
      { title: "Set new password — Haider AI Research" },
      { name: "description", content: "Choose a new password for your account." },
      { property: "og:title", content: "Set new password — Haider AI Research" },
      { property: "og:description", content: "Reset your Haider AI Research password." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Reset,
});

function Reset() {
  const [pw, setPw] = useState("");
  const navigate = useNavigate();
  async function save(e: React.FormEvent) {
    e.preventDefault();
    const { error } = await supabase.auth.updateUser({ password: pw });
    if (error) { toast.error(error.message); return; }
    toast.success("Password updated.");
    navigate({ to: "/dashboard" });
  }
  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <form onSubmit={save} className="w-full max-w-sm space-y-4 rounded-3xl glass p-8">
        <h1 className="text-xl font-bold">Set a new password</h1>
        <Input type="password" minLength={6} value={pw} onChange={(e) => setPw(e.target.value)} placeholder="New password" required />
        <Button type="submit" variant="hero" className="w-full">Save password</Button>
      </form>
    </div>
  );
}
