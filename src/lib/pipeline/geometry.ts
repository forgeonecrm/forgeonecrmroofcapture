import type { Edge, EdgeKind, Job, LatLng, Plane, Source } from "./types";
import { EDGE_KINDS, UNAVAILABLE } from "./types";

export const SQFT_PER_M2 = 10.76391041671;
export const FT_PER_M = 3.280839895;

const DIRS = [
  "N",
  "NNE",
  "NE",
  "ENE",
  "E",
  "ESE",
  "SE",
  "SSE",
  "S",
  "SSW",
  "SW",
  "WSW",
  "W",
  "WNW",
  "NW",
  "NNW",
];

export function haversineMeters(a: LatLng, b: LatLng): number {
  const R = 6371008.8;
  const φ1 = (a.lat * Math.PI) / 180;
  const φ2 = (b.lat * Math.PI) / 180;
  const dφ = ((b.lat - a.lat) * Math.PI) / 180;
  const dλ = ((b.lng - a.lng) * Math.PI) / 180;
  const s =
    Math.sin(dφ / 2) ** 2 + Math.cos(φ1) * Math.cos(φ2) * Math.sin(dλ / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(s)));
}

export function pathLengthFeet(path: LatLng[]): number | null {
  if (path.length < 2) return null;
  let meters = 0;
  for (let i = 1; i < path.length; i++) meters += haversineMeters(path[i - 1]!, path[i]!);
  return meters * FT_PER_M;
}

/** Closed-ring perimeter, in feet. */
export function ringPerimeterFeet(path: LatLng[]): number | null {
  if (path.length < 3) return null;
  return pathLengthFeet([...path, path[0]!]);
}

/** Ground area of a ring on a local tangent plane. Accurate for roof-sized rings. */
export function ringGroundSqMeters(path: LatLng[]): number | null {
  if (path.length < 3) return null;
  const lat0 = path.reduce((s, p) => s + p.lat, 0) / path.length;
  const lng0 = path.reduce((s, p) => s + p.lng, 0) / path.length;
  const pts = path.map((p) => ({
    x: (p.lng - lng0) * Math.cos((lat0 * Math.PI) / 180) * 111_320,
    y: (p.lat - lat0) * 111_320,
  }));
  let sum = 0;
  for (let i = 0; i < pts.length; i++) {
    const j = (i + 1) % pts.length;
    sum += pts[i]!.x * pts[j]!.y - pts[j]!.x * pts[i]!.y;
  }
  const area = Math.abs(sum) / 2;
  return Number.isFinite(area) ? area : null;
}

export function surfaceFromGroundM2(groundM2: number, pitchDegrees: number): number | null {
  if (!Number.isFinite(groundM2) || !Number.isFinite(pitchDegrees)) return null;
  const cos = Math.cos((pitchDegrees * Math.PI) / 180);
  if (cos < 0.087) return null;
  return groundM2 / cos;
}

export function degreesFromRise(rise: number): number {
  return (Math.atan(rise / 12) * 180) / Math.PI;
}

const LEGACY_RISE_CHIPS = new Set([3, 4, 5, 6, 7, 8, 9, 10, 12]);

/**
 * Pitch chips used to save the rise number in the degrees field.
 * 6 meant 6:12 (~26.6°), not a 6° roof. Idempotent: converted values are not integers in that set.
 */
export function repairLegacyPitchDegrees(degrees: number | null, source: Source): number | null {
  if (degrees == null || source !== "MANUAL") return degrees;
  if (!LEGACY_RISE_CHIPS.has(degrees)) return degrees;
  return degreesFromRise(degrees);
}

export function riseFromDegrees(degrees: number): number | null {
  if (!Number.isFinite(degrees)) return null;
  const rise = 12 * Math.tan((degrees * Math.PI) / 180);
  return Number.isFinite(rise) ? rise : null;
}

export function pitchRatio(degrees: number): string {
  const rise = riseFromDegrees(degrees);
  if (rise == null) return UNAVAILABLE;
  return `${rise.toFixed(1)}:12`;
}

export function compass(degrees: number): string {
  const n = ((degrees % 360) + 360) % 360;
  return DIRS[Math.round(n / 22.5) % 16]!;
}

export function m2ToSqFt(m2: number): number {
  return m2 * SQFT_PER_M2;
}

export type PlaneFigures = {
  footprintSqFt: number | null;
  footprintSource: Source;
  surfaceSqFt: number | null;
  surfaceSource: Source;
  note: string;
};

