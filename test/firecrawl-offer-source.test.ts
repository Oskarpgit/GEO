import { describe, expect, it, vi } from "vitest";
import {
  canonicalAllegroOfferUrl,
  fetchAllegroOfferHtml,
  OfferSourceError,
} from "../apps/web/lib/allegro-offer-source.server.js";

const offerUrl =
  "https://allegro.pl/oferta/samsung-galaxy-z-flip8-f776-12-256gb-graphite-18858115151";

describe("źródło HTML oferty Allegro", () => {
  it("usuwa parametry śledzące, ale zachowuje pełne ID oferty", () => {
    const result = canonicalAllegroOfferUrl(`${offerUrl}?bi_s=ads&referrer=proxy#fragment`);

    expect(result.toString()).toBe(offerUrl);
  });

  it("odrzuca link bez numerycznego offer_id", () => {
    expect(() =>
      canonicalAllegroOfferUrl(
        "https://allegro.pl/oferta/samsung-galaxy-z-flip8-f776-12-256gb-graphite",
      ),
    ).toThrowError(OfferSourceError);
  });

  it("nie uruchamia Firecrawl, gdy zwykłe pobranie działa", async () => {
    const directFetch = vi.fn(async () =>
      new Response("<html><title>Oferta</title></html>", {
        status: 200,
        headers: { "content-type": "text/html" },
      }),
    );
    const firecrawlFetch = vi.fn();

    const result = await fetchAllegroOfferHtml(offerUrl, {
      directFetch,
      firecrawlFetch,
      firecrawlApiKey: "test-key",
    });

    expect(result.source).toBe("public_allegro_page");
    expect(result.html).toContain("Oferta");
    expect(firecrawlFetch).not.toHaveBeenCalled();
  });

  it("uruchamia oszczędny fallback Firecrawl po odpowiedzi 403", async () => {
    const directFetch = vi.fn(async () => new Response("Forbidden", { status: 403 }));
    const firecrawlFetch = vi.fn(async (_input: string | URL | Request, init?: RequestInit) => {
      const headers = new Headers(init?.headers);
      const body = JSON.parse(String(init?.body)) as Record<string, unknown>;
      expect(headers.get("Authorization")).toBe("Bearer test-key");
      expect(body).toMatchObject({
        url: offerUrl,
        formats: ["rawHtml"],
        onlyMainContent: false,
        onlyCleanContent: false,
        maxAge: 21_600_000,
        proxy: "basic",
        storeInCache: true,
      });
      return new Response(
        JSON.stringify({
          success: true,
          data: {
            rawHtml: "<html><title>Oferta z Firecrawl</title></html>",
            metadata: { url: offerUrl },
          },
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      );
    });

    const result = await fetchAllegroOfferHtml(`${offerUrl}?bi_s=ads`, {
      directFetch,
      firecrawlFetch,
      firecrawlApiKey: "test-key",
    });

    expect(result.source).toBe("firecrawl_allegro_page");
    expect(result.finalUrl.toString()).toBe(offerUrl);
    expect(result.html).toContain("Oferta z Firecrawl");
    expect(firecrawlFetch).toHaveBeenCalledOnce();
  });

  it("nie próbuje Firecrawl dla nieistniejącej oferty", async () => {
    const directFetch = vi.fn(async () => new Response("Not found", { status: 404 }));
    const firecrawlFetch = vi.fn();

    await expect(
      fetchAllegroOfferHtml(offerUrl, {
        directFetch,
        firecrawlFetch,
        firecrawlApiKey: "test-key",
      }),
    ).rejects.toMatchObject({ code: "offer_unavailable", httpStatus: 404 });
    expect(firecrawlFetch).not.toHaveBeenCalled();
  });

  it("zwraca czytelny błąd, gdy fallback nie ma klucza", async () => {
    const directFetch = vi.fn(async () => new Response("Forbidden", { status: 403 }));

    await expect(fetchAllegroOfferHtml(offerUrl, { directFetch })).rejects.toMatchObject({
      code: "firecrawl_not_configured",
      httpStatus: 503,
    });
  });

  it("nie ujawnia odpowiedzi Firecrawl przy braku kredytów", async () => {
    const directFetch = vi.fn(async () => new Response("Forbidden", { status: 403 }));
    const firecrawlFetch = vi.fn(async () =>
      new Response('{"error":"account details must stay private"}', { status: 402 }),
    );

    await expect(
      fetchAllegroOfferHtml(offerUrl, {
        directFetch,
        firecrawlFetch,
        firecrawlApiKey: "test-key",
      }),
    ).rejects.toMatchObject({
      code: "firecrawl_credits_exhausted",
      message: "Limit kredytów Firecrawl został wyczerpany.",
    });
  });
});
