import { GOOGLE_CLOUD_PROJECT_NUMBER, GOOGLE_MAPS_API_KEY } from "./credentials.server";
import { mapSolarInsights } from "./mapSolar";
import { scrub } from "./scrub";
import type { Diagnostic, Job, ServiceState, Suggestion } from "./types";

const KEY = GOOGLE_MAPS_API_KEY;
const BLOCK_MS = 10 * 60 * 1000;
const CACHE_MS = 15 * 60 * 1000;
const COORD_TTL_MS = 30 * 24 * 60 * 60 * 1000;

type CacheEntry = { at: number; job: Job };
const measureCache = new Map<string, CacheEntry>();
const suggestCache = new Map<string, { at: number; suggestions: Suggestion[] }>();
const blockedUntil = new Map<string, number>();
let confirmedProject: string | undefined;

function nowIso(): string {
  return new Date().toISOString();
}

function isBlocked(service: string): boolean {
  return (blockedUntil.get(service) ?? 0) > Date.now();
}

function block(service: string): void {
  blockedUntil.set(service, Date.now() + BLOCK_MS);
}

function diag(level: Diagnostic["level"], service: string, message: string): Diagnostic {
  return { at: nowIso(), level, service, message: scrub(message) };
}

type GoogleFailure = { message: string; reason?: string; project?: string };

function readFailure(json: unknown): GoogleFailure {
  const body = (json ?? {}) as {
    error?: { message?: string; details?: { reason?: string; metadata?: { consumer?: string } }[] };
    error_message?: string;
    status?: string;
  };
  const message = scrub(body.error?.message || body.error_message || body.status || "Request failed");
  const info = body.error?.details?.find((d) => d?.reason || d?.metadata?.consumer);
  const project = info?.metadata?.consumer?.replace(/^projects\//, "");
  if (project) confirmedProject = project;
  return { message, reason: info?.reason, project };
}

async function readBody(res: Response): Promise<unknown> {
  const text = await res.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return { error_message: scrub(text).slice(0, 280) };
  }
}

function blankSolar(status: ServiceState, message: string, extra?: Partial<Job["solar"]>): Job["solar"] {
  return {
    status,
    message,
    wholeRoofAreaM2: null,
    wholeRoofGroundM2: null,
    maxPanels: null,
    panelCapacityWatts: null,
    panelHeightMeters: null,
    panelWidthMeters: null,
    maxSunshineHours: null,
    ...extra,
  };
}

function emptyExisting(): Job["existingSolar"] {
  return {
    recorded: false,
    present: false,
    panelCount: null,
    capacityKw: null,
    inverter: "",
    year: null,
    condition: "",
    notes: "",
  };
}

async function placeDetails(
  placeId: string,
  sessionToken: string | undefined,
  logs: Diagnostic[],
): Promise<{ address: string | null; lat: number; lng: number; types: string[] } | null> {
  const url = new URL(`https://places.googleapis.com/v1/places/${encodeURIComponent(placeId)}`);
  if (sessionToken) url.searchParams.set("sessionToken", sessionToken);
  const res = await fetch(url, {
    headers: {
      "X-Goog-Api-Key": KEY,
      "X-Goog-FieldMask": "id,formattedAddress,location,types",
    },
  });
  const json = (await readBody(res)) as {
    formattedAddress?: string;
    location?: { latitude?: number; longitude?: number };
    types?: string[];
    error?: unknown;
  } | null;
  if (!res.ok || !json?.location || typeof json.location.latitude !== "number") {
    const failure = readFailure(json);
    logs.push(
      diag(
        "warn",
        "PLACES",
        `Place Details returned HTTP ${res.status}. ${failure.reason ? failure.reason + ". " : ""}${failure.message}`,
      ),
    );
    return null;
  }
  const lat = json.location.latitude;
  const lng = json.location.longitude;
  if (typeof lng !== "number") return null;
  logs.push(
    diag(
      "info",
      "PLACES",
      "Place Details returned formattedAddress and location. Session token was sent so autocomplete can bill as one session.",
    ),
  );
  return {
    address: json.formattedAddress ?? null,
    lat,
    lng,
    types: Array.isArray(json.types) ? json.types : [],
  };
}

