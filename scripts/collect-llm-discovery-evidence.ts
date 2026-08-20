import { createHash } from "node:crypto";
import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import * as cheerio from "cheerio";
import { matchProductIdentity } from "../src/identity/matcher.js";
import { parseAllegroOffer } from "../src/parser/allegro-offer.js";
import type { OfferSnapshot } from "../src/domain/types.js";

type Engine = "chatgpt" | "gemini";

type DiscoveryResult = {
  promptId: string;
  category: string;
  intent: string;
  engine: Engine;
  prompt: string;
  completed: boolean;
  links: Array<{ text: string; href: string }>;
};

type FirecrawlResponse = {
  success?: boolean;
  error?: string;
  data?: {
    html?: string;
    metadata?: {
      url?: string;
      sourceURL?: string;
      title?: string;
      statusCode?: number;
    };
  };
};

type DescriptionProfile = {
  sha256: string;
  characters: number;
  words: number;
  headings: string[];
  paragraphs: number;
  listItems: number;
  inlineImages: number;
  numericFacts: number;
  faqSignals: number;
};

type SafeOffer = {
  offerId: string;
  productId?: string;
  sourceUrl: string;
  title: string;
  brand?: string;
  model?: string;
  manufacturerCode?: string;
  gtin?: string;
  seller: OfferSnapshot["seller"];
  commerce: OfferSnapshot["commerce"];
  productGroup: OfferSnapshot["productGroup"];
  parameterCount: number;
  imageCount: number;
  description: DescriptionProfile;
  htmlSha256: string;
  capturedAt: string;
};

type ComparisonRecord = {
  promptId: string;
  engine: Engine;
  category: string;
  intent: string;
  prompt: string;
  status: "complete" | "partial" | "negative" | "failed";
  winner?: SafeOffer;
  controls: Array<
    SafeOffer & {
      identityMatch: ReturnType<typeof matchProductIdentity>;
    }
  >;
  rejectedCandidates: Array<{
    offerId: string;
    reason: string;
  }>;
  error?: string;
};

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repositoryRoot = path.resolve(scriptDir, "..");
const args = new Map(
  process.argv.slice(2).map((value) => {
    const [key, ...rest] = value.replace(/^--/u, "").split("=");
    return [key, rest.join("=")];
  }),
);
const runId = args.get("run") || "2026-08-20";
const keyFile = args.get("keys-file") || process.env.FIRECRAWL_KEYS_FILE;
const observationLimit = Number(args.get("limit") || "0");
const controlsTarget = Number(args.get("controls") || "4");
const candidatesLimit = Number(args.get("candidates") || "12");
const runRoot = path.join(
  repositoryRoot,
  "data",
  "evals",
  "llm-discovery-20-v1",
  "runs",
  runId,
);
const evidenceRoot = path.join(
  repositoryRoot,
  ".evidence",
  "llm-discovery-20-v1",
  runId,
);
const rawDir = path.join(evidenceRoot, "raw");
const searchDir = path.join(evidenceRoot, "search");
const safeOutputPath = path.join(runRoot, "offer-comparisons.json");

if (!keyFile) {
  throw new Error("Podaj --keys-file=... albo FIRECRAWL_KEYS_FILE.");
}

const keyText = await readFile(path.resolve(keyFile), "utf8");
const keys = [...new Set(keyText.match(/fc-[A-Za-z0-9_-]+/gu) ?? [])];
if (keys.length === 0) throw new Error("Nie znaleziono klucza Firecrawl.");
let keyIndex = 0;

await mkdir(rawDir, { recursive: true });
await mkdir(searchDir, { recursive: true });

function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function normalizeUrl(value: string): string {
  const url = new URL(value);
  url.hash = "";
  url.search = "";
  return url.toString().replace(/\/$/u, "");
}

function directOfferUrl(value: string): boolean {
  try {
    return /^https:\/\/(?:www\.)?allegro\.pl\/oferta\//u.test(normalizeUrl(value));
  } catch {
    return false;
  }
}

function offerIdFromUrl(value: string): string | undefined {
  return normalizeUrl(value).match(/-(\d{8,})$/u)?.[1] ?? value.match(/\/(\d{8,})$/u)?.[1];
}

function identity(snapshot: OfferSnapshot) {
  return {
    productId: snapshot.productId,
    gtin: snapshot.identity.gtin,
    brand: snapshot.identity.brand,
    model: snapshot.identity.model,
  };
}