function emptyFigures(note: string): PlaneFigures {
  return {
    footprintSqFt: null,
    footprintSource: "UNAVAILABLE",
    surfaceSqFt: null,
    surfaceSource: "UNAVAILABLE",
    note,
  };
}

/** Footprint is the flat aerial outline. Surface is the sloped roof area. */
export function planeFigures(plane: Plane): PlaneFigures {
  const pitch = plane.pitchDegrees;
  let footprintSqFt: number | null = null;
  let footprintSource: Source = "UNAVAILABLE";

  if (plane.path && plane.path.length >= 3) {
    const ground = ringGroundSqMeters(plane.path);
    if (ground != null) {
      footprintSqFt = m2ToSqFt(ground);
      footprintSource = "CALCULATED";
    }
  } else if (
    plane.manual &&
    plane.manual.lengthFt > 0 &&
    plane.manual.widthFt > 0 &&
    plane.manual.dimension === "FOOTPRINT"
  ) {
    footprintSqFt = plane.manual.lengthFt * plane.manual.widthFt;
    footprintSource = "MANUAL";
  } else if (plane.solar?.groundAreaMeters2 != null) {
    footprintSqFt = m2ToSqFt(plane.solar.groundAreaMeters2);
    footprintSource = "CONVERTED";
  }

  if (plane.areaOverrideSqFt != null && Number.isFinite(plane.areaOverrideSqFt)) {
    return {
      footprintSqFt,
      footprintSource,
      surfaceSqFt: plane.areaOverrideSqFt,
      surfaceSource: "MANUAL",
      note: "Slope area is an estimator correction. The footprint figure is separate.",
    };
  }

  if (plane.path && plane.path.length >= 3) {
    if (footprintSqFt == null) return emptyFigures(UNAVAILABLE);
    if (pitch == null) {
      return {
        footprintSqFt,
        footprintSource,
        surfaceSqFt: null,
        surfaceSource: "UNAVAILABLE",
        note: "The trace is the flat footprint on the aerial. Set a pitch to get slope area.",
      };
    }
    const ground = ringGroundSqMeters(plane.path);
    const surface = ground == null ? null : surfaceFromGroundM2(ground, pitch);
    return {
      footprintSqFt,
      footprintSource,
      surfaceSqFt: surface == null ? null : m2ToSqFt(surface),
      surfaceSource: surface == null ? "UNAVAILABLE" : "CALCULATED",
      note: "Slope area = traced footprint ÷ cos(pitch). This trace is not a Solar outline.",
    };
  }

  if (plane.manual && plane.manual.lengthFt > 0 && plane.manual.widthFt > 0) {
    const rect = plane.manual.lengthFt * plane.manual.widthFt;
    if (plane.manual.dimension === "SURFACE") {
      return {
        footprintSqFt,
        footprintSource,
        surfaceSqFt: rect,
        surfaceSource: "MANUAL",
        note: "Length × width entered as slope area.",
      };
    }
    if (pitch == null) {
      return {
        footprintSqFt: rect,
        footprintSource: "MANUAL",
        surfaceSqFt: null,
        surfaceSource: "UNAVAILABLE",
        note: "Footprint entered. Set a pitch to get slope area.",
      };
    }
    const cos = Math.cos((pitch * Math.PI) / 180);
    const surface = cos < 0.087 ? null : rect / cos;
    return {
      footprintSqFt: rect,
      footprintSource: "MANUAL",
      surfaceSqFt: surface,
      surfaceSource: surface == null ? "UNAVAILABLE" : "CALCULATED",
      note: "Entered footprint ÷ cos(pitch).",
    };
  }

  if (plane.solar?.areaMeters2 != null) {
    return {
      footprintSqFt,
      footprintSource,
      surfaceSqFt: m2ToSqFt(plane.solar.areaMeters2),
      surfaceSource: "CONVERTED",
      note: "Slope area converted from Solar stats.areaMeters2. Footprint uses groundAreaMeters2 when Google sent it.",
    };
  }

  return emptyFigures(UNAVAILABLE);
}

export type AreaReading = {
  sqFt: number | null;
  source: Source;
  detail: string;
};

export function planeArea(plane: Plane): AreaReading {
  const figures = planeFigures(plane);
  return { sqFt: figures.surfaceSqFt, source: figures.surfaceSource, detail: figures.note };
}

