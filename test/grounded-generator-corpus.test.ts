import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const reportPath = fileURLToPath(
  new URL("../data/evals/grounded-generator-20-v1/report.json", import.meta.url),
);

describe("grounded generator diverse corpus", () => {
  it("keeps all 20 cases and records safe evaluation boundaries", () => {
    const report = JSON.parse(readFileSync(reportPath, "utf8")) as {
      rawEvidenceCommitted: boolean;
      automatedClaimApprovalForEvaluationOnly: boolean;
      productionApprovalRequired: boolean;
      totals: { cases: number; generated: number; blocked: number };
      results: unknown[];
    };

    expect(report.totals.cases).toBe(20);
    expect(report.totals.generated + report.totals.blocked).toBe(20);
    expect(report.results).toHaveLength(20);
    expect(report.rawEvidenceCommitted).toBe(false);
    expect(report.automatedClaimApprovalForEvaluationOnly).toBe(true);
    expect(report.productionApprovalRequired).toBe(true);
  });

  it("does not persist descriptions, candidates or parameter values", () => {
    const serialized = readFileSync(reportPath, "utf8");

    expect(serialized).not.toContain("renderedDescription");
    expect(serialized).not.toContain('"candidate"');
    expect(serialized).not.toContain('"parameters"');
  });
});
