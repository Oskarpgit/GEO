import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { Appearance, MeasurementAttempt } from "../src/domain/types.js";
import { calculateOfferVisibility } from "../src/measurement/metrics.js";

type CorpusCase = {
  testId: string;
  category: string;
  offerId: string;
  productId: string;
};

type CorpusManifest = {
  corpusId: string;
  cases: CorpusCase[];
};

type Observation = {
  query: string;
  appearances: Appearance[];
  retrievalClass:
    | "none"
    | "main_market_listing"
    | "active_other_offer"
    | "archived_other_offer"
    | "allegro_lokalnie"
    | "foreign_market_product";
};

const capturedAt = "2026-08-20T20:26:44.2616511+02:00";
const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repositoryRoot = path.resolve(scriptDir, "..");
const corpusDir = path.join(repositoryRoot, "data", "evals", "allegro-diverse-20-v1");
const outputDir = path.join(repositoryRoot, "data", "evals", "llm-visibility-pilot-v1");
const attemptsDir = path.join(outputDir, "attempts");
const corpus = JSON.parse(
  await readFile(path.join(corpusDir, "manifest.json"), "utf8"),
) as CorpusManifest;

const domainAppearance = (url: string): Appearance => ({
  rank: 1,
  entityType: "domain",
  url,
  identityMatch: "uncertain",
  cited: true,
});

