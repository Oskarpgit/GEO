import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

type PilotManifest = {
  requested: number;
  successful: number;
  targetOffersVisible: number;
  targetProductsVisible: number;
  allegroSurfacesVisible: number;
  protocol: { repetitionsPerProduct: number };
  engine: { surface: string; consumerAnswerCaptured: boolean };
  cases: Array<{ testId: string; offerId: string; productId: string }>;
};

const manifestPath = fileURLToPath(
  new URL("../data/evals/llm-visibility-pilot-v1/manifest.json", import.meta.url),
);
const manifest = JSON.parse(readFileSync(manifestPath, "utf8")) as PilotManifest;

describe("LLM visibility pilot", () => {
  it("records one successful retrieval attempt for each of 20 products", () => {
    expect(manifest.requested).toBe(20);
    expect(manifest.successful).toBe(20);
    expect(manifest.protocol.repetitionsPerProduct).toBe(1);
    expect(new Set(manifest.cases.map((item) => item.testId)).size).toBe(20);
    expect(new Set(manifest.cases.map((item) => item.offerId)).size).toBe(20);
    expect(new Set(manifest.cases.map((item) => item.productId)).size).toBe(20);
  });

  it("does not confuse domain or product discovery with target-offer visibility", () => {
    expect(manifest.allegroSurfacesVisible).toBeGreaterThan(manifest.targetProductsVisible);
    expect(manifest.targetProductsVisible).toBeGreaterThan(manifest.targetOffersVisible);
    expect(manifest.targetOffersVisible).toBe(0);
  });

  it("labels the pilot as retrieval rather than a consumer ChatGPT answer", () => {
    expect(manifest.engine.surface).toBe("llm_web_retrieval");
    expect(manifest.engine.consumerAnswerCaptured).toBe(false);
  });
});
