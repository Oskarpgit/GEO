import type {
  GeoIdentityField,
  GeoIdentitySource,
  GeoOfferInput,
} from "../../scoring/types.js";
import type {
  AllegroIdentityBundle,
  AllegroIdentityEnrichmentResult,
  AllegroIdentityIssue,
  AllegroParameter,
  AllegroPayloadEvidence,
} from "./types.js";

export const ALLEGRO_IDENTITY_ADAPTER_VERSION = "allegro-identity-adapter-0.1.0" as const;

type IdentityCandidate = {
  value: string;
  source: GeoIdentitySource;
};

const parameterNames: Record<GeoIdentityField, string[]> = {
  brand: ["brand", "marka", "marka produktu", "marka telefonu"],
  model: ["model", "model produktu", "model telefonu"],
  manufacturerCode: ["kod producenta", "manufacturer code", "mpn"],
  gtin: ["ean", "ean gtin", "gtin"],
};

function normalized(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/\p{M}/gu, "")
    .toLocaleLowerCase("pl-PL")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .replace(/\s+/gu, " ")
    .trim();
}

function scalarParameterValue(parameter: AllegroParameter): string | undefined {
  const values = parameter.values
    ?.map((value) => String(value).replace(/\s+/gu, " ").trim())
    .filter(Boolean);
  if (values && values.length > 0) return values.join(", ");
  const from = parameter.rangeValue?.from;
  const to = parameter.rangeValue?.to;
  if (from !== undefined && to !== undefined) return `${String(from)}–${String(to)}`;
  if (from !== undefined) return String(from);
  if (to !== undefined) return String(to);
  return undefined;
}

function findParameter(
  parameters: AllegroParameter[] | null | undefined,
  field: GeoIdentityField,
): { index: number; parameter: AllegroParameter; value: string } | undefined {
  const expectedNames = new Set(parameterNames[field].map(normalized));
  for (const [index, parameter] of (parameters ?? []).entries()) {
    if (!parameter.name || !expectedNames.has(normalized(parameter.name))) continue;
    const value = scalarParameterValue(parameter);
    if (value) return { index, parameter, value };
  }
  return undefined;
}

function candidateFromParameters(
  parameters: AllegroParameter[] | null | undefined,
  field: GeoIdentityField,
  kind: Extract<
    GeoIdentitySource["kind"],
    "allegro_catalog_parameter" | "allegro_product_offer_parameter"
  >,
  pathPrefix: string,
  evidence: AllegroPayloadEvidence,
): IdentityCandidate | undefined {
  const found = findParameter(parameters, field);
  if (!found) return undefined;
  return {
    value: found.value,
    source: {
      kind,
      path: `${pathPrefix}[${found.index}]`,
      snapshotId: evidence.snapshotId,
      evidenceIds: [...evidence.evidenceIds],
    },
  };
}

function conflictIssue(
  field: GeoIdentityField,
  catalog: IdentityCandidate,
  offer: IdentityCandidate,
): AllegroIdentityIssue | undefined {
  if (normalized(catalog.value) === normalized(offer.value)) return undefined;
  return {
    code: "identity_field_conflict",
    severity: "blocker",
    field,
    messagePl:
      `Pole ${field} ma sprzeczne wartości w Katalogu Allegro i ofercie sprzedawcy. ` +
      "Wymagane jest wyjaśnienie konfliktu przed generowaniem.",
  };
}

