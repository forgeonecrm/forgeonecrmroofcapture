export type EdgeKind = "ridge" | "hip" | "valley" | "eave" | "rake" | "flashing";

export type Source = "SOLAR" | "CONVERTED" | "CALCULATED" | "MANUAL" | "UNAVAILABLE";

export type LatLng = { lat: number; lng: number };

export type DiagLevel = "info" | "warn" | "error";

export type Diagnostic = {
  at: string;
  level: DiagLevel;
  service: string;
  message: string;
};

export type SolarPlaneSnapshot = {
  pitchDegrees: number | null;
  azimuthDegrees: number | null;
  areaMeters2: number | null;
  groundAreaMeters2: number | null;
  heightMeters: number | null;
  center: LatLng | null;
  boundingBox: { sw: LatLng; ne: LatLng } | null;
};

export type Plane = {
  id: string;
  label: string;
  origin: "SOLAR" | "MANUAL";
  /** Untouched Google Solar roofSegmentStats fields. Never rewritten by edits. */
  solar: SolarPlaneSnapshot | null;
  /** Estimator-traced outline on the aerial. Not a Solar bounding box. */
  path: LatLng[] | null;
  pitchDegrees: number | null;
  pitchSource: Source;
  azimuthDegrees: number | null;
  azimuthSource: Source;
  /** Estimator surface-area correction in square feet. Does not change Solar figures. */
  areaOverrideSqFt: number | null;
  manual: null | {
    lengthFt: number;
    widthFt: number;
    dimension: "SURFACE" | "FOOTPRINT";
  };
  hasExistingPanels: boolean;
};

export type Edge = {
  id: string;
  kind: EdgeKind;
  path: LatLng[];
  /** When set, this entered length is used instead of the traced length. */
  lengthOverrideFt: number | null;
  origin: "DRAWN" | "ENTERED";
};

export type ServiceState = "SUCCESS" | "BLOCKED" | "NO_COVERAGE" | "FAILED" | "SKIPPED" | "NOT_FOUND";

export type Job = {
  id: string;
  createdAt: string;
  updatedAt: string;
  input: string;
  formattedAddress: string | null;
  placeId: string | null;
  coordinateSource: string | null;
  locationType: string | null;
  partialMatch: boolean;
  coordinates: null | {
    lat: number;
    lng: number;
    cachedAt: string;
    expiresAt: string;
  };
  geocodeStatus: "SUCCESS" | "FAILED";
  addressValidation: {
    status: ServiceState;
    message: string;
    granularity?: string;
    addressComplete?: boolean;
    dpv?: string;
  };
  solar: {
    status: ServiceState;
    message: string;
    reason?: string;
    httpStatus?: number;
    projectNumber?: string;
    imageryQuality?: string;
    imageryDate?: string;
    buildingName?: string;
    wholeRoofAreaM2: number | null;
    wholeRoofGroundM2: number | null;
    maxPanels: number | null;
    panelCapacityWatts: number | null;
    panelHeightMeters: number | null;
    panelWidthMeters: number | null;
    maxSunshineHours: number | null;
  };
  planes: Plane[];
  edges: Edge[];
  existingSolar: {
    recorded: boolean;
    present: boolean;
    panelCount: number | null;
    capacityKw: number | null;
    inverter: string;
    year: number | null;
    condition: string;
    notes: string;
  };
  review: {
    checked: boolean;
    verifiedAt: string | null;
  };
  prices: Record<string, number>;
  diagnostics: Diagnostic[];
};

export type Suggestion = {
  placeId: string;
  main: string;
  secondary: string;
};

export const EDGE_KINDS: EdgeKind[] = ["ridge", "hip", "valley", "eave", "rake", "flashing"];

export const EDGE_LABEL: Record<EdgeKind, string> = {
  ridge: "Ridge",
  hip: "Hip",
  valley: "Valley",
  eave: "Eave",
  rake: "Rake",
  flashing: "Flashing",
};

export const UNAVAILABLE = "Not available — requires additional analysis";
