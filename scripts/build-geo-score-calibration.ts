import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { calibrateGeoEvidence } from "../src/scoring/calibration.js";

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const sourcePath = path.join(
  repositoryRoot,
  "data",
  "evals",
  "llm-discovery-20-v1",
  "runs",
  "2026-08-20",
  "offer-comparisons.json",
);
const outputDirectory = path.join(repositoryRoot, "data", "models", "geo-score-v0.1");
const outputPath = path.join(outputDirectory, "calibration.json");

const source = JSON.parse(await readFile(sourcePath, "utf8")) as unknown;
const report = calibrateGeoEvidence(source);
await mkdir(outputDirectory, { recursive: true });
await writeFile(outputPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");

console.log(
  `Zapisano ${outputPath}: ${report.sample.observationsWithControls} obserwacji, ` +
    `${report.sample.matchedControlPairs} par kontrolnych.`,
);