function descriptionProfile(html: string, descriptionText: string): DescriptionProfile {
  const $ = cheerio.load(html);
  const heading = $("h2, h3")
    .filter((_, element) => $(element).text().replace(/\s+/gu, " ").trim() === "Opis")
    .first();
  const section = heading.closest("section");
  const scope = section.length > 0 ? section : heading.parent();
  const headings = scope
    .find("h1, h2, h3, h4")
    .toArray()
    .map((element) => $(element).text().replace(/\s+/gu, " ").trim())
    .filter((value) => value && value !== "Opis")
    .filter((value, index, all) => all.indexOf(value) === index)
    .slice(0, 30);
  const words = descriptionText.match(/[\p{L}\p{N}]+/gu) ?? [];
  const numericFacts = descriptionText.match(/\b\d+(?:[,.]\d+)?\s*(?:%|mm|cm|m|kg|g|l|ml|W|V|Hz|GB|TB|MP|h|min)?\b/giu) ?? [];
  const faqSignals = descriptionText.match(/(?:\?|FAQ|najczęściej zadawan)/giu) ?? [];

  return {
    sha256: sha256(descriptionText),
    characters: descriptionText.length,
    words: words.length,
    headings,
    paragraphs: scope.find("p").filter((_, element) => $(element).text().trim().length > 0).length,
    listItems: scope.find("li").filter((_, element) => $(element).text().trim().length > 0).length,
    inlineImages: scope.find("img").length,
    numericFacts: numericFacts.length,
    faqSignals: faqSignals.length,
  };
}

function safeOffer(snapshot: OfferSnapshot, html: string): SafeOffer {
  return {
    offerId: snapshot.offerId,
    ...(snapshot.productId ? { productId: snapshot.productId } : {}),
    sourceUrl: snapshot.sourceUrl,
    title: snapshot.identity.title,
    ...(snapshot.identity.brand ? { brand: snapshot.identity.brand } : {}),
    ...(snapshot.identity.model ? { model: snapshot.identity.model } : {}),
    ...(snapshot.identity.manufacturerCode
      ? { manufacturerCode: snapshot.identity.manufacturerCode }
      : {}),
    ...(snapshot.identity.gtin ? { gtin: snapshot.identity.gtin } : {}),
    seller: snapshot.seller,
    commerce: snapshot.commerce,
    productGroup: snapshot.productGroup,
    parameterCount: Object.keys(snapshot.content.parameters).length,
    imageCount: snapshot.content.imageUrls.length,
    description: descriptionProfile(html, snapshot.content.descriptionText),
    htmlSha256: sha256(html),
    capturedAt: snapshot.capturedAt,
  };
}

async function scrape(url: string, offerId: string): Promise<FirecrawlResponse> {
  const rawPath = path.join(rawDir, `${offerId}.json`);
  try {
    return JSON.parse(await readFile(rawPath, "utf8")) as FirecrawlResponse;
  } catch {
    // Cache miss: request the page below.
  }

  let lastError = "Nieznany błąd Firecrawl.";
  for (let attempt = 0; attempt < keys.length + 2; attempt += 1) {
    const key = keys[keyIndex % keys.length]!;
    const response = await fetch("https://api.firecrawl.dev/v2/scrape", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        url,
        formats: ["html"],
        onlyMainContent: false,
      }),
    });
    const text = await response.text();
    let payload: FirecrawlResponse;
    try {
      payload = JSON.parse(text) as FirecrawlResponse;
    } catch {
      payload = { success: false, error: text.slice(0, 500) };
    }

    if (response.ok && payload.success && payload.data?.html) {
      await writeFile(rawPath, `${JSON.stringify(payload)}\n`, "utf8");
      return payload;
    }

    lastError = `HTTP ${response.status}: ${payload.error ?? "brak HTML"}`;
    if ([401, 402, 429].includes(response.status)) keyIndex = (keyIndex + 1) % keys.length;
    if (response.status >= 500 || response.status === 429) {
      await new Promise((resolve) => setTimeout(resolve, 1000 * (attempt + 1)));
      continue;
    }
    break;
  }

  throw new Error(lastError);
}