export function edgeLength(edge: Edge): { feet: number | null; source: Source; detail: string } {
  if (edge.lengthOverrideFt != null && Number.isFinite(edge.lengthOverrideFt)) {
    return {
      feet: edge.lengthOverrideFt,
      source: "MANUAL",
      detail: edge.path.length >= 2 ? "Entered length overrides the trace." : "Entered length. Not plotted.",
    };
  }
  const traced = pathLengthFeet(edge.path);
  if (traced == null) {
    return { feet: null, source: "UNAVAILABLE", detail: UNAVAILABLE };
  }
  return {
    feet: traced,
    source: "CALCULATED",
    detail: "Geodesic length of the line drawn on the aerial.",
  };
}

export function edgeTotals(edges: Edge[]): Record<EdgeKind, { feet: number | null; source: Source }> {
  const out = {} as Record<EdgeKind, { feet: number | null; source: Source }>;
  for (const kind of EDGE_KINDS) {
    const rows = edges.filter((e) => e.kind === kind).map(edgeLength);
    const known = rows.filter((r) => r.feet != null);
    if (known.length === 0) {
      out[kind] = { feet: null, source: "UNAVAILABLE" };
    } else {
      const feet = known.reduce((s, r) => s + (r.feet ?? 0), 0);
      const source = known.every((r) => r.source === "CALCULATED")
        ? "CALCULATED"
        : known.every((r) => r.source === "MANUAL")
          ? "MANUAL"
          : "CALCULATED";
      out[kind] = { feet, source };
    }
  }
  return out;
}

export function footprintTotalSqFt(job: Job): number | null {
  const values = job.planes.map((plane) => planeFigures(plane).footprintSqFt).filter((n): n is number => n != null);
  if (values.length === 0) return job.solar.wholeRoofGroundM2 == null ? null : m2ToSqFt(job.solar.wholeRoofGroundM2);
  return values.reduce((sum, n) => sum + n, 0);
}

export function workingSurfaceSqFt(job: Job): AreaReading {
  const planeReadings = job.planes.map(planeArea).filter((r) => r.sqFt != null);
  if (planeReadings.length > 0) {
    const sqFt = planeReadings.reduce((s, r) => s + (r.sqFt ?? 0), 0);
    const anyManual = job.planes.some(
      (p) => p.origin === "MANUAL" || p.areaOverrideSqFt != null || (p.path && p.path.length >= 3),
    );
    return {
      sqFt,
      source: anyManual ? "CALCULATED" : "CONVERTED",
      detail: anyManual
        ? "Sum of slope areas from traces, pitches, and corrections."
        : "Sum of Solar segment slope areas converted to square feet. This can differ from wholeRoofStats.",
    };
  }
  if (job.solar.wholeRoofAreaM2 != null) {
    return {
      sqFt: m2ToSqFt(job.solar.wholeRoofAreaM2),
      source: "CONVERTED",
      detail: "No per-plane area. Using Solar solarPotential.wholeRoofStats.areaMeters2, converted to sq ft.",
    };
  }
  return { sqFt: null, source: "UNAVAILABLE", detail: UNAVAILABLE };
}

export type ReviewCheck = { id: string; label: string; pass: boolean };

export function reviewChecks(job: Job): ReviewCheck[] {
  const area = workingSurfaceSqFt(job);
  return [
    {
      id: "pin",
      label: "Google returned a place and a coordinate for this parcel",
      pass: job.geocodeStatus === "SUCCESS" && !!job.placeId && !!job.coordinates,
    },
    {
      id: "area",
      label: "At least one roof area came from Solar or from an estimator trace or entry",
      pass: area.sqFt != null && area.sqFt > 0,
    },
    {
      id: "ack",
      label: "Estimator confirmed the figures against the aerial or a site visit",
      pass: job.review.checked,
    },
  ];
}

export function isVerified(job: Job): boolean {
  return reviewChecks(job).every((c) => c.pass) && !!job.review.verifiedAt;
}

export function formatMeasure(value: number | null | undefined, digits: number, unit: string): string {
  if (value == null || !Number.isFinite(value)) return UNAVAILABLE;
  return `${value.toLocaleString("en-US", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  })} ${unit}`;
}

export function bboxPath(box: { sw: LatLng; ne: LatLng }): LatLng[] {
  return [
    { lat: box.sw.lat, lng: box.sw.lng },
    { lat: box.ne.lat, lng: box.sw.lng },
    { lat: box.ne.lat, lng: box.ne.lng },
    { lat: box.sw.lat, lng: box.ne.lng },
  ];
}
