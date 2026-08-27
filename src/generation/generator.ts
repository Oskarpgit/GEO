import { createHash } from "node:crypto";
import type { GeoOfferInput } from "../scoring/types.js";
import type {
  DescriptionCandidate,
  DescriptionCandidateBlock,
  DescriptionCandidateSection,
  DescriptionGenerationResult,
  OmittedClaim,
  ProductClaim,
} from "./types.js";

export const GROUNDED_DESCRIPTION_GENERATOR_VERSION = "grounded-description-0.1.0" as const;

function normalized(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/\p{M}/gu, "")
    .toLocaleLowerCase("pl-PL")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .replace(/\s+/gu, " ")
    .trim();
}

function hash(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

const forbiddenDescriptionFields =
  /\b(?:cena|dostawa|gwarancja|promocja|sprzedawca|urlop|stan magazynowy|raty)\b/iu;

const sectionPatterns: Array<{
  sectionId: DescriptionCandidateSection["sectionId"];
  headingPl: string;
  pattern: RegExp;
}> = [
  {
    sectionId: "package_contents",
    headingPl: "Zawartość zestawu",
    pattern: /\b(?:zestaw|wyposażenie|w komplecie|opakowanie zawiera|dołączon)\w*/iu,
  },
  {
    sectionId: "operation_and_maintenance",
    headingPl: "Obsługa i konserwacja",
    pattern: /\b(?:czyszczen|konserwac|myci|filtr|montaż|instalac|ładowan|obsług)\w*/iu,
  },
  {
    sectionId: "compatibility_and_limits",
    headingPl: "Kompatybilność i ograniczenia",
    pattern: /\b(?:kompatybiln|pasuje|współpracuje|wymaga|maksymaln|minimaln|ograniczen)\w*/iu,
  },
];

function blockId(templateId: DescriptionCandidateBlock["templateId"], claimIds: string[]): string {
  return `block_${hash(`${templateId}\u0000${claimIds.join("\u0000")}`).slice(0, 16)}`;
}

export function renderCandidateBlock(
  templateId: DescriptionCandidateBlock["templateId"],
  claims: ProductClaim[],
): string | undefined {
  if (templateId === "identity_statement") {
    const brand = claims.find((item) => item.kind === "brand");
    const model = claims.find((item) => item.kind === "model");
    if (!brand || !model) return undefined;
    return `Produkt: ${brand.value} ${model.value}.`;
  }
  if (templateId === "fact_statement") {
    const fact = claims[0];
    if (!fact || claims.length !== 1) return undefined;
    const label = fact.labelPl.replace(/[:;]+$/u, "").trim();
    const value = fact.value.replace(/[.!?]+$/u, "").trim();
    return `${label}: ${value}.`;
  }
  return undefined;
}

function factBlock(claim: ProductClaim): DescriptionCandidateBlock {
  return {
    blockId: blockId("fact_statement", [claim.claimId]),
    type: "bullet",
    templateId: "fact_statement",
    text: renderCandidateBlock("fact_statement", [claim]) ?? "",
    claimIds: [claim.claimId],
  };
}

function parameterSection(claim: ProductClaim): {
  sectionId: DescriptionCandidateSection["sectionId"];
  headingPl: string;
} {
  const searchable = `${claim.labelPl} ${claim.value}`;
  return (
    sectionPatterns.find((entry) => entry.pattern.test(searchable)) ?? {
      sectionId: "technical_specification",
      headingPl: "Dane techniczne",
    }
  );
}

export function generateGroundedDescriptionCandidate(
  input: GeoOfferInput,
  claims: ProductClaim[],
): DescriptionGenerationResult {
  const approved = claims
    .filter((item) => item.reviewStatus === "approved")
    .sort((left, right) => left.claimId.localeCompare(right.claimId));
  const omittedClaims: OmittedClaim[] = claims
    .filter((item) => item.reviewStatus !== "approved")
    .map((item) => ({ claimId: item.claimId, reason: "not_approved" }));
  const brand = approved.find((item) => item.kind === "brand");
  const model = approved.find((item) => item.kind === "model");
  const reasons: string[] = [];
  if (!brand) reasons.push("Brak zatwierdzonego faktu marki.");
  if (!model) reasons.push("Brak zatwierdzonego faktu modelu.");
  if (!input.title?.trim()) reasons.push("Brak tytułu oferty potrzebnego do walidacji Allegro.");

  const allowed = approved.filter((item) => {
    if (item.kind !== "parameter") return true;
    if (!forbiddenDescriptionFields.test(normalized(item.labelPl))) return true;
    omittedClaims.push({ claimId: item.claimId, reason: "field_not_allowed_in_description" });
    return false;
  });
  if (reasons.length > 0 || !brand || !model || !input.title) {
    return { status: "blocked", reasons, usedClaimIds: [], omittedClaims };
  }

  const identityClaims = allowed.filter((item) => item.kind !== "parameter");
  const identityBlockClaims = identityClaims.filter(
    (item) => item.kind === "brand" || item.kind === "model",
  );
  const identityBlocks: DescriptionCandidateBlock[] = [
    {
      blockId: blockId("identity_statement", identityBlockClaims.map((item) => item.claimId)),
      type: "paragraph",
      templateId: "identity_statement",
      text: renderCandidateBlock("identity_statement", identityBlockClaims) ?? "",
      claimIds: identityBlockClaims.map((item) => item.claimId),
    },
    ...identityClaims
      .filter((item) => item.kind === "manufacturer_code" || item.kind === "gtin")
      .map(factBlock),
  ];
  const sections = new Map<DescriptionCandidateSection["sectionId"], DescriptionCandidateSection>();
  sections.set("identity", {
    sectionId: "identity",
    headingPl: "Identyfikacja produktu",
    blocks: identityBlocks,
  });
  for (const item of allowed.filter((claim) => claim.kind === "parameter")) {
    const destination = parameterSection(item);
    const current = sections.get(destination.sectionId) ?? {
      sectionId: destination.sectionId,
      headingPl: destination.headingPl,
      blocks: [],
    };
    current.blocks.push(factBlock(item));
    sections.set(destination.sectionId, current);
  }
  const orderedSectionIds: DescriptionCandidateSection["sectionId"][] = [
    "identity",
    "technical_specification",
    "operation_and_maintenance",
    "compatibility_and_limits",
    "package_contents",
  ];
  const orderedSections = orderedSectionIds
    .map((sectionId) => sections.get(sectionId))
    .filter((section): section is DescriptionCandidateSection => Boolean(section));
  const usedClaimIds = [
    ...new Set(orderedSections.flatMap((section) => section.blocks.flatMap((block) => block.claimIds))),
  ];
  const fingerprint = JSON.stringify({
    title: input.title.trim(),
    generatorVersion: GROUNDED_DESCRIPTION_GENERATOR_VERSION,
    claims: usedClaimIds.map((claimId) => {
      const item = allowed.find((claim) => claim.claimId === claimId);
      return item ? [item.claimId, item.value] : [claimId, null];
    }),
  });
  const candidate: DescriptionCandidate = {
    candidateId: `candidate_${hash(fingerprint).slice(0, 20)}`,
    generatorVersion: GROUNDED_DESCRIPTION_GENERATOR_VERSION,
    title: input.title.trim(),
    sections: orderedSections,
  };

  return { status: "generated", candidate, usedClaimIds, omittedClaims };
}

export function renderDescriptionCandidate(candidate: DescriptionCandidate): string {
  return candidate.sections
    .map((section) => {
      const blocks = section.blocks.map((block) =>
        block.type === "bullet" ? `- ${block.text}` : block.text,
      );
      return [section.headingPl, ...blocks].join("\n");
    })
    .join("\n\n");
}
