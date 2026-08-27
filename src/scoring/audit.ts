import type { Ruleset } from "../domain/types.js";
import { allegroPlRuleset } from "../rules/allegro-rules.js";
import { validateAllegroOffer } from "../rules/engine.js";
import { extractGeoFeatures } from "./features.js";
import { calculateGeoScore } from "./score.js";
import type { AllegroGeoAudit, GeoOfferInput } from "./types.js";

export function auditAllegroGeoOffer(
  input: GeoOfferInput,
  ruleset: Ruleset = allegroPlRuleset,
): AllegroGeoAudit {
  const features = extractGeoFeatures(input);
  const parameters = {
    ...(features.identity.brand ? { brand: features.identity.brand } : {}),
    ...(features.identity.model ? { model: features.identity.model } : {}),
    ...(features.identity.manufacturerCode
      ? { manufacturerCode: features.identity.manufacturerCode }
      : {}),
    ...(features.identity.gtin ? { gtin: features.identity.gtin } : {}),
  };
  const allegro = validateAllegroOffer(
    {
      offer: {
        ...(input.title ? { title: input.title } : {}),
        ...(input.description ? { description: input.description } : {}),
        parameters,
        ...(input.images ? { images: input.images } : {}),
      },
    },
    ruleset,
  );
  const generationInputReasons: string[] = [];
  if (!features.identity.brand) generationInputReasons.push("Brak potwierdzonej marki.");
  if (!features.identity.model) generationInputReasons.push("Brak potwierdzonego modelu.");
  if (features.parameterCount === 0) {
    generationInputReasons.push("Brak parametrów będących źródłem faktów.");
  }
  const gtinResult = allegro.results.find((item) => item.ruleId === "ALG-PARAM-001");
  if (gtinResult?.status === "failed") {
    generationInputReasons.push("GTIN ma niepoprawną sumę kontrolną.");
  }

  return {
    geo: calculateGeoScore(input),
    allegro,
    separation: {
      combinedScoreProduced: false,
      currentContentCompliant: allegro.readyForGeneration,
      generationInputReady: generationInputReasons.length === 0,
      generationInputReasons,
    },
  };
}
