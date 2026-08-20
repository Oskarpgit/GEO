import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import * as cheerio from "cheerio";
import { parseAllegroOffer } from "../src/parser/allegro-offer.js";
import { allegroPlRuleset } from "../src/rules/allegro-rules.js";
import { isValidGtin, validateAllegroOffer } from "../src/rules/engine.js";

type RunResult = {
  testId: string;
  category: string;
  expectedTitle: string;
  url: string;
  success: boolean;
};

type RunSummary = {
  runId: string;
  createdAt: string;
  results: RunResult[];
};

type Assertion = {
  id: string;
  kind: "parser_integrity" | "geo_input" | "quality_signal";
  status: "passed" | "failed" | "not_evaluated";
  expected?: unknown;
  observed?: unknown;
};

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repositoryRoot = path.resolve(scriptDir, "..");
const inputDir = path.resolve(
  process.argv[2] ?? path.join(repositoryRoot, "..", "..", "firecrawl-20"),
);
const outputDir = path.join(repositoryRoot, "data", "evals", "allegro-diverse-20-v1");
const casesDir = path.join(outputDir, "cases");
const runSummary = JSON.parse(
  await readFile(path.join(inputDir, "run-summary.json"), "utf8"),
) as RunSummary;

function normalizedTokens(value: string): string[] {
  return (
    value
      .normalize("NFKD")
      .replace(/\p{Diacritic}/gu, "")
      .toLocaleLowerCase("pl-PL")
      .match(/[\p{L}\p{N}]+/gu) ?? []
  ).filter((token) => token.length > 1);
}

function titleCoverage(expected: string, observed: string): number {
  const expectedTokens = new Set(normalizedTokens(expected));
  const observedTokens = new Set(normalizedTokens(observed));
  if (expectedTokens.size === 0) return 0;
  const covered = [...expectedTokens].filter((token) => observedTokens.has(token)).length;
  return covered / expectedTokens.size;
}

function extractOfferId(url: string): string | undefined {
  const parsed = new URL(url);
  return parsed.searchParams.get("offerId") ?? undefined;
}

function extractProductId(url: string): string | undefined {
  return url.match(/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/iu)?.[1];
}

function descriptionStructure(html: string): {
  headings: string[];
  paragraphs: number;
  listItems: number;
  inlineImages: number;
} {
  const $ = cheerio.load(html);
  const heading = $("h2, h3")
    .filter((_, element) => $(element).text().replace(/\s+/g, " ").trim() === "Opis")
    .first();
  const section = heading.closest("section");
  if (heading.length === 0 || section.length === 0) {
    return { headings: [], paragraphs: 0, listItems: 0, inlineImages: 0 };
  }

  const headings = section
    .find("h1, h2, h3, h4")
    .toArray()
    .map((element) => $(element).text().replace(/\s+/g, " ").trim())
    .filter((value) => value && value !== "Opis")
    .filter((value, index, all) => all.indexOf(value) === index)
    .slice(0, 20);

  return {
    headings,
    paragraphs: section.find("p").filter((_, element) => $(element).text().trim().length > 0).length,
    listItems: section.find("li").filter((_, element) => $(element).text().trim().length > 0).length,
    inlineImages: section.find("img").length,
  };
}

function assertion(
  id: string,
  kind: Assertion["kind"],
  condition: boolean | undefined,
  expected?: unknown,
  observed?: unknown,
): Assertion {
  return {
    id,
    kind,
    status: condition === undefined ? "not_evaluated" : condition ? "passed" : "failed",
    ...(expected === undefined ? {} : { expected }),
    ...(observed === undefined ? {} : { observed }),
  };
}

await mkdir(casesDir, { recursive: true });

const manifestCases: Array<Record<string, unknown>> = [];

