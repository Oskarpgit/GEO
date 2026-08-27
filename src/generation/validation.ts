import type { Ruleset } from "../domain/types.js";
import { allegroPlRuleset } from "../rules/allegro-rules.js";
import { validateAllegroOffer } from "../rules/engine.js";
import { extractGeoFeatures } from "../scoring/features.js";
import type { GeoOfferInput } from "../scoring/types.js";
import { extractProductClaims } from "./claims.js";
import { renderCandidateBlock, renderDescriptionCandidate } from "./generator.js";
import type {
  CandidateProvenanceViolation,
  DescriptionCandidate,
  DescriptionCandidateValidation,
  ProductClaim,
} from "./types.js";

export const GROUNDED_DESCRIPTION_VALIDATOR_VERSION =
  "grounded-description-validator-0.1.0" as const;

const sectionHeadings: Record<DescriptionCandidate["sections"][number]["sectionId"], string> = {
  identity: "Identyfikacja produktu",
  technical_specification: "Dane techniczne",
  operation_and_maintenance: "Obsługa i konserwacja",
  compatibility_and_limits: "Kompatybilność i ograniczenia",
  package_contents: "Zawartość zestawu",
};

function normalizedText(value: string | undefined): string {
  return (value ?? "").replace(/\s+/gu, " ").trim();
}

export function validateDescriptionCandidate(
  input: GeoOfferInput,
  candidate: DescriptionCandidate,
  claims: ProductClaim[],
  ruleset: Ruleset = allegroPlRuleset,
): DescriptionCandidateValidation {
  const claimMap = new Map(claims.map((item) => [item.claimId, item]));
  const sourceClaimMap = new Map(extractProductClaims(input).map((item) => [item.claimId, item]));
  const violations: CandidateProvenanceViolation[] = [];
  const seenBlockIds = new Set<string>();
  const seenSectionIds = new Set<string>();
  if (normalizedText(candidate.title) !== normalizedText(input.title)) {
    violations.push({
      blockId: "candidate",
      code: "title_source_mismatch",
      messagePl: "Tytuł kandydata różni się od tytułu wejściowego.",
    });
  }
  for (const section of candidate.sections) {
    if (seenSectionIds.has(section.sectionId)) {
      violations.push({
        blockId: section.sectionId,
        code: "duplicate_section_id",
        messagePl: "Identyfikator sekcji występuje więcej niż raz.",
      });
    }
    seenSectionIds.add(section.sectionId);
    if (section.headingPl !== sectionHeadings[section.sectionId]) {
      violations.push({
        blockId: section.sectionId,
        code: "invalid_section_heading",
        messagePl: "Nagłówek sekcji nie odpowiada wersjonowanemu szablonowi.",
      });
    }
  }
  for (const block of candidate.sections.flatMap((section) => section.blocks)) {
    if (seenBlockIds.has(block.blockId)) {
      violations.push({
        blockId: block.blockId,
        code: "duplicate_block_id",
        messagePl: "Identyfikator bloku występuje więcej niż raz.",
      });
    }
    seenBlockIds.add(block.blockId);
    if (
      (block.templateId === "identity_statement" && block.type !== "paragraph") ||
      (block.templateId === "fact_statement" && block.type !== "bullet")
    ) {
      violations.push({
        blockId: block.blockId,
        code: "invalid_block_type",
        messagePl: "Typ bloku nie odpowiada wersjonowanemu szablonowi.",
      });
    }
    if (
      (block.templateId === "identity_statement" && block.claimIds.length !== 2) ||
      (block.templateId === "fact_statement" && block.claimIds.length !== 1)
    ) {
      violations.push({
        blockId: block.blockId,
        code: "invalid_claim_count",
        messagePl: "Liczba faktów nie pasuje do szablonu bloku.",
      });
    }
    const blockClaims = block.claimIds.flatMap((claimId) => {
      const item = claimMap.get(claimId);
      if (!item) {
        violations.push({
          blockId: block.blockId,
          code: "missing_claim",
          messagePl: `Blok wskazuje nieznany fakt ${claimId}.`,
        });
        return [];
      }
      if (item.reviewStatus !== "approved") {
        violations.push({
          blockId: block.blockId,
          code: "claim_not_approved",
          messagePl: `Fakt ${claimId} nie został zatwierdzony.`,
        });
      }
      const sourceClaim = sourceClaimMap.get(claimId);
      if (
        !sourceClaim ||
        sourceClaim.kind !== item.kind ||
        sourceClaim.labelPl !== item.labelPl ||
        sourceClaim.value !== item.value ||
        sourceClaim.source.kind !== item.source.kind ||
        sourceClaim.source.path !== item.source.path ||
        sourceClaim.source.contentHash !== item.source.contentHash ||
        sourceClaim.source.snapshotId !== item.source.snapshotId ||
        JSON.stringify(sourceClaim.source.evidenceIds) !== JSON.stringify(item.source.evidenceIds)
      ) {
        violations.push({
          blockId: block.blockId,
          code: "claim_source_mismatch",
          messagePl: `Fakt ${claimId} nie odpowiada aktualnemu polu źródłowemu.`,
        });
      }
      return [item];
    });
    const reproduced = renderCandidateBlock(block.templateId, blockClaims);
    if (reproduced === undefined || reproduced !== block.text) {
      violations.push({
        blockId: block.blockId,
        code: "text_not_reproducible",
        messagePl: "Tekstu bloku nie można odtworzyć ze wskazanych faktów i szablonu.",
      });
    }
  }

  const features = extractGeoFeatures(input);
  const parameters = {
    ...(features.identity.brand ? { brand: features.identity.brand } : {}),
    ...(features.identity.model ? { model: features.identity.model } : {}),
    ...(features.identity.manufacturerCode
      ? { manufacturerCode: features.identity.manufacturerCode }
      : {}),
    ...(features.identity.gtin ? { gtin: features.identity.gtin } : {}),
  };
  const renderedDescription = renderDescriptionCandidate(candidate);
  const allegro = validateAllegroOffer(
    {
      offer: {
        title: candidate.title,
        description: renderedDescription,
        parameters,
        ...(input.images ? { images: input.images } : {}),
      },
    },
    ruleset,
  );
  const failedBlockingRules = allegro.results.filter(
    (item) =>
      item.status === "failed" && (item.severity === "blocker" || item.severity === "error"),
  );
  const needsReview = allegro.results.some((item) => item.status === "needs_review");
  const provenanceValid = violations.length === 0;
  const failed = !provenanceValid || failedBlockingRules.length > 0;
  const status: DescriptionCandidateValidation["status"] = failed
    ? "failed"
    : needsReview
      ? "needs_review"
      : "passed";

  return {
    validatorVersion: GROUNDED_DESCRIPTION_VALIDATOR_VERSION,
    status,
    provenanceValid,
    provenanceViolations: violations,
    allegro,
    renderedDescription,
    readyForHumanReview: !failed,
    readyForUse: status === "passed",
  };
}
