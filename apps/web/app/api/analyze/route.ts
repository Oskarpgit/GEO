import { NextResponse } from "next/server";
import { extractProductClaims } from "../../../../../src/generation/claims.js";
import { renderDescriptionCandidate } from "../../../../../src/generation/generator.js";
import { parseAllegroOffer } from "../../../../../src/parser/allegro-offer.js";
import { geoOfferInputFromSnapshot } from "../../../../../src/scoring/adapters.js";
import { auditAllegroGeoOffer } from "../../../../../src/scoring/audit.js";
import type { GeoOfferInput } from "../../../../../src/scoring/types.js";
import { generateReviewedOfferDescription } from "../../../../../src/workflows/offer-description.js";
import { demoOffer } from "../../../lib/demo-offer.js";

export const runtime = "edge";

type AnalyzeRequest = {
  url?: string;
  demo?: boolean;
  approvedClaimIds?: string[];
};

function validatedAllegroUrl(rawUrl: string): URL {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    throw new Error("Wpisz poprawny link do oferty Allegro.");
  }
  const validHost = url.hostname === "allegro.pl" || url.hostname === "www.allegro.pl";
  if (url.protocol !== "https:" || !validHost || !url.pathname.includes("/oferta/")) {
    throw new Error("Obsługiwany jest wyłącznie link HTTPS do oferty na allegro.pl.");
  }
  return url;
}

function publicError(error: unknown): string {
  if (error instanceof Error && error.message.length <= 180) return error.message;
  return "Nie udało się przeanalizować tej oferty. Spróbuj ponownie lub użyj przykładu.";
}

async function inputFromPublicOffer(rawUrl: string): Promise<{
  input: GeoOfferInput;
  offerId: string;
  productId?: string;
}> {
  const url = validatedAllegroUrl(rawUrl);
  const response = await fetch(url, {
    headers: {
      Accept: "text/html,application/xhtml+xml",
      "Accept-Language": "pl-PL,pl;q=0.9",
      "User-Agent": "Shoppalyzer-GEO/0.1 (+https://shoppalyzer.pl)",
    },
    redirect: "follow",
    signal: AbortSignal.timeout(12_000),
  });
  if (!response.ok) throw new Error(`Allegro zwróciło błąd HTTP ${response.status}.`);
  const finalUrl = validatedAllegroUrl(response.url);
  const declaredSize = Number(response.headers.get("content-length") ?? 0);
  if (declaredSize > 5_000_000) throw new Error("Strona oferty jest zbyt duża do bezpiecznej analizy.");
  const html = await response.text();
  if (html.length > 5_000_000) throw new Error("Strona oferty jest zbyt duża do bezpiecznej analizy.");
  const snapshot = parseAllegroOffer({
    url: finalUrl.toString(),
    html,
    capturedAt: new Date().toISOString(),
  });
  return {
    input: geoOfferInputFromSnapshot(snapshot),
    offerId: snapshot.offerId,
    ...(snapshot.productId ? { productId: snapshot.productId } : {}),
  };
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as AnalyzeRequest;
    const source = body.demo
      ? { input: demoOffer, offerId: "demo-ep2334", productId: "demo-product" }
      : await inputFromPublicOffer(body.url ?? "");
    const audit = auditAllegroGeoOffer(source.input);
    const claims = extractProductClaims(source.input);
    const approvedIds = new Set(body.approvedClaimIds ?? []);
    const decisions = Object.fromEntries(
      claims.map((claim) => [claim.claimId, approvedIds.has(claim.claimId) ? "approved" : "rejected"]),
    ) as Record<string, "approved" | "rejected">;
    const generation = body.approvedClaimIds
      ? generateReviewedOfferDescription(source.input, decisions)
      : undefined;

    return NextResponse.json({
      schemaVersion: "1.0.0",
      offer: {
        offerId: source.offerId,
        ...(source.productId ? { productId: source.productId } : {}),
        title: source.input.title,
        source: body.demo ? "verified_demo" : "public_allegro_page",
      },
      audit: {
        score: audit.geo.score,
        maxScore: audit.geo.maxScore,
        confidence: audit.geo.confidence,
        evidenceLevel: audit.geo.evidenceLevel,
        components: audit.geo.components.map((component) => ({
          id: component.componentId,
          label: component.labelPl,
          score: component.score,
          maxScore: component.maxScore,
        })),
        recommendations: audit.geo.recommendations.slice(0, 6).map((recommendation) => ({
          id: recommendation.recommendationId,
          priority: recommendation.priority,
          title: recommendation.titlePl,
          rationale: recommendation.rationalePl,
          safetyBoundary: recommendation.safetyBoundaryPl,
        })),
        allegro: {
          readyForGeneration: audit.allegro.readyForGeneration,
          totals: audit.allegro.totals,
        },
        generationInputReady: audit.separation.generationInputReady,
        generationInputReasons: audit.separation.generationInputReasons,
      },
      claims: claims.map((claim) => ({
        claimId: claim.claimId,
        kind: claim.kind,
        label: claim.labelPl,
        value: claim.value,
        sourceKind: claim.source.kind,
        reviewStatus: claim.reviewStatus,
      })),
      generation: generation
        ? generation.status === "blocked"
          ? { status: "blocked", reasons: generation.generation.reasons }
          : {
              status: "generated",
              description: renderDescriptionCandidate(generation.generation.candidate),
              validationStatus: generation.validation.status,
              provenanceValid: generation.validation.provenanceValid,
              readyForHumanReview: generation.validation.readyForHumanReview,
              readyForUse: generation.validation.readyForUse,
            }
        : null,
      boundaries: {
        causalClaimAllowed: false,
        claimsRequireExplicitReview: true,
        catalogIdentityConnected: false,
      },
    });
  } catch (error) {
    return NextResponse.json({ error: publicError(error) }, { status: 400 });
  }
}
