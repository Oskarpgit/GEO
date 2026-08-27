import { describe, expect, it } from "vitest";
import type { OfferSnapshot } from "../src/domain/types.js";
import { assessDescriptionExperiment } from "../src/experiments/description-experiment.js";
import { geoOfferInputFromSnapshot } from "../src/scoring/adapters.js";

const baseline: OfferSnapshot = {
  snapshotId: "snapshot-before",
  offerId: "18479049815",
  productId: "4e228672-df75-4385-99e4-1aeedc87aa4d",
  marketplace: "allegro-pl",
  capturedAt: "2026-08-20T12:00:00+02:00",
  sourceUrl: "https://allegro.pl/oferta/18479049815",
  seller: { name: "LUM_COM_PL", recommendedPercent: 98.6 },
  identity: {
    title: "Ekspres automatyczny Philips EP2334/10 LatteGo czarny",
    brand: "Philips",
    model: "EP2334/10",
    gtin: "8720389030291",
    categoryPath: ["AGD", "Ekspresy"],
  },
  content: {
    descriptionText: "Opis bazowy produktu.",
    parameters: { Moc: "1500 W", Kolor: "czarny" },
    imageUrls: ["https://a.allegroimg.com/product.jpg"],
  },
  commerce: { price: 1449, currency: "PLN", deliveryLabel: "dostawa jutro" },
  productGroup: { comparedOfferCount: 38 },
  evidence: [],
};

describe("assessDescriptionExperiment", () => {
  it("maps an immutable snapshot into a scoring and generation input", () => {
    expect(geoOfferInputFromSnapshot(baseline)).toMatchObject({
      source: { snapshotId: "snapshot-before", evidenceIds: [] },
      title: baseline.identity.title,
      description: baseline.content.descriptionText,
      identity: { brand: "Philips", model: "EP2334/10", gtin: "8720389030291" },
    });
  });

  it("accepts a comparison where only the description changed", () => {
    const intervention: OfferSnapshot = {
      ...baseline,
      snapshotId: "snapshot-after",
      content: { ...baseline.content, descriptionText: "Nowy, uziemiony opis produktu." },
    };

    expect(assessDescriptionExperiment(baseline, intervention)).toMatchObject({
      status: "valid_controlled",
      descriptionChanged: true,
      changedFields: ["description"],
      confounders: [],
      causalClaimAllowed: false,
    });
  });

  it("marks a simultaneous price change as observational", () => {
    const intervention: OfferSnapshot = {
      ...baseline,
      snapshotId: "snapshot-after",
      content: { ...baseline.content, descriptionText: "Nowy opis produktu." },
      commerce: { ...baseline.commerce, price: 1399 },
    };

    const assessment = assessDescriptionExperiment(baseline, intervention);

    expect(assessment.status).toBe("observational");
    expect(assessment.confounders).toContain("price");
  });

  it("rejects a comparison without a description change", () => {
    const assessment = assessDescriptionExperiment(baseline, {
      ...baseline,
      snapshotId: "snapshot-after",
    });

    expect(assessment.status).toBe("invalid");
    expect(assessment.reasonsPl).toContain("Opis nie zmienił się między pomiarami.");
  });

  it("rejects a different concrete offer even if the text changed", () => {
    const assessment = assessDescriptionExperiment(baseline, {
      ...baseline,
      snapshotId: "snapshot-after",
      offerId: "99999999999",
      content: { ...baseline.content, descriptionText: "Nowy opis produktu." },
    });

    expect(assessment.status).toBe("invalid");
    expect(assessment.reasonsPl).toContain("Porównanie dotyczy różnych offer_id.");
  });
});
