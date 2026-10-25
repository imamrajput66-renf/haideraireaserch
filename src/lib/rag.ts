/** Splits text into overlapping chunks of roughly `size` characters. */
export function chunkText(text: string, size = 1200, overlap = 150): string[] {
  const clean = text.replace(/\s+/g, " ").trim();
  if (!clean) return [];
  const chunks: string[] = [];
  let i = 0;
  while (i < clean.length) {
    chunks.push(clean.slice(i, i + size));
    if (i + size >= clean.length) break;
    i += size - overlap;
  }
  return chunks;
}

const STOP = new Set("the a an and or of to in is are was for on with what how why who this that it be by as at from".split(" "));

function terms(s: string) {
  return s.toLowerCase().split(/[^\p{L}\p{N}]+/u).filter((w) => w.length > 2 && !STOP.has(w));
}

/** Ranks chunks by keyword overlap with the query and returns the top `k`. */
export function rankChunks<T extends { content: string }>(query: string, chunks: T[], k = 6): T[] {
  const q = new Set(terms(query));
  if (q.size === 0) return chunks.slice(0, k);
  return chunks
    .map((c) => {
      const words = terms(c.content);
      let score = 0;
      for (const w of words) if (q.has(w)) score++;
      return { c, score: score / Math.sqrt(words.length + 1) };
    })
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, k)
    .map((x) => x.c);
}
