import { createHash } from "node:crypto";
import * as cheerio from "cheerio";
import type { OfferSnapshot } from "../domain/types.js";

export type AllegroOfferDocument = {
  url: string;
  html: string;
  capturedAt: string;
};

function normalizedText(value: string | undefined): string {
  return (value ?? "").replace(/\u00a0/g, " ").replace(/\s+/g, " ").trim();
}

function parsePolishPrice(value: string | undefined): number | undefined {
  if (!value) return undefined;
  const match = value.match(/(\d[\d\s.]*)[,.](\d{2})\s*zł/u);
  if (!match?.[1] || !match[2]) return undefined;
  const integer = match[1].replace(/[\s.]/g, "");
  const parsed = Number(`${integer}.${match[2]}`);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function extractOfferId(url: string, pageText: string): string {
  const fromUrl = url.match(/-(\d{8,})(?:[?#/]|$)/u)?.[1];
  const fromText = pageText.match(/Numer oferty:\s*(\d{8,})/iu)?.[1];
  const offerId = fromUrl ?? fromText;
  if (!offerId) throw new Error("Nie znaleziono identyfikatora oferty Allegro.");
  return offerId;
}

function extractProductId($: cheerio.CheerioAPI): string | undefined {
  for (const element of $("a[href*='/oferty-produktu/'], a[href*='/produkt/']").toArray()) {
    const href = $(element).attr("href");
    const uuid = href?.match(/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/iu)?.[1];
    if (uuid) return uuid.toLocaleLowerCase("en-US");
  }
  return undefined;
}

function extractParameters($: cheerio.CheerioAPI): Record<string, string> {
  const parameters: Record<string, string> = {};
  $("table tr").each((_, row) => {
    const cells = $(row)
      .find("th,td")
      .toArray()
      .map((cell) => normalizedText($(cell).text()));
    const label = cells[0];
    const value = cells[1];
    if (label && value) parameters[label] = value;
  });
  return parameters;
}

function findParameter(parameters: Record<string, string>, names: string[]): string | undefined {
  const normalizedNames = names.map((name) => name.toLocaleLowerCase("pl-PL"));
  return Object.entries(parameters).find(([key]) =>
    normalizedNames.includes(key.toLocaleLowerCase("pl-PL")),
  )?.[1];
}

function extractDescription($: cheerio.CheerioAPI): string {
  const heading = $("h2, h3").filter((_, element) => normalizedText($(element).text()) === "Opis").first();
  if (heading.length === 0) return "";

  const section = heading.closest("section");
  if (section.length > 0) return normalizedText(section.text()).replace(/^Opis\s*/u, "");

  const pieces: string[] = [];
  let current = heading.next();
  while (current.length > 0 && !current.is("h2,h3")) {
    pieces.push(current.text());
    current = current.next();
  }
  return normalizedText(pieces.join(" "));
}

function extractSeller($: cheerio.CheerioAPI, pageText: string): OfferSnapshot["seller"] {
  const sellerLink = $(
    "a[data-analytics-interaction-label='sellerLogoLink'], a[href*='/uzytkownik/']",
  ).first();
  const name =
    sellerLink.attr("data-analytics-interaction-value") ??
    sellerLink.attr("href")?.match(/\/uzytkownik\/([^/?#]+)/u)?.[1] ??
    pageText.match(
      /Sprzedaż i wysyłka(?:\s+Sprzedaż i wysyłka)?\s+([\p{L}\p{N}_.-]{2,})/iu,
    )?.[1];
  const sellerSection = sellerLink.closest("[data-box-name*='sellerInfo']");
  const sellerText = normalizedText(sellerSection.length > 0 ? sellerSection.text() : "");
  const ratingContext = sellerText || pageText;
  const recommended = ratingContext.match(
    /Poleca(?: sprzedającego)?:?\s*(\d{1,3}[,.]\d)%/iu,
  )?.[1];
  const rating = ratingContext.match(/([\d\s,.]+)\s+ocen(?:a|y)?/iu)?.[1];

  return {
    ...(name ? { name } : {}),
    ...(recommended ? { recommendedPercent: Number(recommended.replace(",", ".")) } : {}),
    ...(rating ? { ratingCount: Number(rating.replace(/[\s,.]/g, "")) } : {}),
    superSeller: /Super Sprzedawc/iu.test(pageText),
    officialStore: /Oficjalny sklep/iu.test(pageText),
  };
}

export function parseAllegroOffer(document: AllegroOfferDocument): OfferSnapshot {
  const $ = cheerio.load(document.html);
  $("script,style,noscript").remove();
  const pageText = normalizedText($("body").text());
  const title = normalizedText($("h1").first().text());
  if (!title) throw new Error("Nie znaleziono tytułu oferty Allegro.");

  const offerId = extractOfferId(document.url, pageText);
  const parameters = extractParameters($);
  const categoryPath = $("nav a")
    .toArray()
    .map((link) => normalizedText($(link).text()))
    .filter((item) => item && item !== "Allegro");
  const imageUrls = $("img")
    .toArray()
    .filter((image) => normalizedText($(image).attr("alt")).startsWith(title))
    .map((image) => $(image).attr("src"))
    .filter((url): url is string => Boolean(url?.startsWith("http") && !url.endsWith(".svg")));
  const comparedOfferCount = pageText.match(/Ten produkt od innych sprzedających\s*\((\d+)\)/iu)?.[1];
  const priceContext = $("h1").first().parent().text() || pageText;
  const price = parsePolishPrice(priceContext) ?? parsePolishPrice(pageText);
  const htmlHash = createHash("sha256").update(document.html).digest("hex");
  const productId = extractProductId($);
  const gtin = findParameter(parameters, ["EAN (GTIN)", "GTIN", "EAN"]);
  const brand = findParameter(parameters, ["Marka"]);
  const model = findParameter(parameters, ["Model"]);
  const manufacturerCode = findParameter(parameters, ["Kod producenta"]);

  return {
    snapshotId: `allegro:${offerId}:${htmlHash.slice(0, 16)}`,
    offerId,
    ...(productId ? { productId } : {}),
    marketplace: "allegro-pl",
    capturedAt: document.capturedAt,
    sourceUrl: document.url,
    seller: extractSeller($, pageText),
    identity: {
      title,
      ...(brand ? { brand } : {}),
      ...(model ? { model } : {}),
      ...(manufacturerCode ? { manufacturerCode } : {}),
      ...(gtin ? { gtin } : {}),
      categoryPath,
    },
    content: {
      descriptionText: extractDescription($),
      parameters,
      imageUrls: [...new Set(imageUrls)],
    },
    commerce: {
      ...(price === undefined ? {} : { price }),
      currency: "PLN",
      smart: /Smart!/u.test(pageText),
    },
    productGroup: {
      ...(comparedOfferCount ? { comparedOfferCount: Number(comparedOfferCount) } : {}),
    },
    evidence: [
      {
        evidenceId: `html:${htmlHash}`,
        kind: "html",
        sourceUrl: document.url,
        contentHash: htmlHash,
        capturedAt: document.capturedAt,
      },
    ],
  };
}

