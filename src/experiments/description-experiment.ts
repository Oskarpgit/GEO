import type { OfferSnapshot } from "../domain/types.js";
import type {
  DescriptionExperimentAssessment,
  DescriptionExperimentChangedField,
  DescriptionExperimentPolicy,
} from "./types.js";

export const DESCRIPTION_EXPERIMENT_ASSESSMENT_VERSION = "description-experiment-0.1.0" as const;

export const defaultDescriptionExperimentPolicy: DescriptionExperimentPolicy = {
  priceTolerancePercent: 0,
  sellerRecommendedDriftPercent: 1,
  requireSameTitle: true,
  requireSameParameters: true,
  requireSameImages: true,
  requireSameDelivery: true,
};

function normalizedText(value: string | undefined): string {
  return (value ?? "").replace(/\s+/gu, " ").trim();
}

function stableRecord(value: Record<string, string>): string {
  return JSON.stringify(
    Object.entries(value)
      .map(([key, item]) => [normalizedText(key), normalizedText(item)] as const)
      .sort(([left], [right]) => left.localeCompare(right, "pl-PL")),
  );
}

function stableImages(values: string[]): string {
  return JSON.stringify([...new Set(values)].sort());
}

function priceChanged(
  baseline: number | undefined,
  intervention: number | undefined,
  tolerancePercent: number,
): boolean {
  if (baseline === undefined || intervention === undefined) return baseline !== intervention;
  if (baseline === 0) return baseline !== intervention;
  return (Math.abs(intervention - baseline) / baseline) * 100 > tolerancePercent;
}

function sellerQualityChanged(
  baseline: number | undefined,
  intervention: number | undefined,
  tolerancePercent: number,
): boolean {
  if (baseline === undefined || intervention === undefined) return baseline !== intervention;
  return Math.abs(intervention - baseline) > tolerancePercent;
}

export function assessDescriptionExperiment(
  baseline: OfferSnapshot,
  intervention: OfferSnapshot,
  policy: DescriptionExperimentPolicy = defaultDescriptionExperimentPolicy,
): DescriptionExperimentAssessment {
  const reasonsPl: string[] = [];
  if (baseline.offerId !== intervention.offerId) reasonsPl.push("Porównanie dotyczy różnych offer_id.");
  if (baseline.productId && intervention.productId && baseline.productId !== intervention.productId) {
    reasonsPl.push("Porównanie dotyczy różnych product_id.");
  }
  if (baseline.identity.gtin && intervention.identity.gtin && baseline.identity.gtin !== intervention.identity.gtin) {
    reasonsPl.push("GTIN produktu zmienił się między pomiarami.");
  }

  const changedFields: DescriptionExperimentChangedField[] = [];
  const descriptionChanged =
    normalizedText(baseline.content.descriptionText) !==
    normalizedText(intervention.content.descriptionText);
  if (descriptionChanged) changedFields.push("description");
  if (normalizedText(baseline.identity.title) !== normalizedText(intervention.identity.title)) {
    changedFields.push("title");
  }
  if (stableRecord(baseline.content.parameters) !== stableRecord(intervention.content.parameters)) {
    changedFields.push("parameters");
  }
  if (stableImages(baseline.content.imageUrls) !== stableImages(intervention.content.imageUrls)) {
    changedFields.push("images");
  }
  if (
    priceChanged(baseline.commerce.price, intervention.commerce.price, policy.priceTolerancePercent) ||
    priceChanged(
      baseline.commerce.totalPrice,
      intervention.commerce.totalPrice,
      policy.priceTolerancePercent,
    )
  ) {
    changedFields.push("price");
  }
  if (
    normalizedText(baseline.commerce.deliveryLabel) !==
      normalizedText(intervention.commerce.deliveryLabel) ||
    baseline.commerce.smart !== intervention.commerce.smart
  ) {
    changedFields.push("delivery");
  }
  if (
    sellerQualityChanged(
      baseline.seller.recommendedPercent,
      intervention.seller.recommendedPercent,
      policy.sellerRecommendedDriftPercent,
    ) ||
    baseline.seller.superSeller !== intervention.seller.superSeller ||
    baseline.seller.officialStore !== intervention.seller.officialStore
  ) {
    changedFields.push("seller_quality");
  }

  if (!descriptionChanged) reasonsPl.push("Opis nie zmienił się między pomiarami.");
  const invalid = reasonsPl.length > 0;
  const confounders = changedFields.filter((field) => {
    if (field === "description") return false;
    if (field === "title") return policy.requireSameTitle;
    if (field === "parameters") return policy.requireSameParameters;
    if (field === "images") return policy.requireSameImages;
    if (field === "delivery") return policy.requireSameDelivery;
    return true;
  });
  if (!invalid) {
    for (const field of confounders) reasonsPl.push(`Zmienna zakłócająca: ${field}.`);
  }

  return {
    assessmentVersion: DESCRIPTION_EXPERIMENT_ASSESSMENT_VERSION,
    status: invalid ? "invalid" : confounders.length > 0 ? "observational" : "valid_controlled",
    descriptionChanged,
    changedFields,
    confounders,
    reasonsPl,
    causalClaimAllowed: false,
  };
}
