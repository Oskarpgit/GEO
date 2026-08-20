import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { parseAllegroOffer } from "../src/parser/allegro-offer.js";

const fixturePath = fileURLToPath(new URL("./fixtures/allegro-philips-ep2334.html", import.meta.url));
const html = readFileSync(fixturePath, "utf8");

describe("parseAllegroOffer", () => {
  it("extracts identity, commerce and product group without sales inference", () => {
    const snapshot = parseAllegroOffer({
      url: "https://allegro.pl/oferta/ekspres-philips-18479049815",
      html,
      capturedAt: "2026-08-20T12:00:00+02:00",
    });

    expect(snapshot.offerId).toBe("18479049815");
    expect(snapshot.productId).toBe("4e228672-df75-4385-99e4-1aeedc87aa4d");
    expect(snapshot.identity).toMatchObject({
      brand: "Philips",
      model: "EP 2334/10",
      manufacturerCode: "EP2334/10",
      gtin: "8720389030291",
    });
    expect(snapshot.commerce.price).toBe(1449);
    expect(snapshot.commerce.smart).toBe(true);
    expect(snapshot.productGroup.comparedOfferCount).toBe(38);
    expect(snapshot.seller).toMatchObject({
      name: "LUM_COM_PL",
      recommendedPercent: 98.6,
      ratingCount: 634,
      superSeller: true,
    });
    expect(snapshot.content.descriptionText).toContain("świeżo mielonych ziaren");
    expect(snapshot.evidence[0]?.contentHash).toMatch(/^[a-f0-9]{64}$/u);
  });

  it("fails loudly when the page cannot be identified as an Allegro offer", () => {
    expect(() =>
      parseAllegroOffer({
        url: "https://allegro.pl/oferta/bez-identyfikatora",
        html: "<html><body><h1>Przykładowy produkt</h1></body></html>",
        capturedAt: "2026-08-20T12:00:00+02:00",
      }),
    ).toThrow(/identyfikatora oferty/iu);
  });

  it("reads an offer id from product-page query parameters", () => {
    const snapshot = parseAllegroOffer({
      url: "https://allegro.pl/produkt/kamera-sportowa-123?offerId=18816079967",
      html: "<html><body><h1>Kamera GoPro HERO13 Black</h1></body></html>",
      capturedAt: "2026-08-20T12:00:00+02:00",
    });

    expect(snapshot.offerId).toBe("18816079967");
  });

  it("matches product images when Allegro double-encodes entities in alt text", () => {
    const snapshot = parseAllegroOffer({
      url: "https://allegro.pl/oferta/tablet-samsung-18816079968",
      html: `
        <html><body>
          <h1>Tablet Samsung Galaxy Tab S10 FE 10,9&quot; 8 GB / 128 GB szary</h1>
          <img
            alt="Tablet Samsung Galaxy Tab S10 FE 10,9&amp;amp;quot; 8 GB / 128 GB szary"
            src="https://a.allegroimg.com/original/product-image.jpg"
          >
        </body></html>
      `,
      capturedAt: "2026-08-20T12:00:00+02:00",
    });

    expect(snapshot.content.imageUrls).toEqual([
      "https://a.allegroimg.com/original/product-image.jpg",
    ]);
  });
});
