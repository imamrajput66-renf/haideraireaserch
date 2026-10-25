import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import {
  Brain, FileSearch, Quote, ListChecks, Sigma, FolderKanban, Languages, ScanText, Mic, Workflow,
  Upload, MessageSquare, Sparkles, ShieldCheck, ArrowRight, ImagePlus,
} from "lucide-react";
import heroMp4 from "@/assets/hero-loop.mp4.asset.json";
import heroWebm from "@/assets/hero-loop.webm.asset.json";
import heroPoster from "@/assets/hero-poster.jpg.asset.json";
import { Button } from "@/components/ui/button";
import { Logo, LogoMark } from "@/components/Logo";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Haider AI Research — Think Deeper. Learn Smarter." },
      { name: "description", content: "Upload study material, ask questions, generate quizzes, solve math and summarize documents with an AI study companion in English and Urdu." },
      { property: "og:title", content: "Haider AI Research — Think Deeper. Learn Smarter." },
      { property: "og:description", content: "Your intelligent study and research companion for documents, quizzes, math and more." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Landing,
});

const features = [
  { icon: Brain, title: "AI Study Assistant", text: "Explanations, examples and study notes on any topic.", to: "/assistant" },
  { icon: FileSearch, title: "Document Research", text: "Upload PDFs, TXT and page photos and explore them with AI.", to: "/documents" },
  { icon: Quote, title: "Source-Grounded Answers", text: "Answers cite the exact part of your document they came from.", to: "/assistant" },
  { icon: ListChecks, title: "Smart Quiz Generator", text: "Turn any topic or document into a scored quiz.", to: "/quiz" },
  { icon: Sigma, title: "Mathematical Solver", text: "Step-by-step working with a checked final answer.", to: "/math" },
  { icon: ImagePlus, title: "Educational Visual Studio", text: "Create images, labeled diagrams, flowcharts and mathematical graphs.", to: "/visuals" },
  { icon: FolderKanban, title: "Research Workspace", text: "Keep notes and research organised in one place.", to: "/notes" },
  { icon: Languages, title: "English and Urdu", text: "Ask and receive answers in English or اردو.", to: "/assistant" },
  { icon: ScanText, title: "OCR Document Scanning", text: "Upload scanned papers or page photos and get their text.", to: "/documents" },
  { icon: Mic, title: "Voice Input", text: "Speak your question in the assistant using your browser's mic.", to: "/assistant" },
  { icon: Workflow, title: "Guided AI Workflows", text: "Upload → summarise → quiz yourself → take notes.", to: "/dashboard" },
] as const;

function HeroVideo() {
  const ref = useRef<HTMLVideoElement>(null);
  const [failed, setFailed] = useState(false);
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    setReduced(window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  }, []);
  useEffect(() => {
    if (reduced) ref.current?.pause();
  }, [reduced]);
  useEffect(() => {
    const v = ref.current;
    if (!v || reduced) return;
    v.muted = true;
    void v.play().catch(() => {});
  }, [reduced]);
  return (
    <div className="absolute inset-0 -z-10 overflow-hidden bg-midnight">
      {!failed && (
        <video
          ref={ref}
          className="h-full w-full object-cover opacity-80"
          poster={heroPoster.url}
          autoPlay={!reduced}
          muted
          loop
          playsInline
          preload="auto"
          onError={() => setFailed(true)}
        >
          <source src={heroWebm.url} type="video/webm" />
          <source src={heroMp4.url} type="video/mp4" />
        </video>
      )}
      {failed && <div className="h-full w-full grid-lines bg-brand opacity-30" />}
      <div className="absolute inset-0 hero-overlay" />
    </div>
  );
}