async function searchOffers(winner: OfferSnapshot): Promise<string[]> {
  const searchPath = path.join(searchDir, `${winner.offerId}.json`);
  try {
    const cached = JSON.parse(await readFile(searchPath, "utf8")) as {
      urls?: string[];
    };
    if (cached.urls) return cached.urls;
  } catch {
    // Cache miss: search below.
  }

  const title = winner.identity.title.replace(/["\\]/gu, " ").replace(/\s+/gu, " ").trim();
  const query = `site:allegro.pl/oferta "${title.slice(0, 380)}"`;
  let lastError = "Nieznany błąd wyszukiwania Firecrawl.";

  for (let attempt = 0; attempt < keys.length + 2; attempt += 1) {
    const key = keys[keyIndex % keys.length]!;
    const response = await fetch("https://api.firecrawl.dev/v2/search", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        query,
        limit: 10,
        sources: ["web"],
        includeDomains: ["allegro.pl"],
        country: "PL",
        location: "Poland",
        ignoreInvalidURLs: true,
      }),
    });
    const text = await response.text();
    let payload: {
      success?: boolean;
      error?: string;
      data?: { web?: Array<{ url?: string }> };
    };
    try {
      payload = JSON.parse(text) as typeof payload;
    } catch {
      payload = { success: false, error: text.slice(0, 500) };
    }

    if (response.ok && payload.success) {
      const urls = [
        ...new Set(
          (payload.data?.web ?? [])
            .map((item) => item.url)
            .filter((value): value is string => Boolean(value && directOfferUrl(value)))
            .map(normalizeUrl),
        ),
      ];
      await writeFile(
        searchPath,
        `${JSON.stringify({ query, capturedAt: new Date().toISOString(), urls }, null, 2)}\n`,
        "utf8",
      );
      return urls;
    }

    lastError = `HTTP ${response.status}: ${payload.error ?? "brak wyników"}`;
    if ([401, 402, 429].includes(response.status)) keyIndex = (keyIndex + 1) % keys.length;
    if (response.status >= 500 || response.status === 429) {
      await new Promise((resolve) => setTimeout(resolve, 1000 * (attempt + 1)));
      continue;
    }
    break;
  }

  throw new Error(lastError);
}

function isActiveOffer(html: string): boolean {
  const normalized = cheerio.load(html).text().replace(/\s+/gu, " ");
  return !/szukana oferta jest nieaktualna/iu.test(normalized);
}