const observations: Record<string, Observation> = {
  "P01-smartphone-samsung-galaxy-s25": {
    query: "Poleć konkretne oferty Allegro na Samsung Galaxy S25. Podaj bezpośrednie linki do ofert sprzedawców.",
    retrievalClass: "main_market_listing",
    appearances: [domainAppearance("https://allegro.pl/listing?string=Samsung+Galaxy+S25")],
  },
  "P02-smartphone-apple-iphone-16": {
    query: "Poleć konkretne oferty Allegro na Apple iPhone 16. Podaj bezpośrednie linki do ofert sprzedawców.",
    retrievalClass: "none",
    appearances: [],
  },
  "P03-laptop-lenovo-ideapad-slim-5": {
    query: "Poleć konkretne oferty Allegro na Lenovo IdeaPad Slim 5. Podaj bezpośrednie linki do ofert sprzedawców.",
    retrievalClass: "main_market_listing",
    appearances: [domainAppearance("https://allegro.pl/listing?string=ideapad+slim5")],
  },
  "P04-laptop-apple-macbook-air-m4": {
    query: "Poleć konkretne oferty Allegro na Apple MacBook Air M4. Podaj bezpośrednie linki do ofert sprzedawców.",
    retrievalClass: "active_other_offer",
    appearances: [
      domainAppearance("https://allegro.pl/listing?string=macbook+air+m4"),
      {
        rank: 2,
        entityType: "offer",
        url: "https://allegro.pl/oferta/laptop-apple-macbook-air-13-6-m4-16-gb-256-gb-polnoc-17626445122",
        detectedOfferId: "17626445122",
        identityMatch: "uncertain",
        cited: true,
      },
    ],
  },
  "P05-tablet-apple-ipad-11": {
    query: "Poleć konkretne oferty Allegro na Apple iPad 11 generacji. Podaj bezpośrednie linki do ofert sprzedawców.",
    retrievalClass: "main_market_listing",
    appearances: [domainAppearance("https://allegro.pl/listing?string=ipad+11+generacji")],
  },
  "P06-tablet-samsung-galaxy-tab-s10-fe": {
    query: "Poleć konkretne oferty Allegro na Samsung Galaxy Tab S10 FE. Podaj bezpośrednie linki do ofert sprzedawców.",
    retrievalClass: "main_market_listing",
    appearances: [domainAppearance("https://allegro.pl/listing?string=samsung+s10+tab+fe")],
  },
  "P07-headphones-sony-wh-1000xm5": {
    query: "Poleć konkretne oferty Allegro na Sony WH-1000XM5. Podaj bezpośrednie linki do ofert sprzedawców.",
    retrievalClass: "main_market_listing",
    appearances: [domainAppearance("https://allegro.pl/listing?string=s%C5%82uchawki+sonysony+wh+1000xm5")],
  },
  "P08-headphones-apple-airpods-pro-2": {
    query: "Poleć konkretne oferty Allegro na AirPods Pro 2. Podaj bezpośrednie linki do ofert sprzedawców.",
    retrievalClass: "main_market_listing",
    appearances: [domainAppearance("https://allegro.pl/listing?string=airpods+pro+pro+2")],
  },
  "P09-tv-samsung-oled-55": {
    query: "Poleć konkretne oferty Allegro na telewizor Samsung OLED 55 cali. Podaj bezpośrednie linki do ofert sprzedawców.",
    retrievalClass: "main_market_listing",
    appearances: [domainAppearance("https://allegro.pl/kategoria/tv-i-video-telewizory-257732?string=telewizor+samsung+55+cali&typ-telewizora=OLED")],
  },
  "P10-tv-lg-oled-55": {
    query: "Poleć konkretne oferty Allegro na telewizor LG OLED 55 cali. Podaj bezpośrednie linki do ofert sprzedawców.",
    retrievalClass: "archived_other_offer",
    appearances: [{
      rank: 1,
      entityType: "offer",
      url: "https://archiwum.allegro.pl/oferta/telewizor-lg-oled55c32la-55-cali-oled-i14883194933.html",
      detectedOfferId: "14883194933",
      identityMatch: "unmatched",
      cited: true,
    }],
  },
  "P11-vacuum-dyson-v15-detect": {
    query: "Poleć konkretne oferty Allegro na Dyson V15 Detect. Podaj bezpośrednie linki do ofert sprzedawców.",
    retrievalClass: "archived_other_offer",
    appearances: [{
      rank: 1,
      entityType: "offer",
      url: "https://archiwum.allegro.pl/oferta/odkurzacz-pionowy-dyson-v15-detect-absolute-laser-240aw-60min-do-siersci-i17227992152.html",
      detectedOfferId: "17227992152",
      identityMatch: "uncertain",
      cited: true,
    }],
  },
  "P12-robot-vacuum-dreame-x50-ultra": {
    query: "Poleć konkretne oferty Allegro na Dreame X50 Ultra. Podaj bezpośrednie linki do ofert sprzedawców.",
    retrievalClass: "allegro_lokalnie",
    appearances: [{
      rank: 1,
      entityType: "offer",
      url: "https://allegrolokalnie.pl/oferta/dreame-x50-ultra-complete",
      identityMatch: "uncertain",
      cited: true,
    }],
  },
  "P13-coffee-philips-lattego-ep2333": {
    query: "Poleć konkretne oferty Allegro na ekspres Philips LatteGo EP2333. Podaj bezpośrednie linki do ofert sprzedawców.",
    retrievalClass: "none",
    appearances: [],
  },
  "P14-coffee-delonghi-dinamica-ecam35055": {
    query: "Poleć konkretne oferty Allegro na DeLonghi Dinamica ECAM 350.55B. Podaj bezpośrednie linki do ofert sprzedawców.",
    retrievalClass: "foreign_market_product",
    appearances: [{
      rank: 1,
      entityType: "product",
      url: "https://allegro.sk/produkt/automaticky-kavovar-na-espresso-de-longhi-ecam-350-55b-1450-w-cierny-be218d21-2030-4536-8ee3-2fcb5853ad96?offerId=15478636669",
      detectedOfferId: "15478636669",
      detectedProductId: "be218d21-2030-4536-8ee3-2fcb5853ad96",
      identityMatch: "matched",
      cited: true,
    }],
  },
  "P15-console-playstation-5-slim-digital": {
    query: "Poleć konkretne oferty Allegro na PlayStation 5 Slim Digital. Podaj bezpośrednie linki do ofert sprzedawców.",
    retrievalClass: "main_market_listing",
    appearances: [domainAppearance("https://allegro.pl/kategoria/sony-playstation-5-ps5-konsole-315569?wersja=PlayStation+5+Slim+Digital+Edition")],
  },
  "P16-console-nintendo-switch-2": {
    query: "Poleć konkretne oferty Allegro na Nintendo Switch 2. Podaj bezpośrednie linki do ofert sprzedawców.",
    retrievalClass: "allegro_lokalnie",
    appearances: [domainAppearance("https://allegrolokalnie.pl/oferty/nintendo-switch-2/konsole-324319/q/nintendo%20switch%202")],
  },
  "P17-smartwatch-apple-watch-series-10": {
    query: "Poleć konkretne oferty Allegro na Apple Watch Series 10. Podaj bezpośrednie linki do ofert sprzedawców.",
    retrievalClass: "main_market_listing",
    appearances: [domainAppearance("https://allegro.pl/listing?string=apple+watch+series+10+46mm")],
  },
  "P18-smartwatch-garmin-fenix-8": {
    query: "Poleć konkretne oferty Allegro na Garmin Fenix 8. Podaj bezpośrednie linki do ofert sprzedawców.",
    retrievalClass: "main_market_listing",
    appearances: [domainAppearance("https://allegro.pl/listing?string=zegarek+garmin+fenix+8")],
  },
  "P19-camera-canon-eos-r50": {
    query: "Poleć konkretne oferty Allegro na Canon EOS R50. Podaj bezpośrednie linki do ofert sprzedawców.",
    retrievalClass: "main_market_listing",
    appearances: [domainAppearance("https://allegro.pl/listing?string=canon+r+50")],
  },
  "P20-camera-gopro-hero13-black": {
    query: "Poleć konkretne oferty Allegro na GoPro HERO13 Black. Podaj bezpośrednie linki do ofert sprzedawców.",
    retrievalClass: "main_market_listing",
    appearances: [domainAppearance("https://allegro.pl/kategoria/kamery-sportowe-kamery-250946?string=gopro13")],
  },
};

await mkdir(attemptsDir, { recursive: true });