async function geocode(
  input: { address?: string; placeId?: string },
  logs: Diagnostic[],
): Promise<{
  address: string;
  placeId: string;
  lat: number;
  lng: number;
  locationType: string | null;
  partial: boolean;
} | null> {
  const url = new URL("https://maps.googleapis.com/maps/api/geocode/json");
  url.searchParams.set("key", KEY);
  if (input.placeId) url.searchParams.set("place_id", input.placeId);
  else if (input.address) url.searchParams.set("address", input.address);
  else return null;
  const res = await fetch(url);
  const json = (await readBody(res)) as {
    status?: string;
    error_message?: string;
    results?: {
      formatted_address?: string;
      place_id?: string;
      partial_match?: boolean;
      geometry?: { location?: { lat?: number; lng?: number }; location_type?: string };
    }[];
  } | null;
  const status = json?.status || `HTTP_${res.status}`;
  if (status !== "OK" || !json?.results?.[0]?.geometry?.location) {
    const failure = readFailure(json);
    logs.push(
      diag(
        status === "ZERO_RESULTS" ? "warn" : "error",
        "GEOCODING",
        `Geocoding status ${status}. ${failure.reason ? failure.reason + ". " : ""}${failure.message || json?.error_message || ""}`.trim(),
      ),
    );
    return null;
  }
  const hit = json.results[0]!;
  const lat = hit.geometry?.location?.lat;
  const lng = hit.geometry?.location?.lng;
  if (typeof lat !== "number" || typeof lng !== "number" || !hit.place_id) {
    logs.push(diag("error", "GEOCODING", "Geocoding returned OK without a coordinate or place ID."));
    return null;
  }
  logs.push(
    diag(
      "info",
      "GEOCODING",
      `Geocoding OK. location_type ${hit.geometry?.location_type || "unknown"}. Place ID stored. Coordinates carry a 30-day TTL.`,
    ),
  );
  return {
    address: hit.formatted_address || input.address || "",
    placeId: hit.place_id,
    lat,
    lng,
    locationType: hit.geometry?.location_type ?? null,
    partial: !!hit.partial_match,
  };
}

async function validateAddress(address: string, logs: Diagnostic[]): Promise<Job["addressValidation"]> {
  if (isBlocked("addressvalidation")) {
    const message =
      "Address Validation skipped. This key returned API_KEY_SERVICE_BLOCKED within the last 10 minutes, so it was not called again.";
    logs.push(diag("info", "ADDRESS_VALIDATION", message));
    return { status: "SKIPPED", message };
  }
  const res = await fetch("https://addressvalidation.googleapis.com/v1:validateAddress", {
    method: "POST",
    headers: { "content-type": "application/json", "X-Goog-Api-Key": KEY },
    body: JSON.stringify({ address: { regionCode: "US", addressLines: [address] } }),
  });
  const json = await readBody(res);
  if (!res.ok) {
    const failure = readFailure(json);
    const blocked = res.status === 403 || failure.reason === "API_KEY_SERVICE_BLOCKED";
    if (blocked) block("addressvalidation");
    const message = blocked
      ? `Address Validation is blocked on this key (${failure.reason || "HTTP 403"}). Add addressvalidation.googleapis.com to the key API restrictions on project ${failure.project || confirmedProject || GOOGLE_CLOUD_PROJECT_NUMBER}. The parcel pin still comes from Places or Geocoding.`
      : `Address Validation HTTP ${res.status}. ${failure.message}`;
    logs.push(diag(blocked ? "warn" : "error", "ADDRESS_VALIDATION", message));
    return { status: blocked ? "BLOCKED" : "FAILED", message };
  }
  const result = (json as { result?: { verdict?: Record<string, unknown>; uspsData?: { dpvConfirmation?: string } } })
    ?.result;
  const verdict = result?.verdict ?? {};
  const granularity = typeof verdict.validationGranularity === "string" ? verdict.validationGranularity : undefined;
  const addressComplete = typeof verdict.addressComplete === "boolean" ? verdict.addressComplete : undefined;
  const dpv = result?.uspsData?.dpvConfirmation;
  const message = `Address Validation OK. Granularity ${granularity || "unspecified"}. DPV ${dpv || "not returned"}.`;
  logs.push(diag("info", "ADDRESS_VALIDATION", message));
  return { status: "SUCCESS", message, granularity, addressComplete, dpv };
}

