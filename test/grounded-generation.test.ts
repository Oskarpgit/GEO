import { describe, expect, it } from "vitest";
import {
  extractProductClaims,
  reviewProductClaims,
} from "../src/generation/claims.js";
import {
  generateGroundedDescriptionCandidate,
  renderDescriptionCandidate,
} from "../src/generation/generator.js";
import { validateDescriptionCandidate } from "../src/generation/validation.js";
import {
  generateReviewedOfferDescription,
  prepareOfferDescriptionReview,
} from "../src/workflows/offer-description.js";

const offer = {
  title: "Ekspres automatyczny Philips LatteGo EP2334/10 czarny",
  parameters: {
    Marka: "Philips",
    Model: "EP2334/10",
    "Kod producenta": "EP2334/10",
    "EAN (GTIN)": "8720389030291",
    Moc: "1500 W",
    "Pojemność zbiornika": "1,8 l",
    Kolor: "czarny",
    "Rodzaj kawy": "ziarnista",
    "Sposób czyszczenia": "odłączany system mleczny",
    "Zawartość zestawu": "ekspres i system LatteGo",
    Gwarancja: "24 miesiące",
  },
  images: ["https://a.allegroimg.com/product.jpg"],
};

function approveAll(claims: ReturnType<typeof extractProductClaims>) {
  return reviewProductClaims(
    claims,
    Object.fromEntries(claims.map((claim) => [claim.claimId, "approved" as const])),
  );
}

describe("product claims", () => {
  it("extracts stable claims and preserves their real source paths", () => {
    const first = extractProductClaims(offer);
    const second = extractProductClaims(offer);
    const brand = first.find((claim) => claim.kind === "brand");

    expect(first).toEqual(second);
    expect(brand).toMatchObject({
      value: "Philips",
      source: { kind: "offer_parameter", path: "parameters.Marka" },
      reviewStatus: "source_backed",
    });
    expect(new Set(first.map((claim) => claim.claimId)).size).toBe(first.length);
  });

  it("requires explicit review and rejects decisions for unknown claims", () => {
    const claims = extractProductClaims(offer);
    const approved = approveAll(claims);

    expect(approved.every((claim) => claim.reviewStatus === "approved")).toBe(true);
    expect(() => reviewProductClaims(claims, { claim_missing: "approved" })).toThrow(
      /nieznanych claimIds/iu,
    );
  });
});

