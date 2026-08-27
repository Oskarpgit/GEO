import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { calibrateGeoEvidence } from "../src/scoring/calibration.js";

const datasetPath = fileURLToPath(
  new URL(
    "../data/evals/llm-discovery-20-v1/runs/2026-08-20/offer-comparisons.json",
    import.meta.url,
  ),
);

describe("calibrateGeoEvidence", () => {
  it("uses one paired row per observation and never fits weights", () => {
    const dataset = JSON.parse(readFileSync(datasetPath, "utf8")) as unknown;
    const report = calibrateGeoEvidence(dataset);

    expect(report.sample).toMatchObject({
      llmRuns: 40,
      observationsWithControls: 18,
      matchedControlPairs: 43,
    });
    expect(report.features).toHaveLength(10);
    expect(report.features.every((feature) => feature.observationCount === 18)).toBe(true);
    expect(report.weightsFittedFromThisSample).toBe(false);
    expect(report.causalClaimAllowed).toBe(false);
  });

  it("does not copy offer descriptions into the report", () => {
    const dataset = JSON.parse(readFileSync(datasetPath, "utf8")) as unknown;
    const serialized = JSON.stringify(calibrateGeoEvidence(dataset));

    expect(serialized).not.toContain("descriptionText");
    expect(serialized).not.toContain("sha256");
  });
});