export function enrichGeoOfferIdentityFromAllegro(
  baseInput: GeoOfferInput,
  bundle: AllegroIdentityBundle,
): AllegroIdentityEnrichmentResult {
  const productSet = bundle.offer.productSet ?? [];
  if (productSet.length === 0 || !productSet[0]?.product) {
    return {
      status: "blocked",
      adapterVersion: ALLEGRO_IDENTITY_ADAPTER_VERSION,
      issues: [
        {
          code: "missing_product_set",
          severity: "blocker",
          messagePl: "Oferta nie zawiera produktu w productSet[].",
        },
      ],
    };
  }
  if (productSet.length !== 1) {
    return {
      status: "blocked",
      adapterVersion: ALLEGRO_IDENTITY_ADAPTER_VERSION,
      issues: [
        {
          code: "unsupported_product_set",
          severity: "blocker",
          messagePl: "Generator v0.1 nie obsługuje zestawów złożonych z wielu produktów.",
        },
      ],
    };
  }

  const offerProduct = productSet[0].product;
  const productId = offerProduct.id?.trim();
  if (!productId) {
    return {
      status: "blocked",
      adapterVersion: ALLEGRO_IDENTITY_ADAPTER_VERSION,
      issues: [
        {
          code: "missing_product_id",
          severity: "blocker",
          messagePl: "Oferta nie ma identyfikatora produktu Allegro; nie można potwierdzić tożsamości.",
        },
      ],
    };
  }
  const catalogProductId = bundle.catalogProduct?.id?.trim();
  if (catalogProductId && normalized(catalogProductId) !== normalized(productId)) {
    return {
      status: "blocked",
      adapterVersion: ALLEGRO_IDENTITY_ADAPTER_VERSION,
      issues: [
        {
          code: "catalog_product_id_mismatch",
          severity: "blocker",
          messagePl: "Odpowiedź Katalogu dotyczy innego produktu niż produkt przypisany do oferty.",
        },
      ],
    };
  }

  const identity: NonNullable<GeoOfferInput["identity"]> = {
    ...baseInput.identity,
  };
  const identitySources: NonNullable<GeoOfferInput["identitySources"]> = {
    ...baseInput.identitySources,
  };
  const issues: AllegroIdentityIssue[] = [];
  const populatedFields: GeoIdentityField[] = [];
  const fields: GeoIdentityField[] = ["brand", "model", "manufacturerCode", "gtin"];

  for (const field of fields) {
    const catalogCandidate = bundle.catalogProduct && bundle.catalogEvidence
      ? candidateFromParameters(
          bundle.catalogProduct.parameters,
          field,
          "allegro_catalog_parameter",
          "catalogProduct.parameters",
          bundle.catalogEvidence,
        )
      : undefined;
    const offerCandidate = candidateFromParameters(
      offerProduct.parameters,
      field,
      "allegro_product_offer_parameter",
      "offer.productSet[0].product.parameters",
      bundle.offerEvidence,
    );
    if (catalogCandidate && offerCandidate) {
      const conflict = conflictIssue(field, catalogCandidate, offerCandidate);
      if (conflict) issues.push(conflict);
    }
    const selected = catalogCandidate ?? offerCandidate;
    if (!selected) continue;
    identity[field] = selected.value;
    identitySources[field] = selected.source;
    populatedFields.push(field);
  }

  const blockingIssues = issues.filter((issue) => issue.severity === "blocker");
  if (blockingIssues.length > 0) {
    return {
      status: "blocked",
      adapterVersion: ALLEGRO_IDENTITY_ADAPTER_VERSION,
      issues,
    };
  }
  if (!identity.brand) {
    issues.push({
      code: "missing_brand",
      severity: "warning",
      field: "brand",
      messagePl: "Katalog i oferta nie zawierają strukturalnej marki.",
    });
  }
  if (!identity.model) {
    issues.push({
      code: "missing_model",
      severity: "warning",
      field: "model",
      messagePl: "Katalog i oferta nie zawierają strukturalnego modelu.",
    });
  }

  return {
    status: identity.brand && identity.model ? "ready_for_claim_review" : "partial",
    adapterVersion: ALLEGRO_IDENTITY_ADAPTER_VERSION,
    productId,
    input: {
      ...baseInput,
      ...(bundle.offer.name ? { title: bundle.offer.name } : {}),
      identity,
      identitySources,
    },
    populatedFields,
    issues,
    claimsStillRequireReview: true,
  };
}