describe("grounded description generation", () => {
  it("blocks generation until brand and model are approved", () => {
    const result = generateGroundedDescriptionCandidate(offer, extractProductClaims(offer));

    expect(result.status).toBe("blocked");
    if (result.status === "blocked") {
      expect(result.reasons).toContain("Brak zatwierdzonego faktu marki.");
      expect(result.reasons).toContain("Brak zatwierdzonego faktu modelu.");
    }
  });

  it("generates only reproducible blocks and omits forbidden fields", () => {
    const claims = approveAll(extractProductClaims(offer));
    const result = generateGroundedDescriptionCandidate(offer, claims);

    expect(result.status).toBe("generated");
    if (result.status !== "generated") return;
    const rendered = renderDescriptionCandidate(result.candidate);
    const warranty = claims.find((claim) => claim.labelPl === "Gwarancja");

    expect(rendered).toContain("Produkt: Philips EP2334/10.");
    expect(rendered).toContain("Moc: 1500 W.");
    expect(rendered).not.toContain("24 miesiące");
    expect(result.omittedClaims).toContainEqual({
      claimId: warranty?.claimId,
      reason: "field_not_allowed_in_description",
    });
    expect(result.candidate.sections.flatMap((section) => section.blocks).every(
      (block) => block.claimIds.length > 0,
    )).toBe(true);
  });

  it("validates provenance and leaves semantic Allegro rules for human review", () => {
    const claims = approveAll(extractProductClaims(offer));
    const result = generateGroundedDescriptionCandidate(offer, claims);
    if (result.status !== "generated") throw new Error("Oczekiwano kandydata.");

    const validation = validateDescriptionCandidate(offer, result.candidate, claims);

    expect(validation.provenanceValid).toBe(true);
    expect(validation.status).toBe("needs_review");
    expect(validation.readyForHumanReview).toBe(true);
    expect(validation.readyForUse).toBe(false);
  });

  it("detects text changed outside the approved template", () => {
    const claims = approveAll(extractProductClaims(offer));
    const result = generateGroundedDescriptionCandidate(offer, claims);
    if (result.status !== "generated") throw new Error("Oczekiwano kandydata.");
    const firstBlock = result.candidate.sections[0]?.blocks[0];
    if (!firstBlock) throw new Error("Brak pierwszego bloku.");
    const tampered = {
      ...result.candidate,
      sections: result.candidate.sections.map((section, index) =>
        index === 0
          ? {
              ...section,
              blocks: section.blocks.map((block, blockIndex) =>
                blockIndex === 0 ? { ...block, text: `${block.text} Najlepszy na rynku.` } : block,
              ),
            }
          : section,
      ),
    };

    const validation = validateDescriptionCandidate(offer, tampered, claims);

    expect(validation.status).toBe("failed");
    expect(validation.provenanceViolations).toContainEqual(
      expect.objectContaining({ blockId: firstBlock.blockId, code: "text_not_reproducible" }),
    );
  });

  it("does not accept a rejected fact referenced by a candidate", () => {
    const approved = approveAll(extractProductClaims(offer));
    const result = generateGroundedDescriptionCandidate(offer, approved);
    if (result.status !== "generated") throw new Error("Oczekiwano kandydata.");
    const usedClaimId = result.usedClaimIds.find((claimId) =>
      approved.some((claim) => claim.claimId === claimId && claim.kind === "parameter"),
    );
    if (!usedClaimId) throw new Error("Brak faktu parametru.");
    const reviewed = reviewProductClaims(approved, { [usedClaimId]: "rejected" });

    const validation = validateDescriptionCandidate(offer, result.candidate, reviewed);

    expect(validation.status).toBe("failed");
    expect(validation.provenanceViolations).toContainEqual(
      expect.objectContaining({ code: "claim_not_approved" }),
    );
  });

  it("detects a claim value that no longer matches the source field", () => {
    const approved = approveAll(extractProductClaims(offer));
    const result = generateGroundedDescriptionCandidate(offer, approved);
    if (result.status !== "generated") throw new Error("Oczekiwano kandydata.");
    const usedClaimId = result.usedClaimIds.find((claimId) =>
      approved.some((claim) => claim.claimId === claimId && claim.kind === "parameter"),
    );
    if (!usedClaimId) throw new Error("Brak faktu parametru.");
    const tamperedClaims = approved.map((claim) =>
      claim.claimId === usedClaimId ? { ...claim, value: "wartość spoza źródła" } : claim,
    );

    const validation = validateDescriptionCandidate(offer, result.candidate, tamperedClaims);

    expect(validation.status).toBe("failed");
    expect(validation.provenanceViolations).toContainEqual(
      expect.objectContaining({ code: "claim_source_mismatch" }),
    );
  });

  it("rejects a heading outside the versioned template", () => {
    const approved = approveAll(extractProductClaims(offer));
    const result = generateGroundedDescriptionCandidate(offer, approved);
    if (result.status !== "generated") throw new Error("Oczekiwano kandydata.");
    const tampered = {
      ...result.candidate,
      sections: result.candidate.sections.map((section, index) =>
        index === 0 ? { ...section, headingPl: "Najlepszy produkt na rynku" } : section,
      ),
    };

    const validation = validateDescriptionCandidate(offer, tampered, approved);

    expect(validation.status).toBe("failed");
    expect(validation.provenanceViolations).toContainEqual(
      expect.objectContaining({ code: "invalid_section_heading" }),
    );
  });
});

describe("offer description workflow", () => {
  it("prepares an audit and reviewable claims without starting generation", () => {
    const review = prepareOfferDescriptionReview(offer);

    expect(review.generationStarted).toBe(false);
    expect(review.approvedClaimCount).toBe(0);
    expect(review.claims.length).toBeGreaterThan(4);
    expect(review.claims.every((claim) => claim.reviewStatus === "source_backed")).toBe(true);
    expect(review.audit.geo.score).toBeGreaterThan(0);
  });

  it("runs generation and validation only after explicit decisions", () => {
    const review = prepareOfferDescriptionReview(offer);
    const decisions = Object.fromEntries(
      review.claims.map((claim) => [
        claim.claimId,
        claim.labelPl === "Gwarancja" ? "rejected" : "approved",
      ]),
    ) as Record<string, "approved" | "rejected">;

    const result = generateReviewedOfferDescription(offer, decisions);

    expect(result.status).toBe("generated");
    if (result.status !== "generated") return;
    expect(result.validation.status).toBe("needs_review");
    expect(result.validation.readyForHumanReview).toBe(true);
    expect(result.validation.renderedDescription).not.toContain("24 miesiące");
  });
});