function candidateOfferIds(html: string, winnerId: string): string[] {
  const embedded = [...html.matchAll(/(?:offerId|offer_id)[^0-9]{0,24}(\d{8,})/giu)].map(
    (match) => match[1]!,
  );
  const hrefs = [...html.matchAll(/https:\/\/allegro\.pl\/oferta\/[^"'<>\s]+/giu)]
    .map((match) => offerIdFromUrl(match[0]))
    .filter((value): value is string => Boolean(value));
  return [...new Set([...embedded, ...hrefs])].filter((value) => value !== winnerId);
}

async function loadDiscoveryResults(): Promise<DiscoveryResult[]> {
  const results: DiscoveryResult[] = [];
  for (const engine of ["chatgpt", "gemini"] as const) {
    const dir = path.join(runRoot, engine);
    const names = (await readdir(dir))
      .filter((name) => /^DISC-\d{2}\.json$/u.test(name))
      .sort();
    for (const name of names) {
      results.push(JSON.parse(await readFile(path.join(dir, name), "utf8")) as DiscoveryResult);
    }
  }
  return results;
}

const discoveryResults = await loadDiscoveryResults();
const selected = (observationLimit > 0 ? discoveryResults.slice(0, observationLimit) : discoveryResults);
const comparisons: ComparisonRecord[] = [];

for (const [index, result] of selected.entries()) {
  const winnerUrls = [
    ...new Set(
      result.links
        .map((link) => link.href)
        .filter(directOfferUrl)
        .map(normalizeUrl),
    ),
  ];
  if (winnerUrls.length === 0) {
    comparisons.push({
      promptId: result.promptId,
      engine: result.engine,
      category: result.category,
      intent: result.intent,
      prompt: result.prompt,
      status: "negative",
      controls: [],
      rejectedCandidates: [],
    });
    console.log(`[${index + 1}/${selected.length}] ${result.engine} ${result.promptId}: negative`);
    continue;
  }

  try {
    let selectedWinner:
      | { url: string; offerId: string; raw: FirecrawlResponse; html: string }
      | undefined;
    const rejectedCandidates: ComparisonRecord["rejectedCandidates"] = [];

    for (const candidateWinnerUrl of winnerUrls) {
      const candidateWinnerId = offerIdFromUrl(candidateWinnerUrl);
      if (!candidateWinnerId) continue;
      const candidateWinnerRaw = await scrape(candidateWinnerUrl, candidateWinnerId);
      const candidateWinnerHtml = candidateWinnerRaw.data!.html!;
      if (isActiveOffer(candidateWinnerHtml)) {
        selectedWinner = {
          url: candidateWinnerUrl,
          offerId: candidateWinnerId,
          raw: candidateWinnerRaw,
          html: candidateWinnerHtml,
        };
        break;
      }
      rejectedCandidates.push({
        offerId: candidateWinnerId,
        reason: "Oferta wskazana przez LLM jest nieaktywna.",
      });
    }

    if (!selectedWinner) {
      comparisons.push({
        promptId: result.promptId,
        engine: result.engine,
        category: result.category,
        intent: result.intent,
        prompt: result.prompt,
        status: "negative",
        controls: [],
        rejectedCandidates,
        error: "Brak aktywnej bezpośredniej oferty w odpowiedzi LLM.",
      });
      continue;
    }

    const winnerRaw = selectedWinner.raw;
    const winnerHtml = selectedWinner.html;
    const capturedAt = new Date().toISOString();
    const winnerSnapshot = parseAllegroOffer({
      url: winnerRaw.data?.metadata?.url ?? selectedWinner.url,
      html: winnerHtml,
      capturedAt,
    });
    const controls: ComparisonRecord["controls"] = [];
    const searchedUrls = await searchOffers(winnerSnapshot);
    const embeddedUrls = candidateOfferIds(winnerHtml, winnerSnapshot.offerId).map(
      (offerId) => `https://allegro.pl/oferta/${offerId}`,
    );
    const candidates = [...new Set([...searchedUrls, ...embeddedUrls])]
      .filter((url) => offerIdFromUrl(url) !== winnerSnapshot.offerId)
      .slice(0, candidatesLimit);

    for (const candidateUrl of candidates) {
      if (controls.length >= controlsTarget) break;
      const candidateId = offerIdFromUrl(candidateUrl);
      if (!candidateId) continue;
      try {
        const candidateRaw = await scrape(candidateUrl, candidateId);
        const candidateHtml = candidateRaw.data!.html!;
        if (!isActiveOffer(candidateHtml)) {
          rejectedCandidates.push({ offerId: candidateId, reason: "Oferta kontrolna jest nieaktywna." });
          continue;
        }
        const candidateSnapshot = parseAllegroOffer({
          url: candidateRaw.data?.metadata?.url ?? `https://allegro.pl/oferta/${candidateId}`,
          html: candidateHtml,
          capturedAt: new Date().toISOString(),
        });
        const identityMatch = matchProductIdentity(
          identity(winnerSnapshot),
          identity(candidateSnapshot),
        );
        if (identityMatch.result === "matched") {
          controls.push({
            ...safeOffer(candidateSnapshot, candidateHtml),
            identityMatch,
          });
        } else {
          rejectedCandidates.push({
            offerId: candidateId,
            reason: `${identityMatch.result}: ${identityMatch.reasons.join(" ")}`,
          });
        }
      } catch (error) {
        rejectedCandidates.push({
          offerId: candidateId,
          reason: error instanceof Error ? error.message : String(error),
        });
      }
    }

    comparisons.push({
      promptId: result.promptId,
      engine: result.engine,
      category: result.category,
      intent: result.intent,
      prompt: result.prompt,
      status: controls.length >= 3 ? "complete" : "partial",
      winner: safeOffer(winnerSnapshot, winnerHtml),
      controls,
      rejectedCandidates,
    });
    console.log(
      `[${index + 1}/${selected.length}] ${result.engine} ${result.promptId}: ${controls.length} controls`,
    );
  } catch (error) {
    comparisons.push({
      promptId: result.promptId,
      engine: result.engine,
      category: result.category,
      intent: result.intent,
      prompt: result.prompt,
      status: "failed",
      controls: [],
      rejectedCandidates: [],
      error: error instanceof Error ? error.message : String(error),
    });
    console.log(`[${index + 1}/${selected.length}] ${result.engine} ${result.promptId}: failed`);
  }

  await writeFile(
    safeOutputPath,
    `${JSON.stringify(
      {
        schemaVersion: "1.0.0",
        runId,
        updatedAt: new Date().toISOString(),
        rawEvidenceCommitted: false,
        requestedControlsPerWinner: controlsTarget,
        observations: comparisons,
      },
      null,
      2,
    )}\n`,
    "utf8",
  );
}

const totals = {
  observations: comparisons.length,
  complete: comparisons.filter((item) => item.status === "complete").length,
  partial: comparisons.filter((item) => item.status === "partial").length,
  negative: comparisons.filter((item) => item.status === "negative").length,
  failed: comparisons.filter((item) => item.status === "failed").length,
  controls: comparisons.reduce((sum, item) => sum + item.controls.length, 0),
};

await writeFile(
  safeOutputPath,
  `${JSON.stringify(
    {
      schemaVersion: "1.0.0",
      runId,
      updatedAt: new Date().toISOString(),
      rawEvidenceCommitted: false,
      requestedControlsPerWinner: controlsTarget,
      totals,
      observations: comparisons,
    },
    null,
    2,
  )}\n`,
  "utf8",
);

console.log(JSON.stringify(totals, null, 2));
