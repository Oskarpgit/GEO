import { describe, expect, it, vi } from "vitest";
import { extractProductClaims } from "../src/generation/claims.js";
import { generateGroundedDescriptionCandidate } from "../src/generation/generator.js";
import {
  AllegroApiError,
  fetchAllegroIdentityBundle,
} from "../src/integrations/allegro/client.js";
import { enrichGeoOfferIdentityFromAllegro } from "../src/integrations/allegro/product-identity.js";
import type { AllegroIdentityBundle } from "../src/integrations/allegro/types.js";

const offerEvidence = {
  snapshotId: "offer-snapshot-1",
  evidenceIds: ["sha256:offer"],
};
const catalogEvidence = {
  snapshotId: "catalog-snapshot-1",
  evidenceIds: ["sha256:catalog"],
};

function identityBundle(): AllegroIdentityBundle {
  return {
    offer: {
      id: "1234567890",
      name: "Ekspres automatyczny Philips LatteGo EP2334/10",
      productSet: [
        {
          product: {
            id: "product-uuid-1",
            parameters: [
              { id: "1", name: "Marka", values: ["Philips"] },
              { id: "2", name: "Model", values: ["EP2334/10"] },
            ],
          },
        },
      ],
    },
    offerEvidence,
    catalogProduct: {
      id: "product-uuid-1",
      parameters: [
        {
          id: "1",
          name: "Marka",
          values: ["Philips"],
          options: { identifiesProduct: true },
        },
        {
          id: "2",
          name: "Model",
          values: ["EP2334/10"],
          options: { identifiesProduct: true },
        },
        {
          id: "3",
          name: "Kod producenta",
          values: ["EP2334/10"],
          options: { identifiesProduct: true },
        },
        {
          id: "4",
          name: "EAN (GTIN)",
          values: ["8720389030291"],
          options: { identifiesProduct: true },
        },
      ],
    },
    catalogEvidence,
  };
}

describe("Allegro product identity adapter", () => {
  it("populates identity with field-level catalog provenance but does not approve claims", () => {
    const result = enrichGeoOfferIdentityFromAllegro(
      { title: "stary tytuł", parameters: { Moc: "1500 W" } },
      identityBundle(),
    );

    expect(result.status).toBe("ready_for_claim_review");
    if (result.status === "blocked") return;
    expect(result.productId).toBe("product-uuid-1");
    expect(result.input.identity).toEqual({
      brand: "Philips",
      model: "EP2334/10",
      manufacturerCode: "EP2334/10",
      gtin: "8720389030291",
    });
    expect(result.input.identitySources?.brand).toEqual({
      kind: "allegro_catalog_parameter",
      path: "catalogProduct.parameters[0]",
      snapshotId: "catalog-snapshot-1",
      evidenceIds: ["sha256:catalog"],
    });
    const claims = extractProductClaims(result.input);
    const brand = claims.find((claim) => claim.kind === "brand");
    expect(brand).toMatchObject({
      value: "Philips",
      reviewStatus: "source_backed",
      source: {
        kind: "allegro_catalog_parameter",
        path: "catalogProduct.parameters[0]",
        snapshotId: "catalog-snapshot-1",
      },
    });
    expect(generateGroundedDescriptionCandidate(result.input, claims).status).toBe("blocked");
  });

  it("blocks conflicting catalog and seller-offer identities", () => {
    const bundle = identityBundle();
    const product = bundle.offer.productSet?.[0]?.product;
    if (!product) throw new Error("Brak produktu testowego.");
    product.parameters = [
      { name: "Marka", values: ["Inna marka"] },
      { name: "Model", values: ["EP2334/10"] },
    ];

    const result = enrichGeoOfferIdentityFromAllegro({ title: "Oferta" }, bundle);

    expect(result.status).toBe("blocked");
    expect(result.issues).toContainEqual(
      expect.objectContaining({ code: "identity_field_conflict", field: "brand" }),
    );
  });

  it("blocks multi-product sets until a dedicated generator exists", () => {
    const bundle = identityBundle();
    bundle.offer.productSet?.push({ product: { id: "product-uuid-2", parameters: [] } });

    const result = enrichGeoOfferIdentityFromAllegro({ title: "Zestaw" }, bundle);

    expect(result.status).toBe("blocked");
    expect(result.issues).toContainEqual(
      expect.objectContaining({ code: "unsupported_product_set" }),
    );
  });

  it("never infers a missing brand from the offer title", () => {
    const bundle = identityBundle();
    const offerProduct = bundle.offer.productSet?.[0]?.product;
    if (!offerProduct || !bundle.catalogProduct) throw new Error("Brak produktu testowego.");
    offerProduct.parameters = [{ name: "Model", values: ["EP2334/10"] }];
    bundle.catalogProduct.parameters = [{ name: "Model", values: ["EP2334/10"] }];

    const result = enrichGeoOfferIdentityFromAllegro(
      { title: "Philips EP2334/10" },
      bundle,
    );

    expect(result.status).toBe("partial");
    if (result.status === "blocked") return;
    expect(result.input.identity?.brand).toBeUndefined();
    expect(result.issues).toContainEqual(expect.objectContaining({ code: "missing_brand" }));
  });
});

describe("Allegro identity API client", () => {
  it("fetches the seller offer and linked catalog product without persisting the token", async () => {
    const token = "secret-test-token";
    const fetchImpl = vi.fn<typeof fetch>(async (input, init) => {
      const url = String(input);
      expect(new Headers(init?.headers).get("Authorization")).toBe(`Bearer ${token}`);
      if (url.includes("/sale/product-offers/1234567890")) {
        return new Response(
          JSON.stringify({
            id: "1234567890",
            productSet: [{ product: { id: "product-uuid-1", parameters: [] } }],
          }),
          { status: 200 },
        );
      }
      expect(url).toContain("/sale/products/product-uuid-1?language=pl-PL");
      return new Response(JSON.stringify({ id: "product-uuid-1", parameters: [] }), {
        status: 200,
      });
    });

    const result = await fetchAllegroIdentityBundle("1234567890", {
      accessToken: token,
      fetchImpl,
      now: () => new Date("2026-08-27T12:00:00.000Z"),
    });

    expect(fetchImpl).toHaveBeenCalledTimes(2);
    expect(result.catalogProduct?.id).toBe("product-uuid-1");
    expect(result.offerEvidence.evidenceIds[0]).toMatch(/^sha256:[a-f0-9]{64}$/u);
    expect(result.fetchedAt).toBe("2026-08-27T12:00:00.000Z");
    expect(JSON.stringify(result)).not.toContain(token);
  });

  it("returns a sanitized API error without response bodies or credentials", async () => {
    const fetchImpl = vi.fn<typeof fetch>(async () =>
      new Response('{"error":"do not expose"}', { status: 401 }),
    );

    const promise = fetchAllegroIdentityBundle("1234567890", {
      accessToken: "secret-test-token",
      fetchImpl,
    });

    await expect(promise).rejects.toBeInstanceOf(AllegroApiError);
    await expect(promise).rejects.not.toThrow(/secret-test-token|do not expose/iu);
  });
});