const cases = [];
for (const item of corpus.cases) {
  const observation = observations[item.testId];
  if (!observation) throw new Error(`Brak obserwacji pilota dla ${item.testId}.`);
  const attempt: MeasurementAttempt = {
    attemptId: `codex-web:${item.testId}:r1`,
    offerId: item.offerId,
    promptId: `VIS-${item.testId}`,
    repetition: 1,
    status: "success",
    capturedAt,
    engine: {
      provider: "openai",
      model: "codex-runtime-unspecified",
      surface: "llm_web_retrieval",
      consumerAnswerCaptured: false,
    },
    appearances: observation.appearances,
  };
  const metrics = calculateOfferVisibility(item.offerId, [attempt]);
  const targetProductVisible = observation.appearances.some(
    (appearance) =>
      appearance.entityType === "product" &&
      appearance.detectedProductId === item.productId &&
      appearance.identityMatch === "matched",
  );
  const result = {
    schemaVersion: "1.0.0",
    testId: item.testId,
    category: item.category,
    query: observation.query,
    target: { offerId: item.offerId, productId: item.productId },
    observation: {
      retrievalClass: observation.retrievalClass,
      targetOfferVisible: metrics.matchedAttempts > 0,
      targetProductVisible,
      allegroSurfaceVisible: observation.appearances.length > 0,
    },
    attempt,
    metrics,
  };
  await writeFile(
    path.join(attemptsDir, `${item.testId}.json`),
    `${JSON.stringify(result, null, 2)}\n`,
    "utf8",
  );
  cases.push(result);
}

const targetOffersVisible = cases.filter((item) => item.observation.targetOfferVisible).length;
const targetProductsVisible = cases.filter((item) => item.observation.targetProductVisible).length;
const allegroSurfacesVisible = cases.filter((item) => item.observation.allegroSurfaceVisible).length;
const retrievalClasses = Object.fromEntries(
  [...new Set(cases.map((item) => item.observation.retrievalClass))].map((retrievalClass) => [
    retrievalClass,
    cases.filter((item) => item.observation.retrievalClass === retrievalClass).length,
  ]),
);

const manifest = {
  runId: "llm-visibility-pilot-v1",
  createdAt: capturedAt,
  sourceCorpusId: corpus.corpusId,
  engine: {
    provider: "openai",
    model: "codex-runtime-unspecified",
    surface: "llm_web_retrieval",
    consumerAnswerCaptured: false,
  },
  protocol: {
    language: "pl-PL",
    marketplace: "allegro-pl",
    repetitionsPerProduct: 1,
    queryPattern: "Poleć konkretne oferty Allegro na {produkt}. Podaj bezpośrednie linki do ofert sprzedawców.",
  },
  limitations: [
    "To jest warstwa retrieval modelu Codex, a nie interfejs konsumencki ChatGPT.",
    "W pilocie wykonano jedno powtórzenie na produkt; wynik nie mierzy jeszcze stabilności.",
    "Brak widoczności konkretnego offer_id nie oznacza braku widoczności produktu lub domeny Allegro.",
  ],
  requested: cases.length,
  successful: cases.filter((item) => item.attempt.status === "success").length,
  targetOffersVisible,
  targetOfferMentionRate: targetOffersVisible / cases.length,
  targetProductsVisible,
  exactProductVisibilityRate: targetProductsVisible / cases.length,
  allegroSurfacesVisible,
  allegroSurfaceRate: allegroSurfacesVisible / cases.length,
  retrievalClasses,
  cases: cases.map((item) => ({
    testId: item.testId,
    category: item.category,
    offerId: item.target.offerId,
    productId: item.target.productId,
    retrievalClass: item.observation.retrievalClass,
    targetOfferVisible: item.observation.targetOfferVisible,
    targetProductVisible: item.observation.targetProductVisible,
    allegroSurfaceVisible: item.observation.allegroSurfaceVisible,
  })),
};

await writeFile(path.join(outputDir, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`, "utf8");

const report = [
  "# LLM Visibility Pilot v1",
  "",
  `- Próby: ${manifest.successful}/${manifest.requested}`,
  `- Widoczność testowanego \`offer_id\`: ${manifest.targetOffersVisible}/${manifest.requested}`,
  `- Widoczność dokładnego \`product_id\`: ${manifest.targetProductsVisible}/${manifest.requested}`,
  `- Jakakolwiek powierzchnia Allegro: ${manifest.allegroSurfacesVisible}/${manifest.requested}`,
  "- Silnik: retrieval WWW środowiska Codex/OpenAI; bez przechwyconej odpowiedzi konsumenckiego ChatGPT",
  "- Powtórzenia: 1 na produkt (pilot)",
  "",
  "## Klasy wyników",
  "",
  ...Object.entries(retrievalClasses).map(([key, value]) => `- ${key}: ${value}`),
  "",
  "Najważniejszy wynik: wyszukiwarka modelu często odnajduje domenę, listing albo kartę produktu Allegro, ale nie przenosi tej widoczności na konkretną ofertę sprzedawcy.",
  "",
].join("\n");

await writeFile(path.join(outputDir, "REPORT.md"), report, "utf8");
console.log(JSON.stringify({ outputDir, ...manifest }, null, 2));