async function solarInsights(
  lat: number,
  lng: number,
  logs: Diagnostic[],
): Promise<{ solar: Job["solar"]; planes: Job["planes"] }> {
  if (isBlocked("solar")) {
    const message =
      "Solar API skipped. This key returned API_KEY_SERVICE_BLOCKED within the last 10 minutes, so buildingInsights was not called again. No roof geometry was invented.";
    logs.push(diag("info", "SOLAR", message));
    return { solar: blankSolar("SKIPPED", message, { reason: "API_KEY_SERVICE_BLOCKED" }), planes: [] };
  }
  const url = new URL("https://solar.googleapis.com/v1/buildingInsights:findClosest");
  url.searchParams.set("location.latitude", String(lat));
  url.searchParams.set("location.longitude", String(lng));
  url.searchParams.set("requiredQuality", "BASE");
  url.searchParams.set("key", KEY);
  const res = await fetch(url);
  const json = await readBody(res);
  if (!res.ok) {
    const failure = readFailure(json);
    const blocked = res.status === 403 || failure.reason === "API_KEY_SERVICE_BLOCKED";
    if (blocked) block("solar");
    const noCoverage = res.status === 404;
    const message = blocked
      ? `Solar API blocked by this key (${failure.reason || "HTTP 403"}). Confirmed consumer ${failure.project ? "projects/" + failure.project : "not returned"}. Add solar.googleapis.com to the key's API restrictions. No planes, areas, or edge lengths were fabricated.`
      : noCoverage
        ? "Solar API returned NOT_FOUND for requiredQuality BASE. Google has no building insights for this coordinate. No substitute geometry was created."
        : `Solar API HTTP ${res.status}. ${failure.reason ? failure.reason + ". " : ""}${failure.message}`;
    logs.push(diag(noCoverage ? "warn" : "error", "SOLAR", message));
    return {
      solar: blankSolar(blocked ? "BLOCKED" : noCoverage ? "NO_COVERAGE" : "FAILED", message, {
        reason: failure.reason,
        httpStatus: res.status,
        projectNumber: failure.project,
      }),
      planes: [],
    };
  }
  const mapped = mapSolarInsights(json);
  logs.push(
    diag(
      "info",
      "SOLAR",
      `buildingInsights OK. Imagery ${mapped.imageryQuality || "unspecified"} ${mapped.imageryDate || ""}. Planes ${mapped.planes.length}. wholeRoofStats.areaMeters2 ${mapped.wholeRoofAreaM2 ?? "absent"}. Bounding boxes were kept as bounds, not drawn as roof outlines. requiredQuality=BASE returns the best imagery Google has. Data layers were not requested.`,
    ),
  );
  return {
    solar: {
      status: "SUCCESS",
      message: "Solar buildingInsights returned.",
      httpStatus: 200,
      projectNumber: confirmedProject,
      imageryQuality: mapped.imageryQuality,
      imageryDate: mapped.imageryDate,
      buildingName: mapped.buildingName,
      wholeRoofAreaM2: mapped.wholeRoofAreaM2,
      wholeRoofGroundM2: mapped.wholeRoofGroundM2,
      maxPanels: mapped.maxPanels,
      panelCapacityWatts: mapped.panelCapacityWatts,
      panelHeightMeters: mapped.panelHeightMeters,
      panelWidthMeters: mapped.panelWidthMeters,
      maxSunshineHours: mapped.maxSunshineHours,
    },
    planes: mapped.planes,
  };
}

