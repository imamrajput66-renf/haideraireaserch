import { describe, it, expect } from "vitest";
import { isDeveloperAuthorized } from "@/lib/dev-access";
import { chunkText, rankChunks } from "@/lib/rag";

describe("developer access", () => {
  it("allows the developer role with the right code", () => {
    expect(isDeveloperAuthorized(true, "01572", "01572")).toBe(true);
  });
  it("rejects a wrong code even with the developer role", () => {
    expect(isDeveloperAuthorized(true, "01573", "01572")).toBe(false);
  });
  it("rejects the right code without the developer role", () => {
    expect(isDeveloperAuthorized(false, "01572", "01572")).toBe(false);
  });
});

describe("document chunks", () => {
  it("splits long text into multiple chunks", () => {
    expect(chunkText("word ".repeat(1000), 1200, 150).length).toBe(5);
  });
  it("ranks the matching chunk first", () => {
    const r = rankChunks("photosynthesis chlorophyll", [{ content: "history of rome" }, { content: "photosynthesis uses chlorophyll" }]);
    expect(r[0]!.content).toBe("photosynthesis uses chlorophyll");
  });
});
