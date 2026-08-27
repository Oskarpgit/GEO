export type DescriptionExperimentChangedField =
  | "description"
  | "title"
  | "parameters"
  | "images"
  | "price"
  | "delivery"
  | "seller_quality";

export type DescriptionExperimentPolicy = {
  priceTolerancePercent: number;
  sellerRecommendedDriftPercent: number;
  requireSameTitle: boolean;
  requireSameParameters: boolean;
  requireSameImages: boolean;
  requireSameDelivery: boolean;
};

export type DescriptionExperimentAssessment = {
  assessmentVersion: "description-experiment-0.1.0";
  status: "valid_controlled" | "observational" | "invalid";
  descriptionChanged: boolean;
  changedFields: DescriptionExperimentChangedField[];
  confounders: DescriptionExperimentChangedField[];
  reasonsPl: string[];
  causalClaimAllowed: false;
};
