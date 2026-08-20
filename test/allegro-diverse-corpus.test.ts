import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

type ManifestCase = {
  testId: string;
  category: string;
  extractionPassed: boolean;
  geoInputComplete: boolean;
  offerId?: string;
  productId?: string;
};

type Manifest = {
  requested: number;
  extracted: number;
  extractionFailed: number;
  geoInputComplete: number;
  geoInputIncomplete: number;
  categories: string[];
  cases: ManifestCase[];
};

const manifestPath = fileURLToPath(
  new URL("../data/evals/allegro-diverse-20-v1/manifest.json", import.meta.url),
);
const manifest = JSON.parse(readFileSync(manifestPath, "utf8")) as Manifest;

describe("Allegro Diverse 20 corpus", () => {
  it("stores 20 unique, successfully extracted offers across diverse categories", () => {
    expect(manifest.requested).toBe(20);
    expect(manifest.extracted).toBe(20);
    expect(manifest.extractionFailed).toBe(0);
    expect(manifest.categories.length).toBeGreaterThanOrEqual(10);
    expect(new Set(manifest.cases.map((item) => item.testId)).size).toBe(20);
    expect(new Set(manifest.cases.map((item) => item.offerId)).size).toBe(20);
    expect(new Set(manifest.cases.map((item) => item.productId)).size).toBe(20);
  });

  it("keeps the missing GoPro description as an explicit negative GEO sample", () => {
    expect(manifest.geoInputComplete).toBe(19);
    expect(manifest.geoInputIncomplete).toBe(1);
    expect(manifest.cases.filter((item) => !item.geoInputComplete).map((item) => item.testId)).toEqual([
      "P20-camera-gopro-hero13-black",
    ]);
  });

  it("does not commit raw competitor evidence or full descriptions", () => {
    for (const item of manifest.cases) {
      const casePath = fileURLToPath(
        new URL(`../data/evals/allegro-diverse-20-v1/cases/${item.testId}.json`, import.meta.url),
      );
      const evalCase = JSON.parse(readFileSync(casePath, "utf8")) as Record<string, unknown>;
      const serialized = JSON.stringify(evalCase);
      expect(serialized).toContain('"rawEvidenceCommitted":false');
      expect(serialized).not.toContain('"descriptionText"');
      expect(serialized).not.toContain('"html"');
    }
  });
});