export async function measureProperty(input: {
  query?: string;
  placeId?: string;
  sessionToken?: string;
}): Promise<{ ok: true; job: Job } | { ok: false; status: number; message: string }> {
  const query = input.query?.trim() ?? "";
  const placeId = input.placeId?.trim() ?? "";
  if (!placeId && query.length < 3) {
    return { ok: false, status: 400, message: "Enter a street address." };
  }
  if (query.length > 240 || placeId.length > 300) {
    return { ok: false, status: 400, message: "That address is too long." };
  }
  const cacheKey = placeId ? `p:${placeId}` : `q:${query.toLowerCase()}`;
  const cached = measureCache.get(cacheKey);
  if (cached && Date.now() - cached.at < CACHE_MS) {
    const job = structuredClone(cached.job);
    job.diagnostics = [
      ...job.diagnostics,
      diag("info", "CACHE", "Same parcel returned from a 15-minute server memory cache so Google was not billed again. Coordinates are not written to a server disk."),
    ];
    return { ok: true, job };
  }

  const logs: Diagnostic[] = [];
  let formatted: string | null = null;
  let resolvedPlace = placeId || null;
  let lat: number | null = null;
  let lng: number | null = null;
  let locationType: string | null = null;
  let partial = false;
  let coordinateSource: string | null = null;

  if (placeId) {
    const details = await placeDetails(placeId, input.sessionToken, logs);
    if (details) {
      formatted = details.address;
      lat = details.lat;
      lng = details.lng;
      resolvedPlace = placeId;
      coordinateSource = "Places API (New) location";
    }
  }

  if (lat == null || lng == null || !resolvedPlace) {
    const coded = await geocode(placeId ? { placeId } : { address: query }, logs);
    if (!coded) {
      return {
        ok: false,
        status: 422,
        message: placeId
          ? "Google could not resolve that place."
          : "Google Geocoding did not find that address.",
      };
    }
    formatted = coded.address;
    resolvedPlace = coded.placeId;
    lat = coded.lat;
    lng = coded.lng;
    locationType = coded.locationType;
    partial = coded.partial;
    coordinateSource = "Geocoding API geometry.location";
  }

  const validation = await validateAddress(formatted || query, logs);
  const solar = await solarInsights(lat, lng, logs);
  const cachedAt = new Date();
  const expiresAt = new Date(cachedAt.getTime() + COORD_TTL_MS);
  const stamp = cachedAt.toISOString();
  const job: Job = {
    id: crypto.randomUUID(),
    createdAt: stamp,
    updatedAt: stamp,
    input: query || formatted || placeId,
    formattedAddress: formatted,
    placeId: resolvedPlace,
    coordinateSource,
    locationType,
    partialMatch: partial,
    coordinates: {
      lat,
      lng,
      cachedAt: stamp,
      expiresAt: expiresAt.toISOString(),
    },
    geocodeStatus: "SUCCESS",
    addressValidation: validation,
    solar: solar.solar,
    planes: solar.planes,
    edges: [],
    existingSolar: emptyExisting(),
    review: { checked: false, verifiedAt: null },
    prices: {},
    diagnostics: logs,
  };
  measureCache.set(cacheKey, { at: Date.now(), job: structuredClone(job) });
  if (resolvedPlace) measureCache.set(`p:${resolvedPlace}`, { at: Date.now(), job: structuredClone(job) });
  return { ok: true, job };
}

export async function autocompletePlaces(input: string, sessionToken: string): Promise<Suggestion[]> {
  const text = input.trim();
  if (text.length < 3 || text.length > 200) return [];
  const cacheKey = text.toLowerCase();
  const cached = suggestCache.get(cacheKey);
  if (cached && Date.now() - cached.at < 60_000) return cached.suggestions;
  const res = await fetch("https://places.googleapis.com/v1/places:autocomplete", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "X-Goog-Api-Key": KEY,
      "X-Goog-FieldMask":
        "suggestions.placePrediction.placeId,suggestions.placePrediction.structuredFormat.mainText.text,suggestions.placePrediction.structuredFormat.secondaryText.text,suggestions.placePrediction.text.text",
    },
    body: JSON.stringify({
      input: text,
      includedRegionCodes: ["us"],
      sessionToken,
      languageCode: "en",
    }),
  });
  const json = (await readBody(res)) as {
    suggestions?: {
      placePrediction?: {
        placeId?: string;
        text?: { text?: string };
        structuredFormat?: { mainText?: { text?: string }; secondaryText?: { text?: string } };
      };
    }[];
  } | null;
  if (!res.ok || !json?.suggestions) return [];
  const suggestions: Suggestion[] = [];
  for (const row of json.suggestions) {
    const prediction = row.placePrediction;
    if (!prediction?.placeId) continue;
    suggestions.push({
      placeId: prediction.placeId,
      main: prediction.structuredFormat?.mainText?.text || prediction.text?.text || "Place",
      secondary: prediction.structuredFormat?.secondaryText?.text || "",
    });
    if (suggestions.length === 5) break;
  }
  suggestCache.set(cacheKey, { at: Date.now(), suggestions });
  return suggestions;
}

export function mapsConfig(): { apiKey: string; mapId: string; projectNumber: string } {
  return {
    apiKey: KEY,
    mapId: "DEMO_MAP_ID",
    projectNumber: confirmedProject || GOOGLE_CLOUD_PROJECT_NUMBER,
  };
}
