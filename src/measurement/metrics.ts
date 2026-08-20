import type { MeasurementAttempt } from "../domain/types.js";

export type OfferVisibilityMetrics = {
  offerId: string;
  successfulAttempts: number;
  excludedAttempts: number;
  matchedAttempts: number;
  uncertainAppearances: number;
  mentionRate?: number;
  offerLinkRate?: number;
  top1Share?: number;
  top3Share?: number;
  top5Share?: number;
  meanReciprocalRank?: number;
};

export function calculateOfferVisibility(
  offerId: string,
  attempts: MeasurementAttempt[],
): OfferVisibilityMetrics {
  const successful = attempts.filter((attempt) => attempt.status === "success");
  const excludedAttempts = attempts.length - successful.length;
  let matchedAttempts = 0;
  let linkedAttempts = 0;
  let top1 = 0;
  let top3 = 0;
  let top5 = 0;
  let reciprocalRank = 0;
  let uncertainAppearances = 0;

  for (const attempt of successful) {
    uncertainAppearances += attempt.appearances.filter(
      (appearance) => appearance.identityMatch === "uncertain",
    ).length;
    const offerAppearances = attempt.appearances
      .filter(
        (appearance) =>
          appearance.entityType === "offer" &&
          appearance.detectedOfferId === offerId &&
          appearance.identityMatch === "matched",
      )
      .sort((left, right) => left.rank - right.rank);
    const best = offerAppearances[0];
    if (!best) continue;

    matchedAttempts += 1;
    if (best.url) linkedAttempts += 1;
    if (best.rank <= 1) top1 += 1;
    if (best.rank <= 3) top3 += 1;
    if (best.rank <= 5) top5 += 1;
    reciprocalRank += 1 / best.rank;
  }

  if (successful.length === 0) {
    return {
      offerId,
      successfulAttempts: 0,
      excludedAttempts,
      matchedAttempts: 0,
      uncertainAppearances,
    };
  }

  return {
    offerId,
    successfulAttempts: successful.length,
    excludedAttempts,
    matchedAttempts,
    uncertainAppearances,
    mentionRate: matchedAttempts / successful.length,
    offerLinkRate: linkedAttempts / successful.length,
    top1Share: top1 / successful.length,
    top3Share: top3 / successful.length,
    top5Share: top5 / successful.length,
    meanReciprocalRank: reciprocalRank / successful.length,
  };
}

