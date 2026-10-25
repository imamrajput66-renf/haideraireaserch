import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { Upload, Trash2, Sparkles, FileText, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader, Markdown } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { chunkText } from "@/lib/rag";
import { summarizeDocument, ocrImages } from "@/lib/ai.functions";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/documents")({
  head: () => ({ meta: [{ title: "My Documents — Haider AI Research" }, { name: "description", content: "Upload and summarise study documents." }, { property: "og:title", content: "My Documents — Haider AI Research" }, { property: "og:description", content: "Upload and summarise study documents." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary_large_image" }] }),
  component: DocumentsPage,
});

async function extractPdf(file: File) {
  const pdfjs = await import("pdfjs-dist");
  const worker = await import("pdfjs-dist/build/pdf.worker.min.mjs?url");
  pdfjs.GlobalWorkerOptions.workerSrc = worker.default;
  const pdf = await pdfjs.getDocument({ data: await file.arrayBuffer() }).promise;
  let text = "";
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const c = await page.getTextContent();
    text += c.items.map((it) => ("str" in it ? it.str : "")).join(" ") + "\n\n";
  }
  return { text, pages: pdf.numPages };
}

const MAX_OCR_PAGES = 20;

function canvasToJpeg(canvas: HTMLCanvasElement) {
  return canvas.toDataURL("image/jpeg", 0.85);
}

async function imageFileToDataUrl(file: File) {
  const bmp = await createImageBitmap(file);
  const scale = Math.min(1, 2000 / Math.max(bmp.width, bmp.height));
  const c = document.createElement("canvas");
  c.width = Math.round(bmp.width * scale); c.height = Math.round(bmp.height * scale);
  c.getContext("2d")!.drawImage(bmp, 0, 0, c.width, c.height);
  return canvasToJpeg(c);
}

async function renderPdfPages(file: File) {
  const pdfjs = await import("pdfjs-dist");
  const worker = await import("pdfjs-dist/build/pdf.worker.min.mjs?url");
  pdfjs.GlobalWorkerOptions.workerSrc = worker.default;
  const pdf = await pdfjs.getDocument({ data: await file.arrayBuffer() }).promise;
  const out: string[] = [];
  for (let i = 1; i <= Math.min(pdf.numPages, MAX_OCR_PAGES); i++) {
    const page = await pdf.getPage(i);
    const base = page.getViewport({ scale: 1 });
    const viewport = page.getViewport({ scale: Math.min(2, 1800 / Math.max(base.width, base.height)) });
    const c = document.createElement("canvas");
    c.width = viewport.width; c.height = viewport.height;
    await page.render({ canvas: c, canvasContext: c.getContext("2d")!, viewport }).promise;
    out.push(canvasToJpeg(c));
  }
  return { images: out, pages: pdf.numPages };
}

function DocumentsPage() {
  const qc = useQueryClient();
  const summarize = useServerFn(summarizeDocument);
  const ocr = useServerFn(ocrImages);

  async function ocrAll(images: string[], name: string) {
    let text = "";
    for (let i = 0; i < images.length; i += 4) {
      toast.message(`${name}: reading pages ${i + 1}–${Math.min(i + 4, images.length)} of ${images.length}…`);
      const r = await ocr({ data: { images: images.slice(i, i + 4) } });
      text += r.text + "\n\n";
    }
    return text;
  }
  const [drag, setDrag] = useState(false);
  const [busy, setBusy] = useState(false);
  const [summarizing, setSummarizing] = useState<string | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const { data: docs } = useQuery({
    queryKey: ["documents"],
    queryFn: async () => (await supabase.from("documents").select("id, name, file_type, page_count, chunk_count, status, summary, created_at").order("created_at", { ascending: false })).data ?? [],
  });

  async function handle(files: FileList | null) {
    if (!files?.length) return;
    setBusy(true);
    for (const file of Array.from(files)) {
      const isPdf = file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
      const isTxt = file.type === "text/plain" || file.name.toLowerCase().endsWith(".txt");
      const isImg = /^image\/(jpeg|png|webp)$/.test(file.type);
      if (!isPdf && !isTxt && !isImg) { toast.error(`${file.name}: supported files are PDF, TXT, JPG, PNG and WebP.`); continue; }
      if (file.size > 20 * 1024 * 1024) { toast.error(`${file.name}: max 20 MB.`); continue; }
      const { data: doc, error } = await supabase.from("documents").insert({ name: file.name, file_type: isPdf ? "PDF" : isImg ? "IMAGE" : "TXT" }).select("id").single();
      if (error || !doc) { toast.error("Upload failed."); continue; }
      try {
        let text = "";
        let pages: number | null = null;
        if (isImg) {
          text = await ocrAll([await imageFileToDataUrl(file)], file.name);
          pages = 1;
        } else if (isPdf) {
          ({ text, pages } = await extractPdf(file));
          if (text.replace(/\s/g, "").length < 50 * (pages ?? 1)) {
            const r = await renderPdfPages(file);
            if (r.pages > MAX_OCR_PAGES) toast.message(`${file.name}: scanned PDF — reading the first ${MAX_OCR_PAGES} pages.`);
            text = await ocrAll(r.images, file.name);
          }
        } else {
          text = await file.text();
        }
        const chunks = chunkText(text);
        if (!chunks.length) throw new Error("No readable text found in this file.");
        for (let i = 0; i < chunks.length; i += 200) {
          const { error: ce } = await supabase.from("document_chunks").insert(chunks.slice(i, i + 200).map((content, j) => ({ document_id: doc.id, idx: i + j, content })));
          if (ce) throw ce;
        }
        await supabase.from("documents").update({ content: text.slice(0, 500000), page_count: pages, chunk_count: chunks.length, status: "ready" }).eq("id", doc.id);
        toast.success(`${file.name} is ready.`);
      } catch (e) {
        await supabase.from("documents").update({ status: "failed" }).eq("id", doc.id);
        toast.error(`${file.name}: ${(e as Error).message}`);
      }
    }
    setBusy(false);
    qc.invalidateQueries({ queryKey: ["documents"] });
    qc.invalidateQueries({ queryKey: ["docs-ready"] });
  }

  async function doSummary(id: string) {
    setSummarizing(id);
    try {
      await summarize({ data: { documentId: id } });
      setOpenId(id);
      qc.invalidateQueries({ queryKey: ["documents"] });
    } catch (e) { toast.error((e as Error).message); }
    setSummarizing(null);
  }

  async function remove(id: string) {
    await supabase.from("documents").delete().eq("id", id);
    qc.invalidateQueries({ queryKey: ["documents"] });
  }

  return (
    <>
      <PageHeader title="My Documents" subtitle="Upload PDF, TXT or scanned page photos, then summarise them or ask the assistant about them." />
      <label
        onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
        onDragLeave={() => setDrag(false)}
        onDrop={(e) => { e.preventDefault(); setDrag(false); handle(e.dataTransfer.files); }}
        className={cn("flex cursor-pointer flex-col items-center justify-center rounded-3xl border-2 border-dashed p-12 text-center transition-colors", drag ? "border-cyan bg-cyan/5" : "border-border glass")}
      >
        {busy ? <Loader2 className="h-10 w-10 animate-spin text-cyan" /> : <Upload className="h-10 w-10 text-magenta" />}
        <p className="mt-4 font-semibold">{busy ? "Processing…" : "Drag & drop files here, or click to choose"}</p>
        <p className="text-sm text-muted-foreground">PDF, TXT, JPG, PNG, WebP · scanned pages are read with OCR · up to 20 MB</p>
        <input type="file" multiple accept=".pdf,.txt,.jpg,.jpeg,.png,.webp,application/pdf,text/plain,image/jpeg,image/png,image/webp" className="hidden" onChange={(e) => handle(e.target.files)} disabled={busy} />
      </label>

      <div className="mt-8 space-y-3">
        {docs?.map((d) => (
          <div key={d.id} className="rounded-2xl glass p-4">
            <div className="flex flex-wrap items-center gap-4">
              <FileText className="h-6 w-6 text-violet-soft" />
              <div className="min-w-0 flex-1">
                <div className="truncate font-medium">{d.name}</div>
                <div className="text-xs text-muted-foreground">
                  {d.file_type} · {new Date(d.created_at).toLocaleDateString()} · {d.page_count ? `${d.page_count} pages · ` : ""}{d.chunk_count} chunks ·{" "}
                  <span className={d.status === "ready" ? "text-success" : d.status === "failed" ? "text-destructive" : "text-cyan"}>{d.status}</span>
                </div>
              </div>
              {d.summary && <Button size="sm" variant="ghost" onClick={() => setOpenId(openId === d.id ? null : d.id)}>{openId === d.id ? "Hide summary" : "View summary"}</Button>}
              <Button size="sm" variant="glass" disabled={d.status !== "ready" || summarizing === d.id} onClick={() => doSummary(d.id)}>
                {summarizing === d.id ? <Loader2 className="animate-spin" /> : <Sparkles />} {d.summary ? "Re-summarise" : "Summarise"}
              </Button>
              <Button size="icon" variant="ghost" onClick={() => remove(d.id)} aria-label="Delete"><Trash2 /></Button>
            </div>
            {openId === d.id && d.summary && <div className="mt-4 border-t border-border pt-4"><Markdown>{d.summary}</Markdown></div>}
          </div>
        ))}
        {docs && !docs.length && <p className="text-center text-muted-foreground">No documents yet.</p>}
      </div>
    </>
  );
}
