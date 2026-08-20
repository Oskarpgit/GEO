import { describe, expect, it } from "vitest";
import { allegroPlRuleset } from "../src/rules/allegro-rules.js";
import { isValidGtin, validateAllegroOffer } from "../src/rules/engine.js";
import { parseRuleset } from "../src/rules/schema.js";

const validOffer = {
  offer: {
    title: "Ekspres automatyczny Philips EP2334/10 LatteGo czarny",
    description:
      "Automatyczny ekspres przygotowuje kawę ze świeżo mielonych ziaren. System LatteGo umożliwia przygotowanie napojów mlecznych. Pojemnik można odłączyć i umyć po użyciu.",
    parameters: {
      brand: "Philips",
      manufacturerCode: "EP2334/10",
      model: "EP 2334/10",
      gtin: "8720389030291",
    },
    images: ["https://a.allegroimg.com/example/product.jpg"],
  },
};

function statusFor(
  validation: ReturnType<typeof validateAllegroOffer>,
  ruleId: string,
): string | undefined {
  return validation.results.find((item) => item.ruleId === ruleId)?.status;
}

describe("validateAllegroOffer", () => {
  it("passes deterministic checks and leaves semantic checks for review", () => {
    const validation = validateAllegroOffer(validOffer, allegroPlRuleset);

    expect(statusFor(validation, "ALG-TITLE-001")).toBe("passed");
    expect(statusFor(validation, "ALG-DESC-009")).toBe("passed");
    expect(statusFor(validation, "ALG-PARAM-001")).toBe("passed");
    expect(statusFor(validation, "ALG-DESC-004")).toBe("needs_review");
    expect(validation.readyForGeneration).toBe(true);
  });

  it("blocks marketing phrases and contact data", () => {
    const validation = validateAllegroOffer(
      {
        offer: {
          ...validOffer.offer,
          title: "HIT PROMOCJA ekspres Philips",
          description:
            "Promocja i gratis tylko dziś. Automatyczny ekspres do kawy jest dostępny. Zadzwoń pod numer 501 234 567, aby ustalić szczegóły zakupu i odbioru.",
        },
      },
      allegroPlRuleset,
    );

    expect(statusFor(validation, "ALG-TITLE-003")).toBe("failed");
    expect(statusFor(validation, "ALG-DESC-007")).toBe("failed");
    expect(statusFor(validation, "ALG-DESC-009")).toBe("failed");
    expect(validation.readyForGeneration).toBe(false);
  });

  it("does not report missing fields as passed", () => {
    const validation = validateAllegroOffer({ offer: {} }, allegroPlRuleset);

    expect(statusFor(validation, "ALG-TITLE-001")).toBe("not_evaluated");
    expect(statusFor(validation, "ALG-DESC-001")).toBe("failed");
    expect(statusFor(validation, "ALG-PARAM-001")).toBe("not_evaluated");
    expect(validation.readyForGeneration).toBe(false);
  });
});

describe("isValidGtin", () => {
  it("validates the real coffee-machine GTIN checksum", () => {
    expect(isValidGtin("8720389030291")).toBe(true);
    expect(isValidGtin("8720389030292")).toBe(false);
  });
});

describe("parseRuleset", () => {
  it("ensures every production rule points to a registered official source", () => {
    expect(parseRuleset(allegroPlRuleset)).toEqual(allegroPlRuleset);
  });

  it("rejects a rule whose source is missing", () => {
    expect(() =>
      parseRuleset({
        ...allegroPlRuleset,
        rules: [{ ...allegroPlRuleset.rules[0], sourceId: "ALG-MISSING" }],
      }),
    ).toThrow(/nieistniejące źródło/iu);
  });
});

