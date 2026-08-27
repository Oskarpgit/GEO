import type {
  GeoFeatureVector,
  GeoIntentArea,
  GeoOfferInput,
} from "./types.js";

const polishStopWords = new Set([
  "aby",
  "ale",
  "dla",
  "do",
  "i",
  "jak",
  "jest",
  "na",
  "nie",
  "o",
  "od",
  "oraz",
  "po",
  "przez",
  "się",
  "ten",
  "to",
  "w",
  "z",
  "za",
  "że",
]);

const promotionalPhrases = [
  "hit",
  "najlepszy",
  "najtaniej",
  "okazja",
  "promocja",
  "rewelacyjny",
  "super cena",
  "tylko dziś",
  "wyjątkowy",
];

const intentPatterns: Record<GeoIntentArea, RegExp> = {
  use_case: /\b(?:dla kogo|do czego|sprawdzi się|zastosowan|przeznaczon|użytkown|idealn[ey]|codzienn)\w*/iu,
  compatibility_and_limits:
    /\b(?:kompatybiln|wymaga|ograniczen|nie obsługuje|pasuje|współpracuje|maksymaln|minimaln|uwaga)\w*/iu,
  operation_and_maintenance:
    /\b(?:obsług|czyszczen|konserwac|montaż|instalac|ładowan|myci|pielęgnac|użyci)\w*/iu,
  technical_specification:
    /\b(?:dane techniczne|specyfikac|parametr|wymiar|pojemność|moc|waga|rozdzielczość|pamięć)\w*/iu,
  package_contents:
    /\b(?:zawartość zestawu|w zestawie|opakowanie zawiera|komplet|dołączon|otrzymujesz)\w*/iu,
};

function cleanText(value: string | undefined): string {
  return (value ?? "").replace(/<[^>]+>/gu, " ").replace(/\s+/gu, " ").trim();
}

function normalized(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/\p{M}/gu, "")
    .toLocaleLowerCase("pl-PL")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .replace(/\s+/gu, " ")
    .trim();
}

function words(value: string): string[] {
  return value.toLocaleLowerCase("pl-PL").match(/[\p{L}\p{N}]+(?:[/-][\p{L}\p{N}]+)*/gu) ?? [];
}

function nonEmptyString(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const result = value.replace(/\s+/gu, " ").trim();
  return result.length > 0 ? result : undefined;
}

function parameterValue(parameters: Record<string, unknown>, names: string[]): string | undefined {
  const expected = new Set(names.map(normalized));
  for (const [key, value] of Object.entries(parameters)) {
    if (!expected.has(normalized(key))) continue;
    const text = nonEmptyString(value);
    if (text) return text;
  }
  return undefined;
}

function includesIdentity(haystack: string, needle: string | undefined): boolean {
  if (!needle) return false;
  const normalizedNeedle = normalized(needle);
  return normalizedNeedle.length > 1 && normalized(haystack).includes(normalizedNeedle);
}

function inferredStructure(rawDescription: string, cleanDescription: string) {
  const lines = rawDescription.split(/\r?\n/u);
  const headings = lines.filter((line) => {
    const trimmed = line.trim();
    return /^#{1,6}\s+\S/u.test(trimmed) || /^[\p{Lu}\d][^.!?]{2,70}:$/u.test(trimmed);
  }).length;
  const paragraphs = rawDescription
    .split(/(?:\r?\n\s*){2,}/u)
    .map(cleanText)
    .filter(Boolean).length;
  const listItems = lines.filter((line) => /^\s*(?:[-*•]|\d+[.)])\s+\S/u.test(line)).length;
  const faqSignals =
    (cleanDescription.match(/\?/gu)?.length ?? 0) +
    (cleanDescription.match(/\b(?:najczęściej zadawane pytania|faq|pytania i odpowiedzi)\b/giu)?.length ?? 0);
  const numericFacts =
    cleanDescription.match(
      /\b\d+(?:[,.]\d+)?\s*(?:%|mm|cm|m|kg|g|ml|l|w|kw|v|mah|hz|gb|tb|mpx|cal(?:e|i)?|szt\.?|min|h)\b/giu,
    )?.length ?? 0;

  return { headings, paragraphs, listItems, faqSignals, numericFacts };
}

