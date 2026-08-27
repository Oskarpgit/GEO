import { auditAllegroGeoOffer } from "../scoring/audit.js";
import type { AllegroGeoAudit, GeoOfferInput } from "../scoring/types.js";
import { extractProductClaims, reviewProductClaims } from "../generation/claims.js";
import { generateGroundedDescriptionCandidate } from "../generation/generator.js";
import type {
  DescriptionCandidateValidation,
  DescriptionGenerationResult,
  ProductClaim,
  ProductClaimReviewStatus,
} from "../generation/types.js";
import { validateDescriptionCandidate } from "../generation/validation.js";

export type OfferDescriptionReview = {
  workflowVersion: "offer-description-workflow-0.1.0";
  audit: AllegroGeoAudit;
  claims: ProductClaim[];
  approvedClaimCount: 0;
  generationStarted: false;
};

export type ReviewedOfferDescriptionResult =
  | {
      workflowVersion: "offer-description-workflow-0.1.0";
      status: "blocked";
      claims: ProductClaim[];
      generation: Extract<DescriptionGenerationResult, { status: "blocked" }>;
    }
  | {
      workflowVersion: "offer-description-workflow-0.1.0";
      status: "generated";
      claims: ProductClaim[];
      generation: Extract<DescriptionGenerationResult, { status: "generated" }>;
      validation: DescriptionCandidateValidation;
    };

export const OFFER_DESCRIPTION_WORKFLOW_VERSION = "offer-description-workflow-0.1.0" as const;

export function prepareOfferDescriptionReview(input: GeoOfferInput): OfferDescriptionReview {
  return {
    workflowVersion: OFFER_DESCRIPTION_WORKFLOW_VERSION,
    audit: auditAllegroGeoOffer(input),
    claims: extractProductClaims(input),
    approvedClaimCount: 0,
    generationStarted: false,
  };
}

export function generateReviewedOfferDescription(
  input: GeoOfferInput,
  decisions: Record<
    string,
    Extract<ProductClaimReviewStatus, "approved" | "rejected">
  >,
): ReviewedOfferDescriptionResult {
  const claims = reviewProductClaims(extractProductClaims(input), decisions);
  const generation = generateGroundedDescriptionCandidate(input, claims);
  if (generation.status === "blocked") {
    return {
      workflowVersion: OFFER_DESCRIPTION_WORKFLOW_VERSION,
      status: "blocked",
      claims,
      generation,
    };
  }
  return {
    workflowVersion: OFFER_DESCRIPTION_WORKFLOW_VERSION,
    status: "generated",
    claims,
    generation,
    validation: validateDescriptionCandidate(input, generation.candidate, claims),
  };
}
