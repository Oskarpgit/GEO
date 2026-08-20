import { describe, expect, it } from "vitest";
import type { MeasurementAttempt } from "../src/domain/types.js";
import { calculateOfferVisibility } from "../src/measurement/metrics.js";

const offerId = "18479049815";

describe("calculateOfferVisibility", () => {
  it("excludes failed attempts and counts only a matched concrete offer", () => {
    const attempts: MeasurementAttempt[] = [
      {
        attemptId: "a1",
        offerId,
        promptId: "CM-001",
        repetition: 1,
        status: "success",
        appearances: [
          {
            rank: 2,
            entityType: "offer",
            detectedOfferId: offerId,
            url: `https://allegro.pl/oferta/${offerId}`,
            identityMatch: "matched",
            cited: true,
          },
        ],
      },
      {
        attemptId: "a2",
        offerId,
        promptId: "CM-001",
        repetition: 2,
        status: "success",
        appearances: [],
      },
      {
        attemptId: "a3",
        offerId,
        promptId: "CM-001",
        repetition: 3,
        status: "timeout",
        appearances: [],
      },
    ];

    const metrics = calculateOfferVisibility(offerId, attempts);

    expect(metrics.successfulAttempts).toBe(2);
    expect(metrics.excludedAttempts).toBe(1);
    expect(metrics.mentionRate).toBe(0.5);
    expect(metrics.top3Share).toBe(0.5);
    expect(metrics.meanReciprocalRank).toBe(0.25);
  });

  it("does not count a product page as visibility of the concrete offer", () => {
    const metrics = calculateOfferVisibility(offerId, [
      {
        attemptId: "a1",
        offerId,
        promptId: "CM-001",
        repetition: 1,
        status: "success",
        appearances: [
          {
            rank: 1,
            entityType: "product",
            detectedProductId: "4e228672-df75-4385-99e4-1aeedc87aa4d",
            url: "https://allegro.pl/oferty-produktu/example",
            identityMatch: "matched",
            cited: true,
          },
        ],
      },
    ]);

    expect(metrics.mentionRate).toBe(0);
    expect(metrics.offerLinkRate).toBe(0);
  });

  it("withholds rates when no attempt succeeded", () => {
    const metrics = calculateOfferVisibility(offerId, [
      {
        attemptId: "a1",
        offerId,
        promptId: "CM-001",
        repetition: 1,
        status: "blocked",
        appearances: [],
      },
    ]);

    expect(metrics.successfulAttempts).toBe(0);
    expect(metrics.mentionRate).toBeUndefined();
  });
});
