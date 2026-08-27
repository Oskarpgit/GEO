import type {
  GeoCriterionResult,
  GeoCriterionStatus,
  GeoFeatureVector,
  GeoOfferInput,
  GeoScoreComponent,
  GeoScoreResult,
} from "./types.js";
import { extractGeoFeatures } from "./features.js";
import { buildGeoRecommendations } from "./recommendations.js";

export const GEO_SCORE_VERSION = "geo-score-0.1.0" as const;

function criterion(
  criterionId: string,
  labelPl: string,
  points: number,
  maxPoints: number,
  observedValue: unknown,
): GeoCriterionResult {
  const boundedPoints = Math.max(0, Math.min(maxPoints, points));
  let status: GeoCriterionStatus = "partial";
  if (boundedPoints === maxPoints) status = "met";
  if (boundedPoints === 0) status = "missing";
  return { criterionId, labelPl, points: boundedPoints, maxPoints, status, observedValue };
}

function component(
  componentId: GeoScoreComponent["componentId"],
  labelPl: string,
  criteria: GeoCriterionResult[],
): GeoScoreComponent {
  return {
    componentId,
    labelPl,
    score: criteria.reduce((total, item) => total + item.points, 0),
    maxScore: criteria.reduce((total, item) => total + item.maxPoints, 0),
    criteria,
  };
}

function identityComponent(features: GeoFeatureVector): GeoScoreComponent {
  const identityInDescription =
    Number(features.identity.brandInDescription) + Number(features.identity.modelInDescription);
  return component("identity_clarity", "Jednoznaczność produktu", [
    criterion(
      "GEO-ID-001",
      "Tytuł ma użyteczną długość",
      features.titleCharacters >= 12 && features.titleCharacters <= 75 ? 3 : 0,
      3,
      features.titleCharacters,
    ),
    criterion(
      "GEO-ID-002",
      "Opis jest dostępny",
      features.descriptionCharacters >= 80 ? 2 : features.descriptionCharacters > 0 ? 1 : 0,
      2,
      features.descriptionCharacters,
    ),
    criterion("GEO-ID-003", "Marka jest podana", features.identity.brand ? 4 : 0, 4, features.identity.brand ?? null),
    criterion("GEO-ID-004", "Model jest podany", features.identity.model ? 4 : 0, 4, features.identity.model ?? null),
    criterion(
      "GEO-ID-005",
      "Kod producenta lub GTIN jest dostępny",
      features.identity.manufacturerCode || features.identity.gtin ? 3 : 0,
      3,
      { manufacturerCode: features.identity.manufacturerCode ?? null, gtin: features.identity.gtin ?? null },
    ),
    criterion("GEO-ID-006", "Marka występuje w tytule", features.identity.brandInTitle ? 2 : 0, 2, features.identity.brandInTitle),
    criterion("GEO-ID-007", "Model występuje w tytule", features.identity.modelInTitle ? 3 : 0, 3, features.identity.modelInTitle),
    criterion(
      "GEO-ID-008",
      "Marka i model są osadzone w opisie",
      identityInDescription === 2 ? 4 : identityInDescription === 1 ? 2 : 0,
      4,
      identityInDescription,
    ),
  ]);
}

function structureComponent(features: GeoFeatureVector): GeoScoreComponent {
  const wordsPoints =
    features.descriptionWords >= 120 && features.descriptionWords <= 900
      ? 6
      : features.descriptionWords >= 60 && features.descriptionWords <= 1200
        ? 3
        : 0;
  const blockTypes = [features.headings > 0, features.paragraphs > 1, features.listItems > 0].filter(Boolean).length;
  return component("answerability_structure", "Struktura i odpowiedzi", [
    criterion("GEO-STRUCT-001", "Opis ma użyteczny zakres długości", wordsPoints, 6, features.descriptionWords),
    criterion(
      "GEO-STRUCT-002",
      "Opis używa nagłówków",
      features.headings >= 2 ? 5 : features.headings === 1 ? 3 : 0,
      5,
      features.headings,
    ),
    criterion(
      "GEO-STRUCT-003",
      "Opis jest podzielony na akapity",
      features.paragraphs >= 3 ? 5 : features.paragraphs === 2 ? 3 : 0,
      5,
      features.paragraphs,
    ),
    criterion(
      "GEO-STRUCT-004",
      "Najważniejsze fakty są również w liście",
      features.listItems >= 3 ? 4 : features.listItems > 0 ? 2 : 0,
      4,
      features.listItems,
    ),
    criterion(
      "GEO-STRUCT-005",
      "Opis łączy różne typy bloków",
      blockTypes >= 2 ? 5 : blockTypes === 1 ? 2 : 0,
      5,
      blockTypes,
    ),
  ]);
}

