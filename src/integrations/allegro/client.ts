import { createHash } from "node:crypto";
import type {
  AllegroApiIdentityBundle,
  AllegroPayloadEvidence,
  AllegroProduct,
  AllegroProductOffer,
} from "./types.js";

export type AllegroApiEnvironment = "production" | "sandbox";

export type AllegroIdentityClientOptions = {
  accessToken: string;
  environment?: AllegroApiEnvironment;
  fetchImpl?: typeof fetch;
  now?: () => Date;
};

export class AllegroApiError extends Error {
  readonly status: number;
  readonly endpoint: string;

  constructor(status: number, endpoint: string) {
    super(`Allegro API zwróciło HTTP ${status} dla ${endpoint}.`);
    this.name = "AllegroApiError";
    this.status = status;
    this.endpoint = endpoint;
  }
}

function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function apiBaseUrl(environment: AllegroApiEnvironment): string {
  return environment === "sandbox"
    ? "https://api.allegro.pl.allegrosandbox.pl"
    : "https://api.allegro.pl";
}

function evidence(kind: "offer" | "product", resourceId: string, rawBody: string): AllegroPayloadEvidence {
  const contentHash = sha256(rawBody);
  return {
    snapshotId: `allegro-${kind}:${resourceId}:${contentHash.slice(0, 16)}`,
    evidenceIds: [`sha256:${contentHash}`],
  };
}

async function fetchObject(
  fetchImpl: typeof fetch,
  url: URL,
  accessToken: string,
): Promise<{ payload: Record<string, unknown>; rawBody: string }> {
  const response = await fetchImpl(url, {
    method: "GET",
    headers: {
      Accept: "application/vnd.allegro.public.v1+json",
      "Accept-Language": "pl-PL",
      Authorization: `Bearer ${accessToken}`,
    },
  });
  if (!response.ok) throw new AllegroApiError(response.status, url.pathname);
  const rawBody = await response.text();
  let payload: unknown;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    throw new Error(`Allegro API zwróciło niepoprawny JSON dla ${url.pathname}.`);
  }
  if (!isRecord(payload)) {
    throw new Error(`Allegro API zwróciło niepoprawny obiekt dla ${url.pathname}.`);
  }
  return { payload, rawBody };
}

export async function fetchAllegroIdentityBundle(
  offerId: string,
  options: AllegroIdentityClientOptions,
): Promise<AllegroApiIdentityBundle> {
  const normalizedOfferId = offerId.trim();
  if (!/^\d+$/u.test(normalizedOfferId)) {
    throw new Error("Identyfikator oferty Allegro musi składać się wyłącznie z cyfr.");
  }
  const accessToken = options.accessToken.trim();
  if (!accessToken) throw new Error("Brak tokena dostępu Allegro.");
  const fetchImpl = options.fetchImpl ?? fetch;
  const baseUrl = apiBaseUrl(options.environment ?? "production");
  const offerUrl = new URL(`/sale/product-offers/${normalizedOfferId}`, baseUrl);
  const offerResponse = await fetchObject(fetchImpl, offerUrl, accessToken);
  const offer = offerResponse.payload as AllegroProductOffer;
  const offerEvidence = evidence("offer", normalizedOfferId, offerResponse.rawBody);
  const productId = offer.productSet?.[0]?.product?.id?.trim();
  if (!productId) {
    return {
      offer,
      offerEvidence,
      fetchedAt: (options.now ?? (() => new Date()))().toISOString(),
    };
  }

  const productUrl = new URL(`/sale/products/${encodeURIComponent(productId)}`, baseUrl);
  productUrl.searchParams.set("language", "pl-PL");
  const productResponse = await fetchObject(fetchImpl, productUrl, accessToken);
  const catalogProduct = productResponse.payload as AllegroProduct;
  return {
    offer,
    offerEvidence,
    catalogProduct,
    catalogEvidence: evidence("product", productId, productResponse.rawBody),
    fetchedAt: (options.now ?? (() => new Date()))().toISOString(),
  };
}

