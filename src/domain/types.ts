export type EvidenceKind =
  | "html"
  | "markdown"
  | "screenshot"
  | "llm_response"
  | "official_rule";

export type EvidenceRef = {
  evidenceId: string;
  kind: EvidenceKind;
  sourceUrl?: string;
  contentHash: string;
  capturedAt: string;
};

export type OfferSnapshot = {
  snapshotId: string;
  offerId: string;
  productId?: string;
  marketplace: "allegro-pl";
  capturedAt: string;
  sourceUrl: string;
  seller: {
    name?: string;
    recommendedPercent?: number;
    ratingCount?: number;
    superSeller?: boolean;
    officialStore?: boolean;
  };
  identity: {
    title: string;
    brand?: string;
    model?: string;
    manufacturerCode?: string;
    gtin?: string;
    categoryPath: string[];
  };
  content: {
    descriptionText: string;
    parameters: Record<string, string>;
    imageUrls: string[];
  };
  commerce: {
    price?: number;
    currency: "PLN";
    totalPrice?: number;
    deliveryLabel?: string;
    smart?: boolean;
  };
  productGroup: {
    comparedOfferCount?: number;
  };
  evidence: EvidenceRef[];
};

export type RuleSeverity = "blocker" | "error" | "warning" | "guidance";

export type RuleStatus =
  | "passed"
  | "failed"
  | "needs_review"
  | "not_applicable"
  | "not_evaluated";

export type RuleDefinition = {
  ruleId: string;
  field: string;
  severity: RuleSeverity;
  kind: string;
  assertion: Record<string, unknown>;
  messagePl: string;
  sourceId: string;
  autofix: boolean;
};

export type RuleResult = {
  ruleId: string;
  field: string;
  severity: RuleSeverity;
  status: RuleStatus;
  messagePl: string;
  observedValue?: unknown;
  validatorVersion: string;
};

export type Ruleset = {
  rulesetId: string;
  marketplace: "allegro-pl";
  retrievedAt: string;
  sources: Array<{
    sourceId: string;
    url: string;
    title: string;
  }>;
  rules: RuleDefinition[];
};

export type ValidationSummary = {
  rulesetId: string;
  validatorVersion: string;
  readyForGeneration: boolean;
  totals: Record<RuleStatus, number>;
  results: RuleResult[];
};

export type IdentityMatch = {
  result: "matched" | "uncertain" | "unmatched";
  confidence: number;
  matcherVersion: string;
  signals: Array<{
    type: "gtin" | "product_id" | "brand_model" | "unit_count";
    matched: boolean;
    decisive: boolean;
  }>;
  reasons: string[];
};

export type MeasurementStatus =
  | "success"
  | "blocked"
  | "timeout"
  | "parse_error"
  | "auth_error"
  | "unsupported";

export type Appearance = {
  rank: number;
  entityType: "offer" | "product" | "seller" | "domain";
  url?: string;
  detectedOfferId?: string;
  detectedProductId?: string;
  identityMatch: "matched" | "uncertain" | "unmatched";
  cited: boolean;
};

export type MeasurementAttempt = {
  attemptId: string;
  offerId: string;
  promptId: string;
  repetition: number;
  status: MeasurementStatus;
  capturedAt?: string;
  engine?: {
    provider: string;
    model: string;
    surface: "consumer_llm_answer" | "llm_web_retrieval" | "search_engine";
    consumerAnswerCaptured: boolean;
  };
  appearances: Appearance[];
};
