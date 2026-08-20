import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

type Result = {
  promptId: string;
  engine: "chatgpt" | "gemini";
  prompt: string;
  conversationUrl: string;
  completed: boolean;
  responseText: string;
  links: Array<{ text: string; href: string }>;
};

const runRoot = fileURLToPath(
  new URL("../data/evals/llm-discovery-20-v1/runs/2026-08-20/", import.meta.url),
);

function loadResults(engine: Result["engine"]): Result[] {
  return readdirSync(`${runRoot}/${engine}`)
    .filter((name) => /^DISC-\d{2}\.json$/u.test(name))
    .sort()
    .map((name) =>
      JSON.parse(readFileSync(`${runRoot}/${engine}/${name}`, "utf8")) as Result,
    );
}

describe("LLM discovery run 2026-08-20", () => {
  it.each(["chatgpt", "gemini"] as const)(
    "stores 20 complete, independent %s results",
    (engine) => {
      const results = loadResults(engine);

      expect(results).toHaveLength(20);
      expect(new Set(results.map((result) => result.promptId)).size).toBe(20);

      for (const result of results) {
        expect(result.engine).toBe(engine);
        expect(result.completed).toBe(true);
        expect(result.prompt.length).toBeGreaterThan(100);
        expect(result.responseText.length).toBeGreaterThan(100);
        expect(result.conversationUrl).toMatch(/^https:\/\/(chatgpt\.com|gemini\.google\.com)\//u);

        for (const link of result.links) {
          expect(link.href).toMatch(/^https:\/\//u);
        }
      }
    },
  );

  it("keeps negative results instead of fabricating direct Allegro offers", () => {
    const results = [...loadResults("chatgpt"), ...loadResults("gemini")];
    const withoutDirectOffer = results.filter(
      (result) =>
        !result.links.some((link) =>
          /^https:\/\/(?:www\.)?allegro\.pl\/oferta\//u.test(link.href),
        ),
    );

    expect(withoutDirectOffer).toHaveLength(4);
  });
});

