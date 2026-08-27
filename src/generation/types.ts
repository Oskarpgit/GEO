import type { ValidationSummary } from "../domain/types.js";

export type ProductClaimKind =
  | "brand"
  | "model"
  | "manufacturer_code"
  | "gtin"
  | "parameter";

export type ProductClaimReviewStatus = "source_backed" | "approved" | "rejected";

export type ProductClaim = {
  claimId: string;
  kind: ProductClaimKind;
  labelPl: string;
  value: string;
  source: {
    kind: "offer_identity" | "offer_parameter";
    path: string;
    contentHash: string;
    snapshotId?: string;
    evidenceIds: string[];
  };
  reviewStatus: ProductClaimReviewStatus;
};

export type DescriptionTemplateId = "identity_statement" | "fact_statement";

export type DescriptionCandidateBlock = {
  blockId: string;
  type: "paragraph" | "bullet";
  templateId: DescriptionTemplateId;
  text: string;
  claimIds: string[];
};

export type DescriptionCandidateSection = {
  sectionId:
    | "identity"
    | "technical_specification"
    | "operation_and_maintenance"
    | "compatibility_and_limits"
    | "package_contents";
  headingPl: string;
  blocks: DescriptionCandidateBlock[];
};

export type DescriptionCandidate = {
  candidateId: string;
  generatorVersion: "grounded-description-0.1.0";
  title: string;
  sections: DescriptionCandidateSection[];
};

export type OmittedClaim = {
  claimId: string;
  reason: "not_approved" | "field_not_allowed_in_description";
};

export type DescriptionGenerationResult =
  | {
      status: "generated";
      candidate: DescriptionCandidate;
      usedClaimIds: string[];
      omittedClaims: OmittedClaim[];
    }
  | {
      status: "blocked";
      reasons: string[];
      usedClaimIds: [];
      omittedClaims: OmittedClaim[];
    };

export type CandidateProvenanceViolation = {
  blockId: string;
  code:
    | "duplicate_block_id"
    | "duplicate_section_id"
    | "invalid_section_heading"
    | "invalid_block_type"
    | "missing_claim"
    | "claim_not_approved"
    | "claim_source_mismatch"
    | "invalid_claim_count"
    | "text_not_reproducible"
    | "title_source_mismatch";
  messagePl: string;
};

export type DescriptionCandidateValidation = {
  validatorVersion: "grounded-description-validator-0.1.0";
  status: "failed" | "needs_review" | "passed";
  provenanceValid: boolean;
  provenanceViolations: CandidateProvenanceViolation[];
  allegro: ValidationSummary;
  renderedDescription: string;
  readyForHumanReview: boolean;
  readyForUse: boolean;
};
