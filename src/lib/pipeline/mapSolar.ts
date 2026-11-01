import type { Plane, SolarPlaneSnapshot } from "./types";

export type MappedSolar = {
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
  planes: Plane[];
};

function num(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function latLng(value: unknown): { lat: number; lng: number } | null {
  if (!value || typeof value !== "object") return null;
  const v = value as { latitude?: unknown; longitude?: unknown; lat?: unknown; lng?: unknown };
  const lat = num(v.latitude ?? v.lat);
  const lng = num(v.longitude ?? v.lng);
  if (lat == null || lng == null) return null;
  return { lat, lng };
}

function dateText(value: unknown): string | undefined {
  if (!value || typeof value !== "object") return undefined;
  const d = value as { year?: unknown; month?: unknown; day?: unknown };
  if (typeof d.year !== "number") return undefined;
  const month = typeof d.month === "number" ? String(d.month).padStart(2, "0") : "01";
  const day = typeof d.day === "number" ? String(d.day).padStart(2, "0") : "01";
  return `${d.year}-${month}-${day}`;
}

function snapshot(raw: Record<string, unknown>): SolarPlaneSnapshot {
  const stats = (raw.stats ?? {}) as Record<string, unknown>;
  const box = raw.boundingBox as { sw?: unknown; ne?: unknown } | undefined;
  const sw = box ? latLng(box.sw) : null;
  const ne = box ? latLng(box.ne) : null;
  return {
    pitchDegrees: num(raw.pitchDegrees),
    azimuthDegrees: num(raw.azimuthDegrees),
    areaMeters2: num(stats.areaMeters2),
    groundAreaMeters2: num(stats.groundAreaMeters2),
    heightMeters: num(raw.planeHeightAtCenterMeters),
    center: latLng(raw.center),
    boundingBox: sw && ne ? { sw, ne } : null,
  };
}

/**
 * Map a Google Solar buildingInsights resource.
 * Bounding boxes are stored and never converted into roof polygons.
 * Linear edges are not in this response and are left unset.
 */
export function mapSolarInsights(raw: unknown, ids: () => string = () => crypto.randomUUID()): MappedSolar {
  const root = (raw ?? {}) as Record<string, unknown>;
  const potential = (root.solarPotential ?? {}) as Record<string, unknown>;
  const whole = (potential.wholeRoofStats ?? {}) as Record<string, unknown>;
  const segments = Array.isArray(potential.roofSegmentStats) ? potential.roofSegmentStats : [];

  const planes: Plane[] = segments.map((segment, index) => {
    const snap = snapshot((segment ?? {}) as Record<string, unknown>);
    return {
      id: ids(),
      label: `Solar plane ${index + 1}`,
      origin: "SOLAR",
      solar: snap,
      path: null,
      pitchDegrees: snap.pitchDegrees,
      pitchSource: snap.pitchDegrees == null ? "UNAVAILABLE" : "SOLAR",
      azimuthDegrees: snap.azimuthDegrees,
      azimuthSource: snap.azimuthDegrees == null ? "UNAVAILABLE" : "SOLAR",
      areaOverrideSqFt: null,
      manual: null,
      hasExistingPanels: false,
    };
  });

  return {
    imageryQuality: typeof root.imageryQuality === "string" ? root.imageryQuality : undefined,
    imageryDate: dateText(root.imageryDate),
    buildingName: typeof root.name === "string" ? root.name : undefined,
    wholeRoofAreaM2: num(whole.areaMeters2),
    wholeRoofGroundM2: num(whole.groundAreaMeters2),
    maxPanels: num(potential.maxArrayPanelsCount),
    panelCapacityWatts: num(potential.panelCapacityWatts),
    panelHeightMeters: num(potential.panelHeightMeters),
    panelWidthMeters: num(potential.panelWidthMeters),
    maxSunshineHours: num(potential.maxSunshineHoursPerYear),
    planes,
  };
}