function repeatedMeaningfulTokenRatio(tokens: string[]): number {
  const meaningful = tokens.filter((token) => token.length >= 4 && !polishStopWords.has(token));
  if (meaningful.length === 0) return 0;
  const counts = new Map<string, number>();
  for (const token of meaningful) counts.set(token, (counts.get(token) ?? 0) + 1);
  const repeated = [...counts.values()].reduce((total, count) => total + Math.max(0, count - 1), 0);
  return repeated / meaningful.length;
}

function round(value: number, digits = 2): number {
  return Number(value.toFixed(digits));
}

export function extractGeoFeatures(input: GeoOfferInput): GeoFeatureVector {
  const rawDescription = input.description ?? "";
  const description = cleanText(rawDescription);
  const title = cleanText(input.title);
  const descriptionTokens = words(description);
  const sentenceCount = description
    ? Math.max(1, description.split(/(?<=[.!?])\s+/u).filter(Boolean).length)
    : 0;
  const inferred = inferredStructure(rawDescription, description);
  const parameters = input.parameters ?? {};
  const brand = nonEmptyString(input.identity?.brand) ?? parameterValue(parameters, ["marka", "brand"]);
  const model = nonEmptyString(input.identity?.model) ?? parameterValue(parameters, ["model"]);
  const manufacturerCode =
    nonEmptyString(input.identity?.manufacturerCode) ??
    parameterValue(parameters, ["kod producenta", "manufacturer code", "mpn"]);
  const gtin =
    nonEmptyString(input.identity?.gtin) ?? parameterValue(parameters, ["ean", "ean (gtin)", "gtin"]);
  const detailCount = [brand, model, manufacturerCode, gtin].filter(Boolean).length;
  const parameterCount = Object.values(parameters).filter((value) => {
    if (typeof value === "string") return value.trim().length > 0;
    return value !== null && value !== undefined;
  }).length;
  const numericFacts = input.structure?.numericFacts ?? inferred.numericFacts;
  const descriptionWords = descriptionTokens.length;
  const normalizedDescription = ` ${normalized(description)} `;
  const promotionalPhraseMatches = promotionalPhrases.filter((phrase) =>
    normalizedDescription.includes(` ${normalized(phrase)} `),
  );

  return {
    titleCharacters: title.length,
    descriptionCharacters: description.length,
    descriptionWords,
    sentenceCount,
    averageSentenceWords: sentenceCount > 0 ? round(descriptionWords / sentenceCount) : 0,
    headings: input.structure?.headings ?? inferred.headings,
    paragraphs: input.structure?.paragraphs ?? inferred.paragraphs,
    listItems: input.structure?.listItems ?? inferred.listItems,
    inlineImages: input.structure?.inlineImages ?? 0,
    numericFacts,
    faqSignals: input.structure?.faqSignals ?? inferred.faqSignals,
    parameterCount,
    imageCount: input.images?.length ?? 0,
    factsPerHundredWords:
      descriptionWords > 0 ? round((numericFacts + parameterCount) / (descriptionWords / 100)) : 0,
    repeatedMeaningfulTokenRatio: round(repeatedMeaningfulTokenRatio(descriptionTokens), 3),
    promotionalPhraseMatches,
    contactDataDetected:
      /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/iu.test(description) ||
      /(?<!\d)(?:\+48[\s-]?)?(?:\d[\s-]?){9}(?!\d)/u.test(description),
    identity: {
      ...(brand ? { brand } : {}),
      ...(model ? { model } : {}),
      ...(manufacturerCode ? { manufacturerCode } : {}),
      ...(gtin ? { gtin } : {}),
      detailCount,
      brandInTitle: includesIdentity(title, brand),
      modelInTitle: includesIdentity(title, model),
      brandInDescription: includesIdentity(description, brand),
      modelInDescription: includesIdentity(description, model),
    },
    intentCoverage: {
      use_case: intentPatterns.use_case.test(description),
      compatibility_and_limits: intentPatterns.compatibility_and_limits.test(description),
      operation_and_maintenance: intentPatterns.operation_and_maintenance.test(description),
      technical_specification: intentPatterns.technical_specification.test(description),
      package_contents: intentPatterns.package_contents.test(description),
    },
  };
}
