import type {
  GeoRecommendation,
  GeoScoreResult,
} from "./types.js";

type RecommendationInput = Omit<GeoScoreResult, "recommendations">;

const priorityOrder: Record<GeoRecommendation["priority"], number> = {
  high: 0,
  medium: 1,
  low: 2,
};

function safeBoundary(field: GeoRecommendation["field"]): string {
  if (field === "images") return "Użyj wyłącznie zdjęć, do których sprzedawca ma prawa.";
  return "Dodaj wyłącznie informacje potwierdzone w danych produktu; nie kopiuj treści konkurencji.";
}

export function buildGeoRecommendations(input: RecommendationInput): GeoRecommendation[] {
  const { features } = input;
  const recommendations: GeoRecommendation[] = [];
  const add = (item: Omit<GeoRecommendation, "safetyBoundaryPl">) => {
    recommendations.push({ ...item, safetyBoundaryPl: safeBoundary(item.field) });
  };

  if (!features.identity.brand) {
    add({
      recommendationId: "REC-GEO-ID-BRAND",
      priority: "high",
      field: "parameters",
      titlePl: "Uzupełnij markę produktu",
      rationalePl: "Marka jest podstawowym sygnałem rozpoznania encji produktu.",
      currentValue: null,
      targetPl: "Jedna potwierdzona marka, spójna z tytułem, opisem i katalogiem Allegro.",
      expectedEffect: "better_identity_resolution",
      evidenceBasis: "deterministic",
    });
  }
  if (!features.identity.model) {
    add({
      recommendationId: "REC-GEO-ID-MODEL",
      priority: "high",
      field: "parameters",
      titlePl: "Uzupełnij dokładny model",
      rationalePl: "Bez modelu LLM może połączyć ofertę z innym wariantem produktu.",
      currentValue: null,
      targetPl: "Dokładne oznaczenie modelu zgodne z produktem i GTIN.",
      expectedEffect: "better_identity_resolution",
      evidenceBasis: "deterministic",
    });
  }
  if (features.identity.brand && !features.identity.brandInTitle) {
    add({
      recommendationId: "REC-GEO-TITLE-BRAND",
      priority: "high",
      field: "title",
      titlePl: "Umieść markę w tytule",
      rationalePl: "Tytuł powinien jednoznacznie wskazywać encję już na początku dokumentu.",
      currentValue: false,
      targetPl: "Marka występuje naturalnie i tylko raz w tytule.",
      expectedEffect: "better_identity_resolution",
      evidenceBasis: "deterministic",
    });
  }
  if (features.identity.model && !features.identity.modelInTitle) {
    add({
      recommendationId: "REC-GEO-TITLE-MODEL",
      priority: "high",
      field: "title",
      titlePl: "Umieść dokładny model w tytule",
      rationalePl: "Model odróżnia produkt od podobnych wariantów i generacji.",
      currentValue: false,
      targetPl: "Pełny model zapisany zgodnie z parametrami produktu.",
      expectedEffect: "better_identity_resolution",
      evidenceBasis: "deterministic",
    });
  }
  if (features.descriptionWords < 120) {
    add({
      recommendationId: "REC-GEO-DESC-DEPTH",
      priority: "high",
      field: "description",
      titlePl: "Rozbuduj opis o potwierdzone fakty",
      rationalePl: "Krótki opis zwykle nie odpowiada na pełny zestaw pytań zakupowych.",
      currentValue: features.descriptionWords,
      targetPl: "Co najmniej 120 słów, bez sztucznego wydłużania i powtórzeń.",
      expectedEffect: "better_answer_extraction",
      evidenceBasis: "deterministic",
    });
  } else if (features.descriptionWords > 900) {
    add({
      recommendationId: "REC-GEO-DESC-CONDENSE",
      priority: "medium",
      field: "description",
      titlePl: "Skróć i uporządkuj opis",
      rationalePl: "Bardzo długi opis utrudnia odnalezienie najważniejszych odpowiedzi.",
      currentValue: features.descriptionWords,
      targetPl: "Do 900 słów, z najważniejszymi faktami w krótkich sekcjach.",
      expectedEffect: "better_readability",
      evidenceBasis: "deterministic",
    });
  }
  if (features.headings < 2) {
    add({
      recommendationId: "REC-GEO-STRUCT-HEADINGS",
      priority: "medium",
      field: "description",
      titlePl: "Podziel opis nagłówkami",
      rationalePl: "Nagłówki tworzą jednoznaczne fragmenty, z których łatwiej wydobyć odpowiedź.",
      currentValue: features.headings,
      targetPl: "Co najmniej dwa informacyjne nagłówki opisujące zawartość sekcji.",
      expectedEffect: "better_answer_extraction",
      evidenceBasis: "limited_observational",
    });
  }
  if (features.listItems < 3) {
    add({
      recommendationId: "REC-GEO-STRUCT-LIST",
      priority: "medium",
      field: "description",
      titlePl: "Wydziel najważniejsze fakty w liście",
      rationalePl: "Krótka lista ułatwia rozpoznanie cech i zawartości zestawu.",
      currentValue: features.listItems,
      targetPl: "Lista co najmniej trzech konkretnych, niepowtarzających się faktów.",
      expectedEffect: "better_answer_extraction",
      evidenceBasis: "limited_observational",
    });
  }
  if (features.parameterCount < 4) {
    add({
      recommendationId: "REC-GEO-FACT-PARAMETERS",
      priority: "high",
      field: "parameters",
      titlePl: "Uzupełnij parametry katalogowe",
      rationalePl: "Parametry są kontrolowanym źródłem faktów i pomagają odróżnić wariant produktu.",
      currentValue: features.parameterCount,
      targetPl: "Minimum cztery istotne parametry, w tym identyfikatory wymagane dla kategorii.",
      expectedEffect: "better_fact_grounding",
      evidenceBasis: "deterministic",
    });
  }
  if (features.numericFacts < 2) {
    add({
      recommendationId: "REC-GEO-FACT-NUMERIC",
      priority: "medium",
      field: "description",
      titlePl: "Dodaj konkretne wartości techniczne",
      rationalePl: "Wartości z jednostkami pozwalają odpowiadać na precyzyjne pytania zakupowe.",
      currentValue: features.numericFacts,
      targetPl: "Co najmniej dwa istotne fakty liczbowe z jednostkami, jeśli produkt je posiada.",
      expectedEffect: "better_fact_grounding",
      evidenceBasis: "limited_observational",
    });
  }
  const missingIntentAreas = Object.entries(features.intentCoverage)
    .filter(([, covered]) => !covered)
    .map(([area]) => area);
  if (missingIntentAreas.length > 0) {
    add({
      recommendationId: "REC-GEO-INTENT-COVERAGE",
      priority: missingIntentAreas.length >= 4 ? "high" : "medium",
      field: "description",
      titlePl: "Uzupełnij brakujące obszary informacyjne",
      rationalePl: "Opis nie odpowiada jeszcze na wszystkie podstawowe rodziny intencji zakupowych.",
      currentValue: missingIntentAreas,
      targetPl: "Pokryj zastosowanie, ograniczenia, obsługę, dane techniczne i zawartość zestawu, gdy dotyczą produktu.",
      expectedEffect: "better_intent_coverage",
      evidenceBasis: "deterministic",
    });
  }
  if (features.promotionalPhraseMatches.length > 0) {
    add({
      recommendationId: "REC-GEO-LANG-PROMOTION",
      priority: "high",
      field: "description",
      titlePl: "Usuń puste frazy promocyjne",
      rationalePl: "Superlatywy nie dostarczają faktów i mogą naruszać zasady Allegro.",
      currentValue: features.promotionalPhraseMatches,
      targetPl: "Zastąp każdą frazę konkretnym, weryfikowalnym faktem albo usuń ją.",
      expectedEffect: "better_readability",
      evidenceBasis: "deterministic",
    });
  }
  if (features.repeatedMeaningfulTokenRatio > 0.25) {
    add({
      recommendationId: "REC-GEO-LANG-REPETITION",
      priority: "medium",
      field: "description",
      titlePl: "Ogranicz powtarzanie słów kluczowych",
      rationalePl: "Powtórzenia obniżają czytelność i nie tworzą nowych informacji.",
      currentValue: features.repeatedMeaningfulTokenRatio,
      targetPl: "Każda sekcja wnosi nowy fakt; usuń sztuczne warianty tej samej frazy.",
      expectedEffect: "better_readability",
      evidenceBasis: "deterministic",
    });
  }

  return recommendations.sort(
    (left, right) =>
      priorityOrder[left.priority] - priorityOrder[right.priority] ||
      left.recommendationId.localeCompare(right.recommendationId),
  );
}
