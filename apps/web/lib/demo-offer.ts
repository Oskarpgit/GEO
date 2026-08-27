import type { GeoOfferInput } from "../../../src/scoring/types.js";

export const demoOffer: GeoOfferInput = {
  source: {
    snapshotId: "demo-philips-ep2334",
    evidenceIds: ["demo:verified-fixture"],
  },
  title: "Ekspres automatyczny Philips LatteGo EP2334/10 czarny",
  description:
    "Philips LatteGo EP2334/10 to automatyczny ekspres do kawy. Urządzenie ma moc 1500 W i zbiornik na wodę o pojemności 1,8 l. System mleczny LatteGo można odłączyć do czyszczenia. W zestawie znajduje się ekspres oraz system LatteGo.",
  parameters: {
    Marka: "Philips",
    Model: "EP2334/10",
    "Kod producenta": "EP2334/10",
    "EAN (GTIN)": "8720389030291",
    Moc: "1500 W",
    "Pojemność zbiornika": "1,8 l",
    Kolor: "czarny",
    "Rodzaj kawy": "ziarnista",
    "Sposób czyszczenia": "odłączany system mleczny",
    "Zawartość zestawu": "ekspres i system LatteGo",
  },
  images: ["demo:image:1", "demo:image:2", "demo:image:3", "demo:image:4"],
  structure: {
    headings: 1,
    paragraphs: 2,
    listItems: 0,
    numericFacts: 2,
    faqSignals: 0,
    inlineImages: 0,
  },
};
