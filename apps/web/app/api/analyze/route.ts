import { NextResponse } from "next/server";
import { extractProductClaims } from "../../../../../src/generation/claims.js";
import { renderDescriptionCandidate } from "../../../../../src/generation/generator.js";
import { parseAllegroOffer } from "../../../../../src/parser/allegro-offer.js";
import { geoOfferInputFromSnapshot } from "../../../../../src/scoring/adapters.js";
import { auditAllegroGeoOffer } from "../../../../../src/scoring/audit.js";
import type { GeoOfferInput } from "../../../../../src/scoring/types.js";
import { generateReviewedOfferDescription } from "../../../../../src/workflows/offer-description.js";
import {
  fetchAllegroOfferHtml,
  OfferSourceError,
  type AllegroDocumentSource,
} from "../../../lib/allegro-offer-source.server.js";
import { demoOffer } from "../../../lib/demo-offer.js";

export const runtime = "edge";

type AnalyzeRequest = {
  url?: string;
  demo?: boolean;
  approvedClaimIds?: string[];
};

function publicError(error: unknown): { message: string; status: number } {
  if (error instanceof OfferSourceError) {
    return { message: error.message, status: error.httpStatus };
  }
  if (error instanceof Error && error.message.length <= 180) {
    return { message: error.message, status: 400 };
  }
  return {
    message: "Nie udało się przeanalizować tej oferty. Spróbuj ponownie lub użyj przykładu.",
    status: 400,
  };
}

function firecrawlProxyMode(): "basic" | "enhanced" | "auto" {
  const configured = process.env.FIRECRAWL_PROXY_MODE?.trim();
  if (configured === "enhanced" || configured === "auto") return configured;
  return "basic";
}

async function inputFromPublicOffer(rawUrl: string): Promise<{
  input: GeoOfferInput;
  offerId: string;
  productId?: string;
  documentSource: AllegroDocumentSource;
}> {
  const apiKey = process.env.FIRECRAWL_API_KEY?.trim();
  const document = await fetchAllegroOfferHtml(rawUrl, {
    ...(apiKey ? { firecrawlApiKey: apiKey } : {}),
    firecrawlProxyMode: firecrawlProxyMode(),
  });
  const snapshot = parseAllegroOffer({
    url: document.finalUrl.toString(),
    html: document.html,
    capturedAt: new Date().toISOString(),
  });
  return {
    input: geoOfferInputFromSnapshot(snapshot),
    offerId: snapshot.offerId,
    ...(snapshot.productId ? { productId: snapshot.productId } : {}),
    documentSource: document.source,
  };
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as AnalyzeRequest;
    const source = body.demo
      ? {
          input: demoOffer,
          offerId: "demo-ep2334",
          productId: "demo-product",
          documentSource: "verified_demo" as const,
        }
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
        source: source.documentSource,
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
    const responseError = publicError(error);
    return NextResponse.json(
      { error: responseError.message },
      { status: responseError.status },
    );
  }
}