for (const item of runSummary.results) {
  const rawPath = path.join(inputDir, "raw", `${item.testId}.json`);
  const raw = await readFile(rawPath, "utf8");
  const rawHash = createHash("sha256").update(raw).digest("hex");
  const firecrawl = JSON.parse(raw) as {
    data?: {
      html?: string;
      markdown?: string;
      metadata?: { url?: string; title?: string; statusCode?: number };
    };
  };
  const html = firecrawl.data?.html ?? "";
  const sourceUrl = firecrawl.data?.metadata?.url ?? item.url;

  try {
    const snapshot = parseAllegroOffer({
      url: sourceUrl,
      html,
      capturedAt: runSummary.createdAt,
    });
    const validation = validateAllegroOffer(
      {
        offer: {
          title: snapshot.identity.title,
          description: snapshot.content.descriptionText,
          parameters: {
            brand: snapshot.identity.brand,
            manufacturerCode: snapshot.identity.manufacturerCode,
            model: snapshot.identity.model,
            gtin: snapshot.identity.gtin,
          },
          images: snapshot.content.imageUrls,
        },
      },
      allegroPlRuleset,
    );
    const expectedOfferId = extractOfferId(item.url);
    const expectedProductId = extractProductId(item.url);
    const coverage = titleCoverage(item.expectedTitle, snapshot.identity.title);
    const gtinStatus = snapshot.identity.gtin
      ? isValidGtin(snapshot.identity.gtin)
      : undefined;
    const descriptionProfile = descriptionStructure(html);
    const assertions: Assertion[] = [
      assertion("offer_id", "parser_integrity", snapshot.offerId === expectedOfferId, expectedOfferId, snapshot.offerId),
      assertion(
        "product_id",
        "parser_integrity",
        snapshot.productId?.toLocaleLowerCase("en-US") === expectedProductId?.toLocaleLowerCase("en-US"),
        expectedProductId,
        snapshot.productId,
      ),
      assertion("title_coverage", "parser_integrity", coverage >= 0.35, ">=0.35", Number(coverage.toFixed(3))),
      assertion("description_present", "geo_input", snapshot.content.descriptionText.length >= 80, ">=80", snapshot.content.descriptionText.length),
      assertion("parameters_present", "geo_input", Object.keys(snapshot.content.parameters).length >= 4, ">=4", Object.keys(snapshot.content.parameters).length),
      assertion("product_images_present", "geo_input", snapshot.content.imageUrls.length >= 1, ">=1", snapshot.content.imageUrls.length),
      assertion("gtin_checksum", "quality_signal", gtinStatus, true, snapshot.identity.gtin),
    ];
    const failedExtraction = assertions.filter(
      (entry) => entry.kind === "parser_integrity" && entry.status === "failed",
    );
    const failedGeoInput = assertions.filter(
      (entry) => entry.kind === "geo_input" && entry.status === "failed",
    );

    const evalCase = {
      schemaVersion: "1.1.0",
      testId: item.testId,
      category: item.category,
      source: {
        url: item.url,
        capturedAt: runSummary.createdAt,
        rawEvidenceSha256: rawHash,
        rawEvidenceBytes: Buffer.byteLength(raw),
        rawEvidenceCommitted: false,
        firecrawlStatusCode: firecrawl.data?.metadata?.statusCode,
      },
      expected: {
        title: item.expectedTitle,
        offerId: expectedOfferId,
        productId: expectedProductId,
      },
      observed: {
        offerId: snapshot.offerId,
        productId: snapshot.productId,
        title: snapshot.identity.title,
        brand: snapshot.identity.brand,
        model: snapshot.identity.model,
        manufacturerCode: snapshot.identity.manufacturerCode,
        gtin: snapshot.identity.gtin,
        categoryPath: snapshot.identity.categoryPath,
        seller: snapshot.seller,
        commerce: snapshot.commerce,
        productGroup: snapshot.productGroup,
        parameters: snapshot.content.parameters,
        imageCount: snapshot.content.imageUrls.length,
        descriptionProfile: {
          characters: snapshot.content.descriptionText.length,
          words: normalizedTokens(snapshot.content.descriptionText).length,
          sha256: createHash("sha256").update(snapshot.content.descriptionText).digest("hex"),
          ...descriptionProfile,
        },
      },
      validation: {
        rulesetId: validation.rulesetId,
        validatorVersion: validation.validatorVersion,
        readyForGeneration: validation.readyForGeneration,
        totals: validation.totals,
        failedRuleIds: validation.results
          .filter((result) => result.status === "failed")
          .map((result) => result.ruleId),
        needsReviewRuleIds: validation.results
          .filter((result) => result.status === "needs_review")
          .map((result) => result.ruleId),
        notEvaluatedRuleIds: validation.results
          .filter((result) => result.status === "not_evaluated")
          .map((result) => result.ruleId),
      },
      assertions,
      extractionPassed: failedExtraction.length === 0,
      geoInputComplete: failedGeoInput.length === 0,
    };

    await writeFile(
      path.join(casesDir, `${item.testId}.json`),
      `${JSON.stringify(evalCase, null, 2)}\n`,
      "utf8",
    );
    manifestCases.push({
      testId: item.testId,
      category: item.category,
      extractionPassed: evalCase.extractionPassed,
      geoInputComplete: evalCase.geoInputComplete,
      failedExtractionAssertions: failedExtraction.map((entry) => entry.id),
      failedGeoInputAssertions: failedGeoInput.map((entry) => entry.id),
      offerId: snapshot.offerId,
      productId: snapshot.productId,
      gtinPresent: Boolean(snapshot.identity.gtin),
      parameterCount: Object.keys(snapshot.content.parameters).length,
      descriptionCharacters: snapshot.content.descriptionText.length,
      imageCount: snapshot.content.imageUrls.length,
      validationTotals: validation.totals,
    });
  } catch (error) {
    manifestCases.push({
      testId: item.testId,
      category: item.category,
      extractionPassed: false,
      geoInputComplete: false,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

const extracted = manifestCases.filter((item) => item.extractionPassed === true).length;
const geoInputComplete = manifestCases.filter((item) => item.geoInputComplete === true).length;
const descriptionsPresent = manifestCases.filter(
  (item) => typeof item.descriptionCharacters === "number" && item.descriptionCharacters >= 80,
).length;
const gtinPresent = manifestCases.filter((item) => item.gtinPresent === true).length;
const report = {
  corpusId: "allegro-diverse-20-v1",
  createdAt: runSummary.createdAt,
  sourceRunId: runSummary.runId,
  rulesetId: allegroPlRuleset.rulesetId,
  rawEvidencePolicy:
    "Raw Firecrawl HTML and competitor descriptions remain outside Git. The repository stores hashes, normalized facts, description profiles, rule results and assertions.",
  requested: manifestCases.length,
  extracted,
  extractionFailed: manifestCases.length - extracted,
  geoInputComplete,
  geoInputIncomplete: manifestCases.length - geoInputComplete,
  categories: [...new Set(runSummary.results.map((item) => item.category))],
  learningSignals: {
    descriptionsPresent,
    descriptionsMissing: manifestCases.length - descriptionsPresent,
    gtinPresent,
    gtinMissing: manifestCases.length - gtinPresent,
  },
  cases: manifestCases,
};

await writeFile(path.join(outputDir, "manifest.json"), `${JSON.stringify(report, null, 2)}\n`, "utf8");

const markdownReport = [
  "# Raport korpusu Allegro Diverse 20 v1",
  "",
  `- Data: ${runSummary.createdAt}`,
  `- Przypadki: ${report.requested}`,
  `- Ekstrakcja techniczna: ${report.extracted}/${report.requested}`,
  `- Kompletne wejście GEO: ${report.geoInputComplete}/${report.requested}`,
  `- Próbki negatywne (brak kompletnego wejścia): ${report.geoInputIncomplete}`,
  `- Kategorie: ${report.categories.length}`,
  `- Ruleset: \`${report.rulesetId}\``,
  "",
  "| Test | Kategoria | Ekstrakcja | GTIN | Parametry | Opis | Zdjęcia |",
  "|---|---|---:|---:|---:|---:|---:|",
  ...manifestCases.map(
    (item) =>
      `| ${item.testId} | ${item.category} | ${item.extractionPassed ? "OK" : "BŁĄD"}${item.geoInputComplete ? "" : " / brak wejścia GEO"} | ${item.gtinPresent ? "tak" : "nie"} | ${item.parameterCount ?? "-"} | ${item.descriptionCharacters ?? "-"} | ${item.imageCount ?? "-"} |`,
  ),
  "",
  "Pełne opisy i HTML nie są przechowywane w repozytorium. Każdy przypadek zawiera hash surowego dowodu, znormalizowane fakty, profil opisu, wyniki reguł i asercje parsera.",
  "",
].join("\n");

await writeFile(path.join(outputDir, "REPORT.md"), markdownReport, "utf8");
console.log(JSON.stringify({
  outputDir,
  requested: report.requested,
  extracted: report.extracted,
  extractionFailed: report.extractionFailed,
  geoInputComplete: report.geoInputComplete,
  geoInputIncomplete: report.geoInputIncomplete,
}, null, 2));

if (report.extractionFailed > 0) process.exitCode = 2;
