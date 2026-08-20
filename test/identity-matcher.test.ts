import { describe, expect, it } from "vitest";
import { matchProductIdentity } from "../src/identity/matcher.js";

describe("matchProductIdentity", () => {
  it("matches an exact GTIN", () => {
    expect(
      matchProductIdentity(
        { gtin: "8720389030291", brand: "Philips", model: "EP2334/10" },
        { gtin: "8720389030291", brand: "Philips", model: "EP 2334-10" },
      ).result,
    ).toBe("matched");
  });

  it("rejects a conflicting GTIN even when titles would look similar", () => {
    expect(
      matchProductIdentity(
        { gtin: "8720389030291", brand: "Philips", model: "EP2334/10" },
        { gtin: "8720389030292", brand: "Philips", model: "EP2334/10" },
      ).result,
    ).toBe("unmatched");
  });

  it("does not equate a two-pack with a single unit", () => {
    const match = matchProductIdentity(
      { productId: "product-a", unitCount: 1 },
      { productId: "product-a", unitCount: 2 },
    );

    expect(match.result).toBe("unmatched");
    expect(match.reasons.join(" ")).toMatch(/wielopak/iu);
  });

  it("returns uncertain when there is not enough identity evidence", () => {
    expect(matchProductIdentity({ brand: "Philips" }, { brand: "Philips" }).result).toBe("uncertain");
  });
});
