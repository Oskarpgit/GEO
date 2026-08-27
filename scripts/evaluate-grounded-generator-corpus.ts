import { readdir, readFile, writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { calculateGeoScore } from "../src/scoring/score.js";
import type { GeoOfferInput } from "../src/scoring/types.js";
import { extractProductClaims } from "../src/generation/claims.js";
import { generateReviewedOfferDescription } from "../src/workflows/offer-description.js";

type CorpusCase = {
  testId: string;
  category: string;
  source: { rawEvidenceSha256: string };
  observed: {
    title: string;
    parameters: Record<string, string>;
    imageCount: number;
  };
};

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const casesDirectory = path.join(
  repositoryRoot,
  "data",
  "evals",
  "allegro-diverse-20-v1",
  "cases",
);
const outputDirectory = path.join(
  repositoryRoot,
  "data",
  "evals",
  "grounded-generator-20-v1",
);
const outputPath = path.join(outputDirectory, "report.json");
const caseFiles = (await readdir(casesDirectory))
  .filter((file) => file.endsWith(".json"))
  .sort();

const results = [];
for (const file of caseFiles) {
  const corpusCase = JSON.parse(await readFile(path.join(casesDirectory, file), "utf8")) as CorpusCase;
  const input: GeoOfferInput = {
    source: {
      snapshotId: corpusCase.testId,
      evidenceIds: [`sha256:${corpusCase.source.rawEvidenceSha256}`],
    },
    title: corpusCase.observed.title,
    parameters: corpusCase.observed.parameters,
    images: Array.from({ length: corpusCase.observed.imageCount }, (_, index) => `image:${index + 1}`),
  };
  const claims = extractProductClaims(input);
  const decisions = Object.fromEntries(
    claims.map((claim) => [claim.claimId, "approved" as const]),
  );
  const workflow = generateReviewedOfferDescription(input, decisions);
  const identityClaims = {
    brand: claims.some((claim) => claim.kind === "brand"),
    model: claims.some((claim) => claim.kind === "model"),
    manufacturerCode: claims.some((claim) => claim.kind === "manufacturer_code"),
    gtin: claims.some((claim) => claim.kind === "gtin"),
  };
  if (workflow.status === "blocked") {
    results.push({
      testId: corpusCase.testId,
      category: corpusCase.category,
      status: "blocked",
      claimCount: claims.length,
      identityClaims,
      reasons: workflow.generation.reasons,
      omittedClaimCount: workflow.generation.omittedClaims.length,
    });
    continue;
  }
  const blocks = workflow.generation.candidate.sections.flatMap((section) => section.blocks);
  const candidateScore = calculateGeoScore({
    ...input,
    description: workflow.validation.renderedDescription,
    structure: {
      headings: workflow.generation.candidate.sections.length,
      paragraphs: blocks.filter((block) => block.type === "paragraph").length,
      listItems: blocks.filter((block) => block.type === "bullet").length,
      numericFacts: workflow.validation.renderedDescription.match(/\d/gu)?.length ?? 0,
      faqSignals: 0,
      inlineImages: 0,
    },
  });
  results.push({
    testId: corpusCase.testId,
    category: corpusCase.category,
    status: "generated",
    claimCount: claims.length,
    identityClaims,
    usedClaimCount: workflow.generation.usedClaimIds.length,
    omittedClaimCount: workflow.generation.omittedClaims.length,
    sectionCount: workflow.generation.candidate.sections.length,
    blockCount: blocks.length,
    provenanceValid: workflow.validation.provenanceValid,
    validationStatus: workflow.validation.status,
    readyForHumanReview: workflow.validation.readyForHumanReview,
    readyForUse: workflow.validation.readyForUse,
    failedRuleIds: workflow.validation.allegro.results
      .filter((result) => result.status === "failed")
      .map((result) => result.ruleId),
    needsReviewRuleIds: workflow.validation.allegro.results
      .filter((result) => result.status === "needs_review")
      .map((result) => result.ruleId),
    candidateGeoScore: candidateScore.score,
  });
}

const generated = results.filter((result) => result.status === "generated");
const blocked = results.filter((result) => result.status === "blocked");
const report = {
  schemaVersion: "1.0.0",
  evaluationId: "grounded-generator-20-v1",
  sourceCorpus: "allegro-diverse-20-v1",
  rawEvidenceCommitted: false,
  automatedClaimApprovalForEvaluationOnly: true,
  productionApprovalRequired: true,
  totals: {
    cases: results.length,
    generated: generated.length,
    blocked: blocked.length,
    provenanceValid: generated.filter((result) => result.provenanceValid).length,
    readyForHumanReview: generated.filter((result) => result.readyForHumanReview).length,
    readyForUse: generated.filter((result) => result.readyForUse).length,
  },
  results,
};

await mkdir(outputDirectory, { recursive: true });
await writeFile(outputPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
console.log(
  `Zapisano ${outputPath}: ${report.totals.generated} wygenerowanych, ` +
    `${report.totals.blocked} zablokowanych.`,
);