function factualComponent(features: GeoFeatureVector): GeoScoreComponent {
  return component("factual_specificity", "Fakty i specyficzność", [
    criterion(
      "GEO-FACT-001",
      "Parametry produktu są kompletne",
      features.parameterCount >= 8 ? 8 : features.parameterCount >= 4 ? 5 : features.parameterCount > 0 ? 2 : 0,
      8,
      features.parameterCount,
    ),
    criterion(
      "GEO-FACT-002",
      "Opis zawiera konkretne fakty liczbowe",
      features.numericFacts >= 4 ? 6 : features.numericFacts >= 2 ? 4 : features.numericFacts === 1 ? 2 : 0,
      6,
      features.numericFacts,
    ),
    criterion(
      "GEO-FACT-003",
      "Fakty mają wystarczającą gęstość",
      features.factsPerHundredWords >= 1.5 ? 4 : features.factsPerHundredWords >= 0.5 ? 2 : 0,
      4,
      features.factsPerHundredWords,
    ),
    criterion(
      "GEO-FACT-004",
      "Tożsamość ma wiele niezależnych identyfikatorów",
      features.identity.detailCount >= 3 ? 4 : features.identity.detailCount === 2 ? 3 : features.identity.detailCount === 1 ? 1 : 0,
      4,
      features.identity.detailCount,
    ),
    criterion(
      "GEO-FACT-005",
      "Oferta ma materiał obrazowy",
      features.imageCount >= 4 ? 3 : features.imageCount > 0 ? 1 : 0,
      3,
      features.imageCount,
    ),
  ]);
}

function languageComponent(features: GeoFeatureVector): GeoScoreComponent {
  const sentencePoints =
    features.averageSentenceWords >= 8 && features.averageSentenceWords <= 28
      ? 5
      : features.averageSentenceWords >= 4 && features.averageSentenceWords <= 40
        ? 3
        : 0;
  const repetitionPoints =
    features.repeatedMeaningfulTokenRatio <= 0.12
      ? 5
      : features.repeatedMeaningfulTokenRatio <= 0.25
        ? 3
        : 0;
  const promotionPoints =
    features.promotionalPhraseMatches.length === 0
      ? 5
      : features.promotionalPhraseMatches.length === 1
        ? 2
        : 0;
  return component("language_quality", "Jakość języka", [
    criterion("GEO-LANG-001", "Zdania mają czytelną długość", sentencePoints, 5, features.averageSentenceWords),
    criterion(
      "GEO-LANG-002",
      "Opis nie powtarza nadmiernie słów",
      repetitionPoints,
      5,
      features.repeatedMeaningfulTokenRatio,
    ),
    criterion(
      "GEO-LANG-003",
      "Opis unika pustych fraz promocyjnych",
      promotionPoints,
      5,
      features.promotionalPhraseMatches,
    ),
  ]);
}

function intentComponent(features: GeoFeatureVector): GeoScoreComponent {
  const labels = {
    use_case: "Zastosowanie i odbiorca",
    compatibility_and_limits: "Kompatybilność i ograniczenia",
    operation_and_maintenance: "Obsługa i konserwacja",
    technical_specification: "Dane techniczne",
    package_contents: "Zawartość zestawu",
  } as const;
  const criteria = Object.entries(features.intentCoverage).map(([area, covered]) =>
    criterion(`GEO-INTENT-${area}`, labels[area as keyof typeof labels], covered ? 2 : 0, 2, covered),
  );
  return component("intent_coverage", "Pokrycie intencji", criteria);
}

function inputCompleteness(input: GeoOfferInput, features: GeoFeatureVector): number {
  let score = 0;
  if ((input.title ?? "").trim()) score += 0.15;
  if ((input.description ?? "").trim()) score += 0.35;
  if (features.parameterCount > 0) score += 0.2;
  if (features.identity.brand && features.identity.model) score += 0.2;
  if ((input.images?.length ?? 0) > 0 || input.structure) score += 0.1;
  return Number(score.toFixed(2));
}

export function calculateGeoScore(input: GeoOfferInput): GeoScoreResult {
  const features = extractGeoFeatures(input);
  const components = [
    identityComponent(features),
    structureComponent(features),
    factualComponent(features),
    languageComponent(features),
    intentComponent(features),
  ];
  const score = components.reduce((total, item) => total + item.score, 0);
  const completeness = inputCompleteness(input, features);
  const resultWithoutRecommendations = {
    scoreVersion: GEO_SCORE_VERSION,
    score,
    maxScore: 100 as const,
    confidence: Number((0.35 + completeness * 0.45).toFixed(2)),
    evidenceLevel: "limited_observational" as const,
    causalClaimAllowed: false as const,
    calibration: {
      llmRuns: 40 as const,
      observationsWithControls: 18 as const,
      matchedControlPairs: 43 as const,
    },
    inputCompleteness: completeness,
    features,
    components,
  };

  return {
    ...resultWithoutRecommendations,
    recommendations: buildGeoRecommendations(resultWithoutRecommendations),
  };
}
