import type { ValidationSummary } from "../domain/types.js";

export type GeoIntentArea =
  | "use_case"
  | "compatibility_and_limits"
  | "operation_and_maintenance"
  | "technical_specification"
  | "package_contents";

export type GeoDescriptionStructure = {
  headings: number;
  paragraphs: number;
  listItems: number;
  inlineImages: number;
  numericFacts: number;
  faqSignals: number;
};

export type GeoIdentityField = "brand" | "model" | "manufacturerCode" | "gtin";

export type GeoIdentitySource = {
  kind:
    | "offer_identity"
    | "offer_parameter"
    | "allegro_catalog_parameter"
    | "allegro_product_offer_parameter";
  path: string;
  snapshotId?: string;
  evidenceIds: string[];
};

export type GeoOfferInput = {
  source?: {
    snapshotId: string;
    evidenceIds: string[];
  };
  title?: string;
  description?: string;
  parameters?: Record<string, unknown>;
  images?: string[];
  identity?: {
    brand?: string;
    model?: string;
    manufacturerCode?: string;
    gtin?: string;
    categoryPath?: string[];
  };
  identitySources?: Partial<Record<GeoIdentityField, GeoIdentitySource>>;
  structure?: Partial<GeoDescriptionStructure>;
};

export type GeoFeatureVector = {
  titleCharacters: number;
  descriptionCharacters: number;
  descriptionWords: number;
  sentenceCount: number;
  averageSentenceWords: number;
  headings: number;
  paragraphs: number;
  listItems: number;
  inlineImages: number;
  numericFacts: number;
  faqSignals: number;
  parameterCount: number;
  imageCount: number;
  factsPerHundredWords: number;
  repeatedMeaningfulTokenRatio: number;
  promotionalPhraseMatches: string[];
  contactDataDetected: boolean;
  identity: {
    brand?: string;
    model?: string;
    manufacturerCode?: string;
    gtin?: string;
    detailCount: number;
    brandInTitle: boolean;
    modelInTitle: boolean;
    brandInDescription: boolean;
    modelInDescription: boolean;
  };
  intentCoverage: Record<GeoIntentArea, boolean>;
};

export type GeoCriterionStatus = "met" | "partial" | "missing";

export type GeoCriterionResult = {
  criterionId: string;
  labelPl: string;
  points: number;
  maxPoints: number;
  status: GeoCriterionStatus;
  observedValue: unknown;
};

export type GeoScoreComponentId =
  | "identity_clarity"
  | "answerability_structure"
  | "factual_specificity"
  | "language_quality"
  | "intent_coverage";

export type GeoScoreComponent = {
  componentId: GeoScoreComponentId;
  labelPl: string;
  score: number;
  maxScore: number;
  criteria: GeoCriterionResult[];
};

export type GeoRecommendationPriority = "high" | "medium" | "low";

export type GeoRecommendation = {
  recommendationId: string;
  priority: GeoRecommendationPriority;
  field: "title" | "description" | "parameters" | "images";
  titlePl: string;
  rationalePl: string;
  currentValue: unknown;
  targetPl: string;
  expectedEffect:
    | "better_identity_resolution"
    | "better_answer_extraction"
    | "better_fact_grounding"
    | "better_readability"
    | "better_intent_coverage";
  evidenceBasis: "deterministic" | "limited_observational";
  safetyBoundaryPl: string;
};

export type GeoScoreResult = {
  scoreVersion: "geo-score-0.1.0";
  score: number;
  maxScore: 100;
  confidence: number;
  evidenceLevel: "limited_observational";
  causalClaimAllowed: false;
  calibration: {
    llmRuns: 40;
    observationsWithControls: 18;
    matchedControlPairs: 43;
  };
  inputCompleteness: number;
  features: GeoFeatureVector;
  components: GeoScoreComponent[];
  recommendations: GeoRecommendation[];
};

export type AllegroGeoAudit = {
  geo: GeoScoreResult;
  allegro: ValidationSummary;
  separation: {
    combinedScoreProduced: false;
    currentContentCompliant: boolean;
    generationInputReady: boolean;
    generationInputReasons: string[];
  };
};

