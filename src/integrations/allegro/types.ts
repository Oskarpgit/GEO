import type { GeoIdentityField, GeoOfferInput } from "../../scoring/types.js";

export type AllegroParameter = {
  id?: string;
  name?: string;
  values?: Array<string | number>;
  valuesIds?: string[];
  rangeValue?: {
    from?: string | number;
    to?: string | number;
  };
  options?: {
    identifiesProduct?: boolean;
  };
};

export type AllegroProduct = {
  id?: string;
  name?: string;
  category?: { id?: string };
  parameters?: AllegroParameter[] | null;
};

export type AllegroProductOffer = {
  id?: string;
  name?: string;
  category?: { id?: string };
  productSet?: Array<{
    product?: AllegroProduct | null;
    quantity?: { value?: number };
  }> | null;
  parameters?: AllegroParameter[] | null;
};

export type AllegroPayloadEvidence = {
  snapshotId: string;
  evidenceIds: string[];
};

export type AllegroIdentityBundle = {
  offer: AllegroProductOffer;
  offerEvidence: AllegroPayloadEvidence;
  catalogProduct?: AllegroProduct;
  catalogEvidence?: AllegroPayloadEvidence;
};

export type AllegroIdentityIssueCode =
  | "missing_product_set"
  | "unsupported_product_set"
  | "missing_product_id"
  | "catalog_product_id_mismatch"
  | "identity_field_conflict"
  | "missing_brand"
  | "missing_model";

export type AllegroIdentityIssue = {
  code: AllegroIdentityIssueCode;
  severity: "blocker" | "warning";
  field?: GeoIdentityField;
  messagePl: string;
};

export type AllegroIdentityEnrichmentResult =
  | {
      status: "blocked";
      adapterVersion: "allegro-identity-adapter-0.1.0";
      issues: AllegroIdentityIssue[];
    }
  | {
      status: "ready_for_claim_review" | "partial";
      adapterVersion: "allegro-identity-adapter-0.1.0";
      productId: string;
      input: GeoOfferInput;
      populatedFields: GeoIdentityField[];
      issues: AllegroIdentityIssue[];
      claimsStillRequireReview: true;
    };

export type AllegroApiIdentityBundle = AllegroIdentityBundle & {
  fetchedAt: string;
};

