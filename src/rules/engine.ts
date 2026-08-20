import type {
  RuleDefinition,
  RuleResult,
  RuleStatus,
  Ruleset,
  ValidationSummary,
} from "../domain/types.js";

export type AllegroValidationInput = {
  offer: {
    title?: string;
    description?: string;
    parameters?: {
      brand?: string;
      manufacturerCode?: string;
      model?: string;
      gtin?: string;
      [key: string]: unknown;
    };
    images?: string[];
  };
};

export const VALIDATOR_VERSION = "0.1.0";

const polishStopWords = new Set([
  "oraz",
  "jest",
  "który",
  "która",
  "które",
  "dla",
  "przez",
  "jego",
  "jej",
  "ten",
  "tej",
  "się",
  "nie",
  "także",
]);

function getField(input: AllegroValidationInput, path: string): unknown {
  const normalizedPath = path.replace(/^offer\.description$/, "offer.description");
  return normalizedPath.split(".").reduce<unknown>((value, segment) => {
    if (typeof value !== "object" || value === null) return undefined;
    return (value as Record<string, unknown>)[segment];
  }, input);
}

function normalizeText(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const normalized = value.replace(/\s+/g, " ").trim();
  return normalized.length > 0 ? normalized : undefined;
}

function words(value: string): string[] {
  return value
    .toLocaleLowerCase("pl-PL")
    .normalize("NFKC")
    .match(/[\p{L}\p{N}]+(?:[/-][\p{L}\p{N}]+)*/gu) ?? [];
}

function includesPhrase(value: string, phrase: string): boolean {
  const escaped = phrase.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(^|\\P{L})${escaped}(?=$|\\P{L})`, "iu").test(value);
}

function hasExcessiveRepetition(value: string, maximum: number): boolean {
  const counts = new Map<string, number>();
  for (const token of words(value)) {
    if (token.length < 4 || polishStopWords.has(token)) continue;
    const count = (counts.get(token) ?? 0) + 1;
    if (count > maximum) return true;
    counts.set(token, count);
  }
  return false;
}

export function isValidGtin(value: string): boolean {
  if (!/^\d{8}$|^\d{12,14}$/.test(value)) return false;
  const digits = [...value].map(Number);
  const checkDigit = digits.pop();
  if (checkDigit === undefined) return false;

  const sum = digits
    .reverse()
    .reduce((total, digit, index) => total + digit * (index % 2 === 0 ? 3 : 1), 0);

  return (10 - (sum % 10)) % 10 === checkDigit;
}

function result(
  rule: RuleDefinition,
  status: RuleStatus,
  observedValue?: unknown,
): RuleResult {
  return {
    ruleId: rule.ruleId,
    field: rule.field,
    severity: rule.severity,
    status,
    messagePl: rule.messagePl,
    ...(observedValue === undefined ? {} : { observedValue }),
    validatorVersion: VALIDATOR_VERSION,
  };
}

function validateRule(rule: RuleDefinition, input: AllegroValidationInput): RuleResult {
  const rawValue = getField(input, rule.field);
  const text = normalizeText(rawValue);

  switch (rule.kind) {
    case "length": {
      if (!text) return result(rule, "not_evaluated");
      const minimum = Number(rule.assertion.minCharacters ?? 0);
      const maximum = Number(rule.assertion.maxCharacters ?? Number.POSITIVE_INFINITY);
      return result(rule, text.length >= minimum && text.length <= maximum ? "passed" : "failed", text.length);
    }
    case "word_count": {
      if (!text) return result(rule, "not_evaluated");
      const count = words(text).length;
      return result(rule, count >= Number(rule.assertion.minWords ?? 0) ? "passed" : "failed", count);
    }
    case "forbidden_phrases":
    case "misplaced_information":
    case "source_origin": {
      if (!text) return result(rule, "not_evaluated");
      const phrases = Array.isArray(rule.assertion.phrases)
        ? rule.assertion.phrases.filter((phrase): phrase is string => typeof phrase === "string")
        : [];
      const matches = phrases.filter((phrase) => includesPhrase(text, phrase));
      return result(rule, matches.length === 0 ? "passed" : "failed", matches);
    }
    case "keyword_repetition": {
      if (!text) return result(rule, "not_evaluated");
      const maximum = Number(rule.assertion.maxMeaningfulTokenOccurrences ?? 3);
      return result(rule, hasExcessiveRepetition(text, maximum) ? "failed" : "passed");
    }
    case "completeness": {
      if (!text) return result(rule, "failed", 0);
      const minimum = Number(rule.assertion.minCharacters ?? 1);
      return result(rule, text.length >= minimum ? "passed" : "failed", text.length);
    }
    case "language": {
      if (!text) return result(rule, "not_evaluated");
      const tokens = words(text);
      if (tokens.length < 12) return result(rule, "needs_review");
      const polishMarkers = tokens.filter((token) => /[ąćęłńóśźż]/u.test(token)).length;
      const commonPolish = tokens.filter((token) => polishStopWords.has(token)).length;
      return result(rule, polishMarkers + commonPolish > 0 ? "passed" : "needs_review");
    }
    case "personal_and_payment_data": {
      if (!text) return result(rule, "not_evaluated");
      const detections = {
        email: /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/iu.test(text),
        phone: /(?<!\d)(?:\+48[\s-]?)?(?:\d[\s-]?){9}(?!\d)/u.test(text),
        iban: /\bPL\s?(?:\d[\s]?){26}\b/iu.test(text),
      };
      return result(rule, Object.values(detections).some(Boolean) ? "failed" : "passed", detections);
    }
    case "gtin": {
      if (!text) return result(rule, "not_evaluated");
      return result(rule, isValidGtin(text) ? "passed" : "failed", text);
    }
    case "identity_completeness": {
      const parameters = input.offer.parameters;
      if (!parameters) return result(rule, "not_evaluated");
      const required = Array.isArray(rule.assertion.fields)
        ? rule.assertion.fields.filter((field): field is string => typeof field === "string")
        : [];
      const missing = required.filter((field) => normalizeText(parameters[field]) === undefined);
      return result(rule, missing.length === 0 ? "passed" : "failed", missing);
    }
    case "language_quality":
    case "semantic_relevance":
    case "cross_field_consistency":
    case "variant_isolation":
    case "copyright_review":
      return result(rule, text ? "needs_review" : "not_evaluated");
    default:
      return result(rule, "not_evaluated");
  }
}

export function validateAllegroOffer(
  input: AllegroValidationInput,
  ruleset: Ruleset,
): ValidationSummary {
  const results = ruleset.rules.map((rule) => validateRule(rule, input));
  const totals: ValidationSummary["totals"] = {
    passed: 0,
    failed: 0,
    needs_review: 0,
    not_applicable: 0,
    not_evaluated: 0,
  };

  for (const item of results) totals[item.status] += 1;

  const readyForGeneration = !results.some(
    (item) => item.status === "failed" && (item.severity === "blocker" || item.severity === "error"),
  );

  return {
    rulesetId: ruleset.rulesetId,
    validatorVersion: VALIDATOR_VERSION,
    readyForGeneration,
    totals,
    results,
  };
}

