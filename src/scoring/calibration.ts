export const GEO_CALIBRATION_FEATURES = [
  "parameterCount",
  "imageCount",
  "description.characters",
  "description.words",
  "description.headings",
  "description.paragraphs",
  "description.listItems",
  "description.inlineImages",
  "description.numericFacts",
  "description.faqSignals",
] as const;

export type GeoCalibrationFeature = (typeof GEO_CALIBRATION_FEATURES)[number];

export type GeoCalibrationFeatureStats = {
  feature: GeoCalibrationFeature;
  observationCount: number;
  meanWinner: number;
  meanControls: number;
  meanPairedDelta: number;
  medianPairedDelta: number;
  positiveDeltaShare: number;
  positiveObservations: number;
  tiedObservations: number;
  negativeObservations: number;
};

export type GeoCalibrationReport = {
  schemaVersion: "1.0.0";
  calibrationVersion: "geo-score-calibration-0.1.0";
  generatedFrom: "llm-discovery-20-v1/offer-comparisons.json";
  method: "winner-minus-mean-matched-controls-within-observation";
  evidenceLevel: "limited_observational";
  causalClaimAllowed: false;
  weightsFittedFromThisSample: false;
  sample: {
    llmRuns: number;
    observationsWithControls: number;
    matchedControlPairs: number;
    byEngine: Record<string, { observationsWithControls: number; matchedControlPairs: number }>;
  };
  features: GeoCalibrationFeatureStats[];
  limitationsPl: string[];
};

type RecordValue = Record<string, unknown>;

function record(value: unknown): RecordValue | undefined {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as RecordValue)
    : undefined;
}

function array(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function numericFeature(value: unknown, feature: GeoCalibrationFeature): number | undefined {
  let current: unknown = value;
  for (const segment of feature.split(".")) current = record(current)?.[segment];
  if (Array.isArray(current)) return current.length;
  return typeof current === "number" && Number.isFinite(current) ? current : undefined;
}

function mean(values: number[]): number {
  return values.length === 0 ? 0 : values.reduce((total, value) => total + value, 0) / values.length;
}

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);
  const right = sorted[middle] ?? 0;
  if (sorted.length % 2 === 1) return right;
  return ((sorted[middle - 1] ?? 0) + right) / 2;
}

function rounded(value: number): number {
  return Number(value.toFixed(4));
}

export function calibrateGeoEvidence(dataset: unknown): GeoCalibrationReport {
  const observations = array(record(dataset)?.observations);
  const comparable = observations
    .map((value) => record(value))
    .filter((value): value is RecordValue => Boolean(value))
    .filter((value) => Boolean(record(value.winner)) && array(value.controls).length > 0);
  const matchedControlPairs = comparable.reduce(
    (total, observation) => total + array(observation.controls).length,
    0,
  );
  const byEngine: GeoCalibrationReport["sample"]["byEngine"] = {};
  for (const observation of comparable) {
    const engine = typeof observation.engine === "string" ? observation.engine : "unknown";
    const current = byEngine[engine] ?? { observationsWithControls: 0, matchedControlPairs: 0 };
    current.observationsWithControls += 1;
    current.matchedControlPairs += array(observation.controls).length;
    byEngine[engine] = current;
  }

  const features = GEO_CALIBRATION_FEATURES.map((feature): GeoCalibrationFeatureStats => {
    const rows = comparable.flatMap((observation) => {
      const winner = numericFeature(observation.winner, feature);
      const controls = array(observation.controls)
        .map((control) => numericFeature(control, feature))
        .filter((value): value is number => value !== undefined);
      if (winner === undefined || controls.length === 0) return [];
      const controlMean = mean(controls);
      return [{ winner, controlMean, delta: winner - controlMean }];
    });
    const deltas = rows.map((row) => row.delta);
    const positiveObservations = deltas.filter((value) => value > 0).length;
    const tiedObservations = deltas.filter((value) => value === 0).length;
    const negativeObservations = deltas.filter((value) => value < 0).length;
    return {
      feature,
      observationCount: rows.length,
      meanWinner: rounded(mean(rows.map((row) => row.winner))),
      meanControls: rounded(mean(rows.map((row) => row.controlMean))),
      meanPairedDelta: rounded(mean(deltas)),
      medianPairedDelta: rounded(median(deltas)),
      positiveDeltaShare: rows.length > 0 ? rounded(positiveObservations / rows.length) : 0,
      positiveObservations,
      tiedObservations,
      negativeObservations,
    };
  });

  return {
    schemaVersion: "1.0.0",
    calibrationVersion: "geo-score-calibration-0.1.0",
    generatedFrom: "llm-discovery-20-v1/offer-comparisons.json",
    method: "winner-minus-mean-matched-controls-within-observation",
    evidenceLevel: "limited_observational",
    causalClaimAllowed: false,
    weightsFittedFromThisSample: false,
    sample: {
      llmRuns: observations.length,
      observationsWithControls: comparable.length,
      matchedControlPairs,
      byEngine,
    },
    features,
    limitationsPl: [
      "Próbka obejmuje tylko obserwacje, dla których znaleziono aktywne oferty tego samego produktu.",
      "Obecność w odpowiedzi LLM nie dowodzi, że zdecydował opis oferty.",
      "Cena, dostępność, sprzedawca, indeksowanie i inne czynniki pozostają możliwymi zmiennymi zakłócającymi.",
      "Wagi GEO Score v0.1 nie zostały dopasowane do tej małej próbki.",
    ],
  };
}
