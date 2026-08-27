import type { OfferSnapshot } from "../domain/types.js";
import type { GeoOfferInput } from "./types.js";

export function geoOfferInputFromSnapshot(snapshot: OfferSnapshot): GeoOfferInput {
  return {
    source: {
      snapshotId: snapshot.snapshotId,
      evidenceIds: snapshot.evidence.map((item) => item.evidenceId),
    },
    title: snapshot.identity.title,
    description: snapshot.content.descriptionText,
    parameters: snapshot.content.parameters,
    images: snapshot.content.imageUrls,
    identity: {
      ...(snapshot.identity.brand ? { brand: snapshot.identity.brand } : {}),
      ...(snapshot.identity.model ? { model: snapshot.identity.model } : {}),
      ...(snapshot.identity.manufacturerCode
        ? { manufacturerCode: snapshot.identity.manufacturerCode }
        : {}),
      ...(snapshot.identity.gtin ? { gtin: snapshot.identity.gtin } : {}),
      categoryPath: snapshot.identity.categoryPath,
    },
  };
}
