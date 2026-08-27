import { createHash } from "node:crypto";
import { extractGeoFeatures } from "../scoring/features.js";
import type { GeoOfferInput } from "../scoring/types.js";
import type {
  ProductClaim,
  ProductClaimKind,
  ProductClaimReviewStatus,
} from "./types.js";

function normalized(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/\p{M}/gu, "")
    .toLocaleLowerCase("pl-PL")
    .replace(/[^\p{L}\p{N}]+/gu, "-")
    .replace(/^-|-$/gu, "");
}

function scalarText(value: unknown): string | undefined {
  if (typeof value === "string") {
    const text = value.replace(/\s+/gu, " ").trim();
    return text || undefined;
  }
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  if (typeof value === "boolean") return value ? "tak" : "nie";
  if (Array.isArray(value)) {
    const values = value.map(scalarText).filter((item): item is string => Boolean(item));
    return values.length > 0 ? values.join(", ") : undefined;
  }
  return undefined;
}

function hash(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function claim(
  kind: ProductClaimKind,
  labelPl: string,
  value: string,
  sourceKind: ProductClaim["source"]["kind"],
  path: string,
  source: GeoOfferInput["source"],
): ProductClaim {
  const fingerprint = `${kind}\u0000${path}\u0000${value}`;
  return {
    claimId: `claim_${normalized(kind)}_${hash(fingerprint).slice(0, 16)}`,
    kind,
    labelPl,
    value,
    source: {
      kind: sourceKind,
      path,
      contentHash: hash(value),
      ...(source?.snapshotId ? { snapshotId: source.snapshotId } : {}),
      evidenceIds: source?.evidenceIds ?? [],
    },
    reviewStatus: "source_backed",
  };
}

const identityParameterNames = new Set([
  "brand",
  "ean",
  "ean-gtin",
  "gtin",
  "kod-producenta",
  "manufacturer-code",
  "marka",
  "model",
  "mpn",
]);

export function extractProductClaims(input: GeoOfferInput): ProductClaim[] {
  const claims: ProductClaim[] = [];
  const identity = extractGeoFeatures(input).identity;
  const parametersRecord = input.parameters ?? {};
  const findParameterSource = (names: string[]) => {
    const expected = new Set(names.map(normalized));
    return Object.entries(parametersRecord).find(([key]) => expected.has(normalized(key)));
  };
  const identityFields: Array<{
    kind: Exclude<ProductClaimKind, "parameter">;
    labelPl: string;
    explicitValue: unknown;
    inferredValue: unknown;
    identityPath: string;
    parameterNames: string[];
  }> = [
    {
      kind: "brand",
      labelPl: "Marka",
      explicitValue: input.identity?.brand,
      inferredValue: identity.brand,
      identityPath: "identity.brand",
      parameterNames: ["marka", "brand"],
    },
    {
      kind: "model",
      labelPl: "Model",
      explicitValue: input.identity?.model,
      inferredValue: identity.model,
      identityPath: "identity.model",
      parameterNames: ["model"],
    },
    {
      kind: "manufacturer_code",
      labelPl: "Kod producenta",
      explicitValue: input.identity?.manufacturerCode,
      inferredValue: identity.manufacturerCode,
      identityPath: "identity.manufacturerCode",
      parameterNames: ["kod producenta", "manufacturer code", "mpn"],
    },
    {
      kind: "gtin",
      labelPl: "GTIN",
      explicitValue: input.identity?.gtin,
      inferredValue: identity.gtin,
      identityPath: "identity.gtin",
      parameterNames: ["ean", "ean (gtin)", "gtin"],
    },
  ];
  for (const field of identityFields) {
    const explicitValue = scalarText(field.explicitValue);
    const value = explicitValue ?? scalarText(field.inferredValue);
    if (!value) continue;
    const parameterSource = explicitValue ? undefined : findParameterSource(field.parameterNames);
    claims.push(
      claim(
        field.kind,
        field.labelPl,
        value,
        parameterSource ? "offer_parameter" : "offer_identity",
        parameterSource ? `parameters.${parameterSource[0]}` : field.identityPath,
        input.source,
      ),
    );
  }

  const parameters = Object.entries(parametersRecord).sort(([left], [right]) =>
    normalized(left).localeCompare(normalized(right), "pl-PL"),
  );
  for (const [label, rawValue] of parameters) {
    if (identityParameterNames.has(normalized(label))) continue;
    const value = scalarText(rawValue);
    if (!value) continue;
    claims.push(
      claim("parameter", label.trim(), value, "offer_parameter", `parameters.${label}`, input.source),
    );
  }

  return claims;
}

export function reviewProductClaims(
  claims: ProductClaim[],
  decisions: Record<string, Extract<ProductClaimReviewStatus, "approved" | "rejected">>,
): ProductClaim[] {
  const knownIds = new Set(claims.map((item) => item.claimId));
  const unknownIds = Object.keys(decisions).filter((claimId) => !knownIds.has(claimId));
  if (unknownIds.length > 0) {
    throw new Error(`Nie można ocenić nieznanych claimIds: ${unknownIds.join(", ")}.`);
  }
  return claims.map((item) => {
    const decision = decisions[item.claimId];
    return decision ? { ...item, reviewStatus: decision } : item;
  });
}
