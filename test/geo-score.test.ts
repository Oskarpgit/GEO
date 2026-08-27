import { describe, expect, it } from "vitest";
import { auditAllegroGeoOffer } from "../src/scoring/audit.js";
import { extractGeoFeatures } from "../src/scoring/features.js";
import { calculateGeoScore } from "../src/scoring/score.js";

const completeOffer = {
  title: "Ekspres automatyczny Philips LatteGo EP2334/10 czarny",
  description: `
## Dla kogo jest ten ekspres?

Philips LatteGo EP2334/10 sprawdzi się w codziennym przygotowaniu kawy czarnej i mlecznej.
Model ma moc 1500 W, zbiornik wody 1,8 l oraz pojemnik na ziarna 275 g.

## Obsługa i czyszczenie

System mleczny można odłączyć i umyć po użyciu. Panel ułatwia wybór napoju.

## Dane techniczne i zawartość zestawu

- moc: 1500 W
- zbiornik wody: 1,8 l
- pojemnik na ziarna: 275 g
- w zestawie znajduje się ekspres i system LatteGo

Czy urządzenie wymaga regularnego czyszczenia? Tak, wykonuj konserwację zgodnie z instrukcją producenta.
Przed zakupem sprawdź wymiary i miejsce ustawienia urządzenia.
  `,
  parameters: {
    Marka: "Philips",
    Model: "EP2334/10",
    "Kod producenta": "EP2334/10",
    "EAN (GTIN)": "8720389030291",
    Moc: "1500 W",
    "Pojemność zbiornika": "1,8 l",
    Kolor: "czarny",
    "Rodzaj kawy": "ziarnista",
  },
  images: ["1.jpg", "2.jpg", "3.jpg", "4.jpg"],
};

describe("extractGeoFeatures", () => {
  it("extracts identity, structure, facts and intent signals", () => {
    const features = extractGeoFeatures(completeOffer);

    expect(features.identity).toMatchObject({
      brand: "Philips",
      model: "EP2334/10",
      brandInTitle: true,
      modelInTitle: true,
    });
    expect(features.headings).toBe(3);
    expect(features.listItems).toBe(4);
    expect(features.numericFacts).toBeGreaterThanOrEqual(6);
    expect(features.intentCoverage.operation_and_maintenance).toBe(true);
    expect(features.intentCoverage.technical_specification).toBe(true);
  });
});

describe("calculateGeoScore", () => {
  it("is deterministic, bounded and fully explainable", () => {
    const first = calculateGeoScore(completeOffer);
    const second = calculateGeoScore(completeOffer);

    expect(first).toEqual(second);
    expect(first.score).toBeGreaterThanOrEqual(0);
    expect(first.score).toBeLessThanOrEqual(100);
    expect(first.components.reduce((total, component) => total + component.score, 0)).toBe(
      first.score,
    );
    expect(first.components.reduce((total, component) => total + component.maxScore, 0)).toBe(
      100,
    );
    expect(first.causalClaimAllowed).toBe(false);
  });

  it("scores a complete factual description higher than an empty one", () => {
    const complete = calculateGeoScore(completeOffer);
    const empty = calculateGeoScore({ title: "Ekspres do kawy" });

    expect(complete.score).toBeGreaterThan(empty.score + 40);
    expect(empty.recommendations.some((item) => item.recommendationId === "REC-GEO-ID-BRAND")).toBe(true);
    expect(empty.recommendations.some((item) => item.recommendationId === "REC-GEO-ID-MODEL")).toBe(true);
  });

  it("keeps input confidence separate from the score", () => {
    const incomplete = calculateGeoScore({ description: completeOffer.description });
    const complete = calculateGeoScore(completeOffer);

    expect(complete.confidence).toBeGreaterThan(incomplete.confidence);
    expect(complete.confidence).toBeLessThanOrEqual(0.8);
    expect(complete.evidenceLevel).toBe("limited_observational");
  });
});

describe("auditAllegroGeoOffer", () => {
  it("reports GEO and Allegro independently", () => {
    const audit = auditAllegroGeoOffer({
      ...completeOffer,
      description: `${completeOffer.description} PROMOCJA tylko dziś. Kontakt: test@example.com`,
    });

    expect(audit.geo.score).toBeGreaterThan(0);
    expect(audit.allegro.readyForGeneration).toBe(false);
    expect(audit.separation.combinedScoreProduced).toBe(false);
    expect(audit.separation.generationInputReady).toBe(true);
  });
});
