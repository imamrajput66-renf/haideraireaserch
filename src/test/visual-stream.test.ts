import { afterEach, describe, expect, it, vi } from "vitest";
import { streamImage } from "@/lib/visuals/stream-image";
afterEach(() => vi.unstubAllGlobals());
function response(parts: string[]) { return new Response(new ReadableStream({ start(c) { for (const p of parts) c.enqueue(new TextEncoder().encode(p)); c.close(); } }), { headers: { "Content-Type": "text/event-stream" } }); }
describe("Image stream failures", () => {
  it("reads fragmented frames and a final result", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(response(['event: image_generation.partial_image\ndata: {"b64_', 'json":"preview"}\n\n', 'event: image_generation.completed\ndata: {"b64_json":"final"}\n\n'])));
    const frames: boolean[] = []; await streamImage("/api/visual-image", { id: "test" }, (_, done) => frames.push(done)); expect(frames).toEqual([false, true]);
  });
  it("does not retry a provider denial inside a 200 stream", async () => {
    const send = vi.fn().mockResolvedValue(response(['event: error\ndata: {"error":{"message":"Provider access denied","type":"permission_error"}}\n\n'])); vi.stubGlobal("fetch", send);
    await expect(streamImage("/api/visual-image", {}, () => {})).rejects.toThrow("Provider access denied"); expect(send).toHaveBeenCalledTimes(1);
  });
  it("fails partial-only output without replay", async () => {
    const send = vi.fn().mockResolvedValue(response(['event: image_generation.partial_image\ndata: {"b64_json":"preview"}\n\n'])); vi.stubGlobal("fetch", send);
    await expect(streamImage("/api/visual-image", {}, () => {})).rejects.toThrow("without a completed event"); expect(send).toHaveBeenCalledTimes(1);
  });
  it("does not retry HTTP usage limits", async () => {
    const send = vi.fn().mockResolvedValue(new Response('Daily visual limit reached', { status: 429 })); vi.stubGlobal("fetch", send);
    await expect(streamImage("/api/visual-image", {}, () => {})).rejects.toThrow("429"); expect(send).toHaveBeenCalledTimes(1);
  });
});