import type { IdentityMatch } from "../domain/types.js";

export type ComparableProductIdentity = {
  productId?: string;
  gtin?: string;
  brand?: string;
  model?: string;
  unitCount?: number;
};

export const MATCHER_VERSION = "0.1.0";

function normalize(value: string | undefined): string | undefined {
  if (!value) return undefined;
  const normalized = value
    .normalize("NFKD")
    .replace(/\p{Diacritic}/gu, "")
    .toLocaleLowerCase("pl-PL")
    .replace(/[^\p{L}\p{N}]+/gu, "")
    .trim();
  return normalized || undefined;
}

export function matchProductIdentity(
  left: ComparableProductIdentity,
  right: ComparableProductIdentity,
): IdentityMatch {
  const signals: IdentityMatch["signals"] = [];
  const reasons: string[] = [];

  if (left.unitCount !== undefined && right.unitCount !== undefined) {
    const matched = left.unitCount === right.unitCount;
    signals.push({ type: "unit_count", matched, decisive: !matched });
    if (!matched) {
      return {
        result: "unmatched",
        confidence: 1,
        matcherVersion: MATCHER_VERSION,
        signals,
        reasons: ["Różna liczba sztuk; oferta pojedyncza i wielopak nie są tym samym wariantem."],
      };
    }
  }

  if (left.gtin && right.gtin) {
    const matched = left.gtin === right.gtin;
    signals.push({ type: "gtin", matched, decisive: true });
    return {
      result: matched ? "matched" : "unmatched",
      confidence: 1,
      matcherVersion: MATCHER_VERSION,
      signals,
      reasons: [matched ? "Dokładnie zgodny GTIN." : "Sprzeczny GTIN."],
    };
  }

  if (left.productId && right.productId) {
    const matched = normalize(left.productId) === normalize(right.productId);
    signals.push({ type: "product_id", matched, decisive: !matched });
    if (!matched) {
      return {
        result: "unmatched",
        confidence: 0.99,
        matcherVersion: MATCHER_VERSION,
        signals,
        reasons: ["Sprzeczny identyfikator produktu Allegro."],
      };
    }
    reasons.push("Zgodny identyfikator produktu Allegro.");
  }

  const leftBrand = normalize(left.brand);
  const rightBrand = normalize(right.brand);
  const leftModel = normalize(left.model);
  const rightModel = normalize(right.model);
  if (leftBrand && rightBrand && leftModel && rightModel) {
    const matched = leftBrand === rightBrand && leftModel === rightModel;
    signals.push({ type: "brand_model", matched, decisive: !matched });
    if (!matched) {
      return {
        result: "unmatched",
        confidence: 0.95,
        matcherVersion: MATCHER_VERSION,
        signals,
        reasons: [...reasons, "Sprzeczna marka lub model."],
      };
    }
    reasons.push("Zgodna znormalizowana marka i model.");
  }

  const positiveSignals = signals.filter((signal) => signal.matched).length;
  if (positiveSignals >= 2 || signals.some((signal) => signal.type === "product_id" && signal.matched)) {
    return {
      result: "matched",
      confidence: positiveSignals >= 2 ? 0.98 : 0.95,
      matcherVersion: MATCHER_VERSION,
      signals,
      reasons,
    };
  }

  return {
    result: "uncertain",
    confidence: positiveSignals === 1 ? 0.7 : 0.2,
    matcherVersion: MATCHER_VERSION,
    signals,
    reasons: reasons.length > 0 ? reasons : ["Za mało niezależnych sygnałów tożsamości."],
  };
}