function Landing() {
  return (
    <div className="min-h-screen">
      <header className="fixed inset-x-0 top-0 z-30 border-b border-border/60 bg-background/60 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-5">
          <Logo />
          <nav className="hidden items-center gap-7 text-sm text-muted-foreground md:flex">
            <a href="#features" className="hover:text-foreground">Features</a>
            <a href="#how" className="hover:text-foreground">How it works</a>
            <a href="#privacy" className="hover:text-foreground">Privacy</a>
          </nav>
          <div className="flex items-center gap-2">
            <Button asChild variant="ghost" size="sm"><Link to="/auth">Sign in</Link></Button>
            <Button asChild variant="hero" size="sm"><Link to="/auth" search={{ mode: "signup" }}>Get started</Link></Button>
          </div>
        </div>
      </header>

      <section className="relative isolate flex min-h-[100svh] items-center overflow-hidden pt-16">
        <HeroVideo />
        <div className="mx-auto grid max-w-7xl items-center gap-12 px-5 py-20 lg:grid-cols-[1.1fr_1fr]">
          <div>
            <div className="mb-6 inline-flex items-center gap-2 rounded-full glass px-3 py-1 text-xs text-violet-soft">
              <Sparkles className="h-3.5 w-3.5 text-cyan" /> AI study & research companion
            </div>
            <h1 className="text-5xl font-bold leading-[1.05] md:text-7xl">
              Think Deeper.<br />Learn Smarter.<br /><span className="text-gradient">Discover More.</span>
            </h1>
            <p className="mt-6 max-w-xl text-lg text-muted-foreground">
              Your intelligent study and research companion. Explore documents, understand complex concepts, generate quizzes, solve mathematical problems, and transform information into knowledge.
            </p>
            <div className="mt-9 flex flex-wrap gap-3">
              <Button asChild variant="hero" size="xl"><Link to="/dashboard">Start Researching <ArrowRight /></Link></Button>
              <Button asChild variant="glass" size="xl"><a href="#features">Explore Features</a></Button>
            </div>
          </div>
          <PreviewCard />
        </div>
      </section>

      <section id="features" className="mx-auto max-w-7xl px-5 py-24">
        <h2 className="text-3xl font-bold md:text-5xl">Everything you need to <span className="text-gradient">study smarter</span></h2>
        <p className="mt-3 max-w-2xl text-muted-foreground">Each tool is live — click any card to open it.</p>
        <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          {features.map((f) => (
            <Link key={f.title} to={f.to} className="group rounded-2xl glass p-5 transition-all hover:-translate-y-1 hover:shadow-glow">
              <f.icon className="h-6 w-6 text-cyan" />
              <h3 className="mt-4 font-semibold">{f.title}</h3>
              <p className="mt-1.5 text-sm text-muted-foreground">{f.text}</p>
            </Link>
          ))}
        </div>
      </section>

      <section id="how" className="relative border-y border-border/60 grid-lines">
        <div className="mx-auto max-w-7xl px-5 py-24">
          <h2 className="text-3xl font-bold md:text-5xl">How it works</h2>
          <div className="mt-12 grid gap-6 md:grid-cols-3">
            {[
              { icon: Upload, t: "1. Upload", d: "Drop in PDF or TXT notes, papers and textbooks. We extract and index the text." },
              { icon: MessageSquare, t: "2. Ask", d: "Chat with the assistant. Pick documents and get answers that cite their sources." },
              { icon: ListChecks, t: "3. Master", d: "Generate quizzes, summaries and step-by-step math to lock in what you learned." },
            ].map((s) => (
              <div key={s.t} className="rounded-2xl glass p-7">
                <s.icon className="h-7 w-7 text-magenta" />
                <h3 className="mt-5 text-xl font-semibold">{s.t}</h3>
                <p className="mt-2 text-muted-foreground">{s.d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="privacy" className="mx-auto max-w-7xl px-5 py-24">
        <div className="grid items-center gap-10 rounded-3xl glass p-10 md:grid-cols-[auto_1fr]">
          <ShieldCheck className="h-16 w-16 text-cyan" />
          <div>
            <h2 className="text-3xl font-bold">Privacy & transparency</h2>
            <p className="mt-3 max-w-3xl text-muted-foreground">
              Your documents, chats and notes are private to your account and protected by row-level security. AI answers are generated by a language model and can contain mistakes — always check important facts against your sources. You can delete your data or your account at any time from Settings.
            </p>
          </div>
        </div>
      </section>

      <footer className="border-t border-border/60">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-4 px-5 py-10 text-sm text-muted-foreground md:flex-row">
          <div className="flex items-center gap-2"><LogoMark className="h-6 w-6" /> © {new Date().getFullYear()} Haider AI Research</div>
          <div className="flex gap-6">
            <Link to="/auth" className="hover:text-foreground">Sign in</Link>
            <a href="#features" className="hover:text-foreground">Features</a>
            <a href="#privacy" className="hover:text-foreground">Privacy</a>
          </div>
        </div>
      </footer>
    </div>
  );
}

function PreviewCard() {
  return (
    <div className="animate-float rounded-3xl glass p-5 shadow-glow">
      <div className="flex items-center gap-2 border-b border-border pb-3 text-xs text-muted-foreground">
        <span className="h-2 w-2 rounded-full bg-cyan animate-pulse-dot" /> AI Study Assistant · Biology_Notes.pdf
      </div>
      <div className="mt-4 space-y-3 text-sm">
        <div className="ml-auto w-fit max-w-[85%] rounded-2xl rounded-br-sm bg-primary/80 px-4 py-2.5">Explain photosynthesis simply.</div>
        <div className="max-w-[90%] rounded-2xl rounded-bl-sm bg-secondary px-4 py-3">
          Plants capture sunlight with <strong className="text-violet-soft">chlorophyll</strong> and turn water + CO₂ into glucose and oxygen.
          <div className="mt-2 text-xs text-cyan">[Source: Biology_Notes.pdf, part 3]</div>
        </div>
        <div className="grid grid-cols-3 gap-2 pt-2 text-center text-xs">
          {["Summary", "Quiz · 8/10", "Notes saved"].map((x) => (
            <div key={x} className="rounded-xl border border-border bg-background/40 py-2 text-muted-foreground">{x}</div>
          ))}
        </div>
      </div>
    </div>
  );
}
