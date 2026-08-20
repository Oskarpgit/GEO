import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

type Promptset = {
  engines: string[];
  conversationPolicy: string;
  prompts: Array<{ promptId: string; category: string; text: string }>;
};

const promptsetPath = fileURLToPath(
  new URL("../data/evals/llm-discovery-20-v1/prompts.json", import.meta.url),
);
const promptset = JSON.parse(readFileSync(promptsetPath, "utf8")) as Promptset;

describe("LLM discovery promptset", () => {
  it("uses the same 20 discovery prompts for ChatGPT and Gemini", () => {
    expect(promptset.engines).toEqual(["chatgpt", "gemini"]);
    expect(promptset.prompts).toHaveLength(20);
    expect(new Set(promptset.prompts.map((item) => item.promptId)).size).toBe(20);
    expect(new Set(promptset.prompts.map((item) => item.category)).size).toBeGreaterThanOrEqual(10);
  });

  it("does not leak expected offer ids or preselect a winner", () => {
    for (const prompt of promptset.prompts) {
      expect(prompt.text).not.toMatch(/\b\d{8,}\b/u);
      expect(prompt.text).toContain("bezpośrednich linków do konkretnych ofert sprzedawców");
    }
  });

  it("requires independent conversations to limit cross-test contamination", () => {
    expect(promptset.conversationPolicy).toBe("fresh_conversation_per_prompt");
  });
});
