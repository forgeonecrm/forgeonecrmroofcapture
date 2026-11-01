import { i as __toESM } from "../_runtime.mjs";
import { q as require_react, x as require_jsx_runtime } from "../_libs/@tanstack/react-router+[...].mjs";
import { n as previewPathPrefix } from "./router-DqK8QbXP.mjs";
import { n as persist, r as create, t as createJSONStorage } from "../_libs/zustand.mjs";
import { i as useMapsLibrary, n as useMap, r as APIProvider, t as Map } from "../_libs/vis.gl__react-google-maps.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/routes-D4pyk8IC.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_runtime = require_jsx_runtime();
function apiUrl(path) {
	if (typeof window === "undefined") return path;
	return `${previewPathPrefix(window.location.hostname, window.location.pathname) ?? ""}${path}`;
}
async function fetchSuggestions(input, sessionToken, signal) {
	const res = await fetch(apiUrl("/api/places/autocomplete"), {
		method: "POST",
		headers: { "content-type": "application/json" },
		body: JSON.stringify({
			input,
			sessionToken
		}),
		signal
	});
	if (!res.ok) return [];
	return (await res.json()).suggestions ?? [];
}
async function measureAddress(input) {
	const res = await fetch(apiUrl("/api/property/measure"), {
		method: "POST",
		headers: { "content-type": "application/json" },
		body: JSON.stringify(input)
	});
	const data = await res.json();
	if (!res.ok || !data.job) throw new Error(data.message || "Lookup failed.");
	return data.job;
}
async function fetchMapConfig() {
	const res = await fetch(apiUrl("/api/maps/config"));
	if (!res.ok) throw new Error("Map configuration failed.");
	return await res.json();
}
var EDGE_KINDS = [
	"ridge",
	"hip",
	"valley",
	"eave",
	"rake",
	"flashing"
];
var EDGE_LABEL = {
	ridge: "Ridge",
	hip: "Hip",
	valley: "Valley",
	eave: "Eave",
	rake: "Rake",
	flashing: "Flashing"
};
var UNAVAILABLE = "Not available — requires additional analysis";
var SQFT_PER_M2 = 10.76391041671;
var FT_PER_M = 3.280839895;
var DIRS = [
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
	"NNW"
];
function haversineMeters(a, b) {
	const R = 6371008.8;
	const φ1 = a.lat * Math.PI / 180;
	const φ2 = b.lat * Math.PI / 180;
	const dφ = (b.lat - a.lat) * Math.PI / 180;
	const dλ = (b.lng - a.lng) * Math.PI / 180;
	const s = Math.sin(dφ / 2) ** 2 + Math.cos(φ1) * Math.cos(φ2) * Math.sin(dλ / 2) ** 2;
	return 2 * R * Math.asin(Math.min(1, Math.sqrt(s)));
}
function pathLengthFeet(path) {
	if (path.length < 2) return null;
	let meters = 0;
	for (let i = 1; i < path.length; i++) meters += haversineMeters(path[i - 1], path[i]);
	return meters * FT_PER_M;
}
/** Ground area of a ring on a local tangent plane. Accurate for roof-sized rings. */
function ringGroundSqMeters(path) {
	if (path.length < 3) return null;
	const lat0 = path.reduce((s, p) => s + p.lat, 0) / path.length;
	const lng0 = path.reduce((s, p) => s + p.lng, 0) / path.length;
	const pts = path.map((p) => ({
		x: (p.lng - lng0) * Math.cos(lat0 * Math.PI / 180) * 111320,
		y: (p.lat - lat0) * 111320
	}));
	let sum = 0;
	for (let i = 0; i < pts.length; i++) {
		const j = (i + 1) % pts.length;
		sum += pts[i].x * pts[j].y - pts[j].x * pts[i].y;
	}
	const area = Math.abs(sum) / 2;
	return Number.isFinite(area) ? area : null;
}
function surfaceFromGroundM2(groundM2, pitchDegrees) {
	if (!Number.isFinite(groundM2) || !Number.isFinite(pitchDegrees)) return null;
	const cos = Math.cos(pitchDegrees * Math.PI / 180);
	if (cos < .087) return null;
	return groundM2 / cos;
}
function degreesFromRise(rise) {
	return Math.atan(rise / 12) * 180 / Math.PI;
}
var LEGACY_RISE_CHIPS = /* @__PURE__ */ new Set([
	3,
	4,
	5,
	6,
	7,
	8,
	9,
	10,
	12
]);
/**
* Pitch chips used to save the rise number in the degrees field.
* 6 meant 6:12 (~26.6°), not a 6° roof. Idempotent: converted values are not integers in that set.
*/
function repairLegacyPitchDegrees(degrees, source) {
	if (degrees == null || source !== "MANUAL") return degrees;
	if (!LEGACY_RISE_CHIPS.has(degrees)) return degrees;
	return degreesFromRise(degrees);
}
function riseFromDegrees(degrees) {
	if (!Number.isFinite(degrees)) return null;
	const rise = 12 * Math.tan(degrees * Math.PI / 180);
	return Number.isFinite(rise) ? rise : null;
}
function pitchRatio(degrees) {
	const rise = riseFromDegrees(degrees);
	if (rise == null) return UNAVAILABLE;
	return `${rise.toFixed(1)}:12`;
}
function compass(degrees) {
	const n = (degrees % 360 + 360) % 360;
	return DIRS[Math.round(n / 22.5) % 16];
}
function m2ToSqFt(m2) {
	return m2 * SQFT_PER_M2;
}
function emptyFigures(note) {
	return {
		footprintSqFt: null,
		footprintSource: "UNAVAILABLE",
		surfaceSqFt: null,
		surfaceSource: "UNAVAILABLE",
		note
	};
}
/** Footprint is the flat aerial outline. Surface is the sloped roof area. */
function planeFigures(plane) {
	const pitch = plane.pitchDegrees;
	let footprintSqFt = null;
	let footprintSource = "UNAVAILABLE";
	if (plane.path && plane.path.length >= 3) {
		const ground = ringGroundSqMeters(plane.path);
		if (ground != null) {
			footprintSqFt = m2ToSqFt(ground);
			footprintSource = "CALCULATED";
		}
	} else if (plane.manual && plane.manual.lengthFt > 0 && plane.manual.widthFt > 0 && plane.manual.dimension === "FOOTPRINT") {
		footprintSqFt = plane.manual.lengthFt * plane.manual.widthFt;
		footprintSource = "MANUAL";
	} else if (plane.solar?.groundAreaMeters2 != null) {
		footprintSqFt = m2ToSqFt(plane.solar.groundAreaMeters2);
		footprintSource = "CONVERTED";
	}
	if (plane.areaOverrideSqFt != null && Number.isFinite(plane.areaOverrideSqFt)) return {
		footprintSqFt,
		footprintSource,
		surfaceSqFt: plane.areaOverrideSqFt,
		surfaceSource: "MANUAL",
		note: "Slope area is an estimator correction. The footprint figure is separate."
	};
	if (plane.path && plane.path.length >= 3) {
		if (footprintSqFt == null) return emptyFigures(UNAVAILABLE);
		if (pitch == null) return {
			footprintSqFt,
			footprintSource,
			surfaceSqFt: null,
			surfaceSource: "UNAVAILABLE",
			note: "The trace is the flat footprint on the aerial. Set a pitch to get slope area."
		};
		const ground = ringGroundSqMeters(plane.path);
		const surface = ground == null ? null : surfaceFromGroundM2(ground, pitch);
		return {
			footprintSqFt,
			footprintSource,
			surfaceSqFt: surface == null ? null : m2ToSqFt(surface),
			surfaceSource: surface == null ? "UNAVAILABLE" : "CALCULATED",
			note: "Slope area = traced footprint ÷ cos(pitch). This trace is not a Solar outline."
		};
	}
	if (plane.manual && plane.manual.lengthFt > 0 && plane.manual.widthFt > 0) {
		const rect = plane.manual.lengthFt * plane.manual.widthFt;
		if (plane.manual.dimension === "SURFACE") return {
			footprintSqFt,
			footprintSource,
			surfaceSqFt: rect,
			surfaceSource: "MANUAL",
			note: "Length × width entered as slope area."
		};
		if (pitch == null) return {
			footprintSqFt: rect,
			footprintSource: "MANUAL",
			surfaceSqFt: null,
			surfaceSource: "UNAVAILABLE",
			note: "Footprint entered. Set a pitch to get slope area."
		};
		const cos = Math.cos(pitch * Math.PI / 180);
		const surface = cos < .087 ? null : rect / cos;
		return {
			footprintSqFt: rect,
			footprintSource: "MANUAL",
			surfaceSqFt: surface,
			surfaceSource: surface == null ? "UNAVAILABLE" : "CALCULATED",
			note: "Entered footprint ÷ cos(pitch)."
		};
	}
	if (plane.solar?.areaMeters2 != null) return {
		footprintSqFt,
		footprintSource,
		surfaceSqFt: m2ToSqFt(plane.solar.areaMeters2),
		surfaceSource: "CONVERTED",
		note: "Slope area converted from Solar stats.areaMeters2. Footprint uses groundAreaMeters2 when Google sent it."
	};
	return emptyFigures(UNAVAILABLE);
}
function planeArea(plane) {
	const figures = planeFigures(plane);
	return {
		sqFt: figures.surfaceSqFt,
		source: figures.surfaceSource,
		detail: figures.note
	};
}
function edgeLength(edge) {
	if (edge.lengthOverrideFt != null && Number.isFinite(edge.lengthOverrideFt)) return {
		feet: edge.lengthOverrideFt,
		source: "MANUAL",
		detail: edge.path.length >= 2 ? "Entered length overrides the trace." : "Entered length. Not plotted."
	};
	const traced = pathLengthFeet(edge.path);
	if (traced == null) return {
		feet: null,
		source: "UNAVAILABLE",
		detail: UNAVAILABLE
	};
	return {
		feet: traced,
		source: "CALCULATED",
		detail: "Geodesic length of the line drawn on the aerial."
	};
}
function edgeTotals(edges) {
	const out = {};
	for (const kind of EDGE_KINDS) {
		const known = edges.filter((e) => e.kind === kind).map(edgeLength).filter((r) => r.feet != null);
		if (known.length === 0) out[kind] = {
			feet: null,
			source: "UNAVAILABLE"
		};
		else out[kind] = {
			feet: known.reduce((s, r) => s + (r.feet ?? 0), 0),
			source: known.every((r) => r.source === "CALCULATED") ? "CALCULATED" : known.every((r) => r.source === "MANUAL") ? "MANUAL" : "CALCULATED"
		};
	}
	return out;
}
function footprintTotalSqFt(job) {
	const values = job.planes.map((plane) => planeFigures(plane).footprintSqFt).filter((n) => n != null);
	if (values.length === 0) return job.solar.wholeRoofGroundM2 == null ? null : m2ToSqFt(job.solar.wholeRoofGroundM2);
	return values.reduce((sum, n) => sum + n, 0);
}
function workingSurfaceSqFt(job) {
	const planeReadings = job.planes.map(planeArea).filter((r) => r.sqFt != null);
	if (planeReadings.length > 0) {
		const sqFt = planeReadings.reduce((s, r) => s + (r.sqFt ?? 0), 0);
		const anyManual = job.planes.some((p) => p.origin === "MANUAL" || p.areaOverrideSqFt != null || p.path && p.path.length >= 3);
		return {
			sqFt,
			source: anyManual ? "CALCULATED" : "CONVERTED",
			detail: anyManual ? "Sum of slope areas from traces, pitches, and corrections." : "Sum of Solar segment slope areas converted to square feet. This can differ from wholeRoofStats."
		};
	}
	if (job.solar.wholeRoofAreaM2 != null) return {
		sqFt: m2ToSqFt(job.solar.wholeRoofAreaM2),
		source: "CONVERTED",
		detail: "No per-plane area. Using Solar solarPotential.wholeRoofStats.areaMeters2, converted to sq ft."
	};
	return {
		sqFt: null,
		source: "UNAVAILABLE",
		detail: UNAVAILABLE
	};
}
function reviewChecks(job) {
	const area = workingSurfaceSqFt(job);
	return [
		{
			id: "pin",
			label: "Google returned a place and a coordinate for this parcel",
			pass: job.geocodeStatus === "SUCCESS" && !!job.placeId && !!job.coordinates
		},
		{
			id: "area",
			label: "At least one roof area came from Solar or from an estimator trace or entry",
			pass: area.sqFt != null && area.sqFt > 0
		},
		{
			id: "ack",
			label: "Estimator confirmed the figures against the aerial or a site visit",
			pass: job.review.checked
		}
	];
}
function isVerified(job) {
	return reviewChecks(job).every((c) => c.pass) && !!job.review.verifiedAt;
}
function formatMeasure(value, digits, unit) {
	if (value == null || !Number.isFinite(value)) return UNAVAILABLE;
	return `${value.toLocaleString("en-US", {
		minimumFractionDigits: digits,
		maximumFractionDigits: digits
	})} ${unit}`;
}
function bboxPath(box) {
	return [
		{
			lat: box.sw.lat,
			lng: box.sw.lng
		},
		{
			lat: box.ne.lat,
			lng: box.sw.lng
		},
		{
			lat: box.ne.lat,
			lng: box.ne.lng
		},
		{
			lat: box.sw.lat,
			lng: box.ne.lng
		}
	];
}
var MATERIAL_LABEL = {
	asphalt: "Architectural asphalt",
	metal: "Standing seam metal",
	tile: "Concrete S tile",
	tpo: "60-mil TPO"
};
var WASTE_OPTIONS = [
	5,
	10,
	12,
	15,
	20
];
function ceilDiv(value, size) {
	return Math.ceil(value / size);
}
function line(id, item, formula, qty, unit, reason) {
	return {
		id,
		item,
		formula,
		qty,
		unit,
		reason
	};
}
function needEdges(feet, label) {
	return feet == null ? `${label}: ${UNAVAILABLE}` : void 0;
}
function materialBom(system, wastePct, areaSqFt, edges) {
	if (areaSqFt == null || areaSqFt <= 0) return [line("area", "Field material", "Needs a roof surface area", null, "—", UNAVAILABLE)];
	const waste = 1 + wastePct / 100;
	const squares = areaSqFt * waste / 100;
	const eave = edges.eave;
	const rake = edges.rake;
	const ridge = edges.ridge;
	const hip = edges.hip;
	const valley = edges.valley;
	const drip = eave != null && rake != null ? eave + rake : null;
	const hipRidge = ridge != null && hip != null ? ridge + hip : null;
	if (system === "asphalt") return [
		line("shingles", "Architectural shingles", `${squares.toFixed(2)} sq × 3 bundles/sq`, ceilDiv(squares, 1 / 3), "bundles"),
		line("underlayment", "Synthetic underlayment", `${squares.toFixed(2)} sq ÷ 10 sq/roll`, Math.ceil(squares / 10), "rolls"),
		line("starter", "Starter strip", drip == null ? "eaves + rakes" : `${drip.toFixed(1)} lf ÷ 100 lf/roll`, drip == null ? null : Math.ceil(drip / 100), "rolls", needEdges(drip, "Eaves and rakes")),
		line("hipridge", "Hip and ridge cap", hipRidge == null ? "ridges + hips" : `${hipRidge.toFixed(1)} lf ÷ 25 lf/bundle`, hipRidge == null ? null : Math.ceil(hipRidge / 25), "bundles", needEdges(hipRidge, "Ridges and hips")),
		line("ice", "Ice and water", "Assumes 3 ft along eaves and 6 ft total valley width, 200 sq ft/roll", eave == null || valley == null ? null : Math.ceil((eave * 3 + valley * 6) / 200), "rolls", eave == null || valley == null ? `Eaves and valleys: ${UNAVAILABLE}` : void 0),
		line("drip", "Drip edge", drip == null ? "eaves + rakes" : `${drip.toFixed(1)} lf × 1.10 ÷ 10 ft sticks`, drip == null ? null : Math.ceil(drip * 1.1 / 10), "sticks", needEdges(drip, "Eaves and rakes")),
		line("nails", "Coil nails", `${squares.toFixed(2)} sq × 2.5 lb`, Math.ceil(squares * 2.5), "lb")
	];
	if (system === "metal") return [
		line("panels", "16 in standing-seam panels", `${(areaSqFt * waste).toFixed(0)} sq ft of panel`, Math.ceil(areaSqFt * waste), "sq ft"),
		line("ridge", "Ridge cap", ridge == null ? "ridge length" : `${ridge.toFixed(1)} lf × 1.10`, ridge == null ? null : Math.ceil(ridge * 1.1), "lf", needEdges(ridge, "Ridges")),
		line("rake", "Rake trim", rake == null ? "rake length" : `${rake.toFixed(1)} lf × 1.10`, rake == null ? null : Math.ceil(rake * 1.1), "lf", needEdges(rake, "Rakes")),
		line("valley", "W-valley", valley == null ? "valley length" : `${valley.toFixed(1)} lf × 1.10`, valley == null ? null : Math.ceil(valley * 1.1), "lf", needEdges(valley, "Valleys")),
		line("underlayment", "High-temp underlayment", `${squares.toFixed(2)} sq ÷ 10`, Math.ceil(squares / 10), "rolls"),
		line("clips", "Expansion clips", "about 1 clip per 2 sq ft of panel", Math.ceil(areaSqFt * waste / 2), "clips")
	];
	if (system === "tile") return [
		line("tile", "Field tile", `${squares.toFixed(2)} sq × 90 tiles/sq`, Math.ceil(squares * 90), "tiles"),
		line("caps", "Hip and ridge caps", hipRidge == null ? "ridges + hips" : `${hipRidge.toFixed(1)} lf ÷ 1 ft per cap`, hipRidge == null ? null : Math.ceil(hipRidge), "caps", needEdges(hipRidge, "Ridges and hips")),
		line("underlayment", "Self-adhered underlayment", `${squares.toFixed(2)} sq ÷ 2 sq/roll`, Math.ceil(squares / 2), "rolls"),
		line("battens", "1×2 battens", `${squares.toFixed(2)} sq × 32 lf`, Math.ceil(squares * 32), "lf")
	];
	return [
		line("membrane", "60-mil TPO", `${squares.toFixed(2)} sq ÷ 10 sq/roll`, Math.ceil(squares / 10), "rolls"),
		line("iso", "2 in polyiso", `${(areaSqFt * waste).toFixed(0)} sq ft ÷ 32 sq ft/board`, Math.ceil(areaSqFt * waste / 32), "boards"),
		line("plates", "Plates and fasteners", "4 per 32 sq ft board", Math.ceil(areaSqFt * waste / 32) * 4, "sets"),
		line("adhesive", "Bonding adhesive", `${squares.toFixed(2)} sq ÷ 6 sq per 5-gal pail`, Math.ceil(squares / 6), "pails"),
		line("edge", "Edge metal", drip == null ? "eaves + rakes" : `${drip.toFixed(1)} lf × 1.10 ÷ 10 ft`, drip == null ? null : Math.ceil(drip * 1.1 / 10), "sticks", needEdges(drip, "Eaves and rakes"))
	];
}
function cell(value) {
	return `"${(value == null || value === "" ? "" : String(value)).replace(/"/g, "\"\"")}"`;
}
function row(values) {
	return values.map(cell).join(",");
}
function jobToCsv(job, system, wastePct) {
	const area = workingSurfaceSqFt(job);
	const totals = edgeTotals(job.edges);
	const lines = [];
	lines.push(row(["ForgeOne roof geometry"]));
	lines.push(row(["Address", job.formattedAddress ?? job.input]));
	lines.push(row(["Place ID", job.placeId ?? ""]));
	lines.push(row(["Coordinate source", job.coordinateSource ?? ""]));
	lines.push(row(["Latitude", job.coordinates ? job.coordinates.lat : UNAVAILABLE]));
	lines.push(row(["Longitude", job.coordinates ? job.coordinates.lng : UNAVAILABLE]));
	lines.push(row(["Coordinates cached", job.coordinates?.cachedAt ?? ""]));
	lines.push(row(["Coordinates expire", job.coordinates?.expiresAt ?? ""]));
	lines.push(row(["Geocoding", job.geocodeStatus]));
	lines.push(row([
		"Address validation",
		job.addressValidation.status,
		job.addressValidation.message
	]));
	lines.push(row([
		"Solar API",
		job.solar.status,
		job.solar.message
	]));
	lines.push(row(["Imagery quality", job.solar.imageryQuality ?? "Not available — requires additional analysis"]));
	lines.push(row(["Imagery date", job.solar.imageryDate ?? "Not available — requires additional analysis"]));
	lines.push(row([
		"Whole roof m2",
		job.solar.wholeRoofAreaM2 ?? "Not available — requires additional analysis",
		"solarPotential.wholeRoofStats.areaMeters2"
	]));
	lines.push(row([
		"Working surface sq ft",
		area.sqFt ?? "Not available — requires additional analysis",
		area.detail
	]));
	lines.push(row(["Working surface source", area.source]));
	lines.push(row([
		"Max array panels",
		job.solar.maxPanels ?? "Not available — requires additional analysis",
		"solarPotential.maxArrayPanelsCount (potential, not an existing system)"
	]));
	lines.push(row(["Panel watts", job.solar.panelCapacityWatts ?? "Not available — requires additional analysis"]));
	lines.push(row(["Max sunshine hours per year", job.solar.maxSunshineHours ?? "Not available — requires additional analysis"]));
	for (const kind of EDGE_KINDS) {
		const total = totals[kind];
		lines.push(row([
			EDGE_LABEL[kind] + " ft",
			total.feet ?? "Not available — requires additional analysis",
			total.source
		]));
	}
	lines.push(row(["Existing solar recorded", job.existingSolar.recorded ? "yes" : "no"]));
	lines.push(row(["Existing solar present", job.existingSolar.recorded ? job.existingSolar.present ? "yes" : "no" : UNAVAILABLE]));
	lines.push(row(["Existing panel count", job.existingSolar.panelCount ?? ""]));
	lines.push(row(["Existing kW", job.existingSolar.capacityKw ?? ""]));
	lines.push(row([]));
	lines.push(row(["Planes"]));
	lines.push(row([
		"Label",
		"Origin",
		"Pitch deg",
		"Pitch source",
		"Ratio",
		"Azimuth deg",
		"Azimuth source",
		"Heading",
		"Area sq ft",
		"Area source",
		"Solar m2",
		"Solar ground m2",
		"Height m"
	]));
	for (const plane of job.planes) {
		const reading = planeArea(plane);
		lines.push(row([
			plane.label,
			plane.origin,
			plane.pitchDegrees,
			plane.pitchSource,
			plane.pitchDegrees == null ? UNAVAILABLE : pitchRatio(plane.pitchDegrees),
			plane.azimuthDegrees,
			plane.azimuthSource,
			plane.azimuthDegrees == null ? UNAVAILABLE : compass(plane.azimuthDegrees),
			reading.sqFt,
			reading.source,
			plane.solar?.areaMeters2,
			plane.solar?.groundAreaMeters2,
			plane.solar?.heightMeters
		]));
	}
	lines.push(row([]));
	lines.push(row(["Edges"]));
	lines.push(row([
		"Kind",
		"Feet",
		"Source",
		"Points",
		"Detail"
	]));
	for (const edge of job.edges) {
		const length = edgeLength(edge);
		lines.push(row([
			edge.kind,
			length.feet,
			length.source,
			edge.path.length,
			length.detail
		]));
	}
	lines.push(row([]));
	lines.push(row([
		"Materials",
		system,
		`waste ${wastePct}%`
	]));
	lines.push(row([
		"Item",
		"Qty",
		"Unit",
		"Formula",
		"Unit price",
		"Extended"
	]));
	for (const item of materialBom(system, wastePct, area.sqFt, {
		ridge: totals.ridge.feet,
		hip: totals.hip.feet,
		valley: totals.valley.feet,
		eave: totals.eave.feet,
		rake: totals.rake.feet,
		flashing: totals.flashing.feet
	})) {
		const price = job.prices[item.id];
		const extended = item.qty != null && price != null ? item.qty * price : "";
		lines.push(row([
			item.item,
			item.qty ?? "Not available — requires additional analysis",
			item.unit,
			item.reason ?? item.formula,
			price ?? "",
			extended
		]));
	}
	lines.push(row([]));
	lines.push(row(["API log"]));
	for (const entry of job.diagnostics) lines.push(row([
		entry.at,
		entry.level,
		entry.service,
		entry.message
	]));
	return lines.join("\n");
}
function purgeCoordinates(job) {
	if (!job.coordinates) return job;
	if (new Date(job.coordinates.expiresAt).getTime() > Date.now()) return job;
	return {
		...job,
		coordinates: null,
		diagnostics: [...job.diagnostics, {
			at: (/* @__PURE__ */ new Date()).toISOString(),
			level: "info",
			service: "CACHE",
			message: "Coordinates removed after the 30-day limit. The Place ID was kept. Measure the address again to refresh the pin."
		}]
	};
}
function repairJob(job) {
	const purged = purgeCoordinates(job);
	return {
		...purged,
		planes: purged.planes.map((plane) => {
			const pitchDegrees = repairLegacyPitchDegrees(plane.pitchDegrees, plane.pitchSource);
			if (pitchDegrees === plane.pitchDegrees) return plane;
			return {
				...plane,
				pitchDegrees
			};
		})
	};
}
var memoryStorage = {
	getItem: () => null,
	setItem: () => {},
	removeItem: () => {}
};
var usePipeline = create()(persist((set) => ({
	jobs: [],
	selectedId: null,
	hydrated: false,
	setHydrated: (hydrated) => set({ hydrated }),
	select: (selectedId) => set({ selectedId }),
	upsertMeasured: (incoming) => set((state) => {
		const prev = state.jobs.find((job) => job.placeId && job.placeId === incoming.placeId);
		if (!prev) return {
			jobs: [incoming, ...state.jobs],
			selectedId: incoming.id
		};
		const merged = {
			...incoming,
			id: prev.id,
			createdAt: prev.createdAt,
			planes: [...incoming.planes, ...prev.planes.filter((plane) => plane.origin === "MANUAL")],
			edges: prev.edges,
			existingSolar: prev.existingSolar,
			prices: prev.prices,
			review: {
				checked: false,
				verifiedAt: null
			}
		};
		return {
			selectedId: prev.id,
			jobs: state.jobs.map((job) => job.id === prev.id ? merged : job)
		};
	}),
	patch: (id, recipe, options) => set((state) => ({ jobs: state.jobs.map((job) => {
		if (job.id !== id) return job;
		const next = recipe(job);
		return {
			...next,
			updatedAt: (/* @__PURE__ */ new Date()).toISOString(),
			review: options?.keepReview ? next.review : {
				checked: false,
				verifiedAt: null
			}
		};
	}) })),
	remove: (id) => set((state) => ({
		jobs: state.jobs.filter((job) => job.id !== id),
		selectedId: state.selectedId === id ? null : state.selectedId
	}))
}), {
	name: "forgeone-roof-pipeline-v1",
	storage: createJSONStorage(() => typeof window === "undefined" ? memoryStorage : localStorage),
	skipHydration: true,
	partialize: (state) => ({
		jobs: state.jobs,
		selectedId: state.selectedId
	})
}));
async function hydratePipeline() {
	await usePipeline.persist.rehydrate();
	usePipeline.setState((state) => ({
		jobs: state.jobs.map(repairJob),
		hydrated: true
	}));
}
function Badge({ source }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
		className: `badge badge-${source.toLowerCase()}`,
		children: source === "SOLAR" ? "Solar" : source === "CONVERTED" ? "Converted" : source === "CALCULATED" ? "Calculated" : source === "MANUAL" ? "Manual" : "Unavailable"
	});
}
function Metric({ label, value, source, detail }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "rounded-md border border-line bg-surface-2 p-3",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "flex items-center justify-between gap-2",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "text-xs uppercase tracking-wide text-muted",
					children: label
				}), source ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Badge, { source }) : null]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "mt-1 text-sm text-fg",
				children: value
			}),
			detail ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "mt-1 text-xs text-muted",
				children: detail
			}) : null
		]
	});
}
function MeasurePanel({ job, selectedPlaneId, selectedEdgeId, material, waste, onMaterial, onWaste, onSelectPlane, onSelectEdge, onPatch, onOpenDiagnostics }) {
	if (!job) return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("aside", {
		className: "flex h-full flex-col gap-3 overflow-y-auto border-line p-4 md:border-l",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
			className: "font-display text-xl uppercase tracking-wide",
			children: "Measurements"
		}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
			className: "text-sm text-muted",
			children: "Measure a street address. If Solar returns planes, pitch, azimuth, and area show up here with the Google field that supplied them. Edges stay blank until you draw or enter them."
		})]
	});
	const area = workingSurfaceSqFt(job);
	const footprint = footprintTotalSqFt(job);
	const totals = edgeTotals(job.edges);
	const checks = reviewChecks(job);
	const verified = isVerified(job);
	const bom = materialBom(material, waste, area.sqFt, {
		ridge: totals.ridge.feet,
		hip: totals.hip.feet,
		valley: totals.valley.feet,
		eave: totals.eave.feet,
		rake: totals.rake.feet,
		flashing: totals.flashing.feet
	});
	const capacityKw = job.solar.maxPanels != null && job.solar.panelCapacityWatts != null ? job.solar.maxPanels * job.solar.panelCapacityWatts / 1e3 : null;
	const updatePlane = (id, recipe) => {
		onPatch((current) => ({
			...current,
			planes: current.planes.map((plane) => plane.id === id ? recipe(plane) : plane)
		}));
	};
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("aside", {
		className: "flex h-full flex-col gap-4 overflow-y-auto border-line p-4 md:border-l",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "flex items-start justify-between gap-2",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
					className: "font-display text-xl uppercase tracking-wide",
					children: "Measurements"
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "text-sm text-muted",
					children: job.formattedAddress || job.input
				})] }), verified ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
					className: "badge badge-manual",
					children: "Estimator verified"
				}) : null]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "flex flex-wrap gap-2 text-xs text-muted",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { children: ["Place ID ", job.placeId || "Not available — requires additional analysis"] }),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "·" }),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: job.coordinates ? `Pin expires ${new Date(job.coordinates.expiresAt).toLocaleDateString()}` : "Coordinates expired or missing" })
				]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "grid gap-2",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Metric, {
						label: "Footprint",
						value: formatMeasure(footprint, 0, "sq ft"),
						source: footprint == null ? "UNAVAILABLE" : "CALCULATED",
						detail: "Flat area of the traces, or Solar groundAreaMeters2. Not the slope."
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Metric, {
						label: "Slope area",
						value: formatMeasure(area.sqFt, 0, "sq ft"),
						source: area.source,
						detail: area.detail
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Metric, {
						label: "Squares",
						value: area.sqFt == null ? UNAVAILABLE : formatMeasure(area.sqFt / 100, 2, "sq"),
						source: area.sqFt == null ? "UNAVAILABLE" : "CALCULATED",
						detail: "Slope area ÷ 100. This is the number materials use."
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Metric, {
						label: "Solar potential",
						value: job.solar.maxPanels == null ? UNAVAILABLE : `${job.solar.maxPanels} panels${capacityKw == null ? "" : ` · ${capacityKw.toFixed(2)} kW calculated`}`,
						source: job.solar.maxPanels == null ? "UNAVAILABLE" : "SOLAR",
						detail: "maxArrayPanelsCount and panelCapacityWatts. This is potential, not an existing array."
					})
				]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
				className: "flex flex-col gap-2",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h3", {
						className: "text-sm font-semibold",
						children: "Planes"
					}),
					job.planes.length === 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "text-sm text-muted",
						children: "No planes yet. Draw a facet on the aerial, or add length and width below."
					}) : null,
					job.planes.map((plane) => {
						const figures = planeFigures(plane);
						const open = plane.id === selectedPlaneId;
						const rise = plane.pitchDegrees == null ? null : riseFromDegrees(plane.pitchDegrees);
						return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: `rounded-md border p-3 ${open ? "border-accent" : "border-line"}`,
							children: [
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
									type: "button",
									className: "flex w-full items-center justify-between gap-2 text-left",
									onClick: () => onSelectPlane(open ? null : plane.id),
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
										className: "font-medium",
										children: plane.label
									}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Badge, { source: plane.origin === "SOLAR" ? "SOLAR" : "MANUAL" })]
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
									className: "mt-2 text-sm",
									children: [
										"Pitch ",
										rise == null ? "not set" : `${rise.toFixed(1)}:12`,
										plane.pitchDegrees == null ? "" : ` · ${plane.pitchDegrees.toFixed(1)}°`
									]
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
									className: "text-sm",
									children: ["Azimuth ", plane.azimuthDegrees == null ? "not set" : `${plane.azimuthDegrees.toFixed(0)}° ${compass(plane.azimuthDegrees)}`]
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
									className: "text-sm",
									children: ["Footprint ", formatMeasure(figures.footprintSqFt, 0, "sq ft")]
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
									className: "text-sm",
									children: ["Slope ", formatMeasure(figures.surfaceSqFt, 0, "sq ft")]
								}),
								plane.solar?.areaMeters2 != null ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
									className: "text-xs text-muted",
									children: [
										"Solar slope ",
										plane.solar.areaMeters2.toFixed(2),
										" m² · ",
										m2ToSqFt(plane.solar.areaMeters2).toFixed(0),
										" sq ft"
									]
								}) : null,
								plane.solar?.boundingBox && !plane.path ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
									className: "text-xs text-muted",
									children: "A dashed box is the Solar bounding box, not the roof outline."
								}) : null,
								open ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "mt-3 grid gap-2",
									children: [
										/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
											className: "text-xs text-muted",
											children: "Pitch is rise per 12. 6:12 is 26.6°, not 6°."
										}),
										/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
											className: "flex flex-wrap gap-1",
											children: [
												3,
												4,
												5,
												6,
												7,
												8,
												9,
												10,
												12
											].map((value) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
												type: "button",
												className: rise != null && Math.abs(rise - value) < .2 ? "btn-solid" : "btn-quiet",
												onClick: () => updatePlane(plane.id, (current) => ({
													...current,
													pitchDegrees: degreesFromRise(value),
													pitchSource: "MANUAL"
												})),
												children: [value, ":12"]
											}, value))
										}),
										/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", {
											className: "grid gap-1 text-xs text-muted",
											children: ["Azimuth degrees", /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
												className: "field",
												type: "number",
												step: "1",
												value: plane.azimuthDegrees ?? "",
												onChange: (event) => {
													const value = event.target.value === "" ? null : Number(event.target.value);
													updatePlane(plane.id, (current) => ({
														...current,
														azimuthDegrees: value,
														azimuthSource: value == null ? "UNAVAILABLE" : current.solar && value === current.solar.azimuthDegrees ? "SOLAR" : "MANUAL"
													}));
												}
											})]
										}),
										/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", {
											className: "grid gap-1 text-xs text-muted",
											children: ["Slope area correction (sq ft)", /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
												className: "field",
												type: "number",
												step: "1",
												value: plane.areaOverrideSqFt ?? "",
												onChange: (event) => {
													const value = event.target.value === "" ? null : Number(event.target.value);
													updatePlane(plane.id, (current) => ({
														...current,
														areaOverrideSqFt: value
													}));
												}
											})]
										}),
										/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
											className: "text-xs text-muted",
											children: figures.note
										}),
										plane.origin === "SOLAR" ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
											type: "button",
											className: "btn-quiet",
											onClick: () => updatePlane(plane.id, (current) => ({
												...current,
												pitchDegrees: current.solar?.pitchDegrees ?? null,
												pitchSource: current.solar?.pitchDegrees == null ? "UNAVAILABLE" : "SOLAR",
												azimuthDegrees: current.solar?.azimuthDegrees ?? null,
												azimuthSource: current.solar?.azimuthDegrees == null ? "UNAVAILABLE" : "SOLAR",
												areaOverrideSqFt: null
											})),
											children: "Reset corrections"
										}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
											type: "button",
											className: "btn-quiet",
											onClick: () => onPatch((current) => ({
												...current,
												planes: current.planes.filter((item) => item.id !== plane.id)
											})),
											children: "Remove plane"
										}),
										/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", {
											className: "flex items-center gap-2 text-sm",
											children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
												type: "checkbox",
												checked: plane.hasExistingPanels,
												onChange: (event) => updatePlane(plane.id, (current) => ({
													...current,
													hasExistingPanels: event.target.checked
												}))
											}), "Existing panels on this plane"]
										})
									]
								}) : null
							]
						}, plane.id);
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(ManualPlaneForm, { onAdd: (plane) => onPatch((current) => ({
						...current,
						planes: [...current.planes, plane]
					})) })
				]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
				className: "flex flex-col gap-2",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h3", {
						className: "text-sm font-semibold",
						children: "Edges"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
						className: "text-xs text-muted",
						children: [
							"A dash means ",
							UNAVAILABLE,
							". Draw the line on the aerial or enter the length. Solar does not classify edges."
						]
					}),
					EDGE_KINDS.map((kind) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "flex items-center justify-between gap-2 text-sm",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: EDGE_LABEL[kind] }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
							className: "text-right",
							children: totals[kind].feet == null ? "—" : formatMeasure(totals[kind].feet, 1, "ft")
						})]
					}, kind)),
					job.edges.map((edge) => {
						const length = edgeLength(edge);
						const open = edge.id === selectedEdgeId;
						return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: `rounded-md border p-3 ${open ? "border-accent" : "border-line"}`,
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
								type: "button",
								className: "text-left text-sm font-medium",
								onClick: () => onSelectEdge(open ? null : edge.id),
								children: [
									EDGE_LABEL[edge.kind],
									" · ",
									length.feet == null ? UNAVAILABLE : `${length.feet.toFixed(1)} ft`
								]
							}), open ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "mt-2 grid gap-2",
								children: [
									/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", {
										className: "grid gap-1 text-xs text-muted",
										children: ["Kind", /* @__PURE__ */ (0, import_jsx_runtime.jsx)("select", {
											className: "field",
											value: edge.kind,
											onChange: (event) => onPatch((current) => ({
												...current,
												edges: current.edges.map((item) => item.id === edge.id ? {
													...item,
													kind: event.target.value
												} : item)
											})),
											children: EDGE_KINDS.map((kind) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
												value: kind,
												children: EDGE_LABEL[kind]
											}, kind))
										})]
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", {
										className: "grid gap-1 text-xs text-muted",
										children: ["Length feet", /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
											className: "field",
											type: "number",
											step: "0.1",
											value: edge.lengthOverrideFt ?? "",
											placeholder: length.feet == null ? "" : length.feet.toFixed(1),
											onChange: (event) => {
												const value = event.target.value === "" ? null : Number(event.target.value);
												onPatch((current) => ({
													...current,
													edges: current.edges.map((item) => item.id === edge.id ? {
														...item,
														lengthOverrideFt: value
													} : item)
												}));
											}
										})]
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
										className: "text-xs text-muted",
										children: length.detail
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
										type: "button",
										className: "btn-quiet",
										onClick: () => onPatch((current) => ({
											...current,
											edges: current.edges.filter((item) => item.id !== edge.id)
										})),
										children: "Remove edge"
									})
								]
							}) : null]
						}, edge.id);
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(EnteredEdgeForm, { onAdd: (kind, feet) => onPatch((current) => ({
						...current,
						edges: [...current.edges, {
							id: crypto.randomUUID(),
							kind,
							path: [],
							lengthOverrideFt: feet,
							origin: "ENTERED"
						}]
					})) })
				]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
				className: "flex flex-col gap-2",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h3", {
						className: "text-sm font-semibold",
						children: "Existing solar"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "text-xs text-muted",
						children: "Not detected from imagery. Record it only if you have seen the array."
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", {
						className: "flex items-center gap-2 text-sm",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
							type: "checkbox",
							checked: job.existingSolar.recorded,
							onChange: (event) => onPatch((current) => ({
								...current,
								existingSolar: {
									...current.existingSolar,
									recorded: event.target.checked
								}
							}))
						}), "Record an existing system"]
					}),
					job.existingSolar.recorded ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "grid gap-2",
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", {
								className: "flex items-center gap-2 text-sm",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
									type: "checkbox",
									checked: job.existingSolar.present,
									onChange: (event) => onPatch((current) => ({
										...current,
										existingSolar: {
											...current.existingSolar,
											present: event.target.checked
										}
									}))
								}), "Array is on the roof"]
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", {
								className: "grid gap-1 text-xs text-muted",
								children: ["Panels", /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
									className: "field",
									type: "number",
									value: job.existingSolar.panelCount ?? "",
									onChange: (event) => onPatch((current) => ({
										...current,
										existingSolar: {
											...current.existingSolar,
											panelCount: event.target.value === "" ? null : Number(event.target.value)
										}
									}))
								})]
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", {
								className: "grid gap-1 text-xs text-muted",
								children: ["System kW", /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
									className: "field",
									type: "number",
									step: "0.1",
									value: job.existingSolar.capacityKw ?? "",
									onChange: (event) => onPatch((current) => ({
										...current,
										existingSolar: {
											...current.existingSolar,
											capacityKw: event.target.value === "" ? null : Number(event.target.value)
										}
									}))
								})]
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", {
								className: "grid gap-1 text-xs text-muted",
								children: ["Inverter", /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
									className: "field",
									value: job.existingSolar.inverter,
									onChange: (event) => onPatch((current) => ({
										...current,
										existingSolar: {
											...current.existingSolar,
											inverter: event.target.value
										}
									}))
								})]
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", {
								className: "grid gap-1 text-xs text-muted",
								children: ["Year", /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
									className: "field",
									type: "number",
									value: job.existingSolar.year ?? "",
									onChange: (event) => onPatch((current) => ({
										...current,
										existingSolar: {
											...current.existingSolar,
											year: event.target.value === "" ? null : Number(event.target.value)
										}
									}))
								})]
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", {
								className: "grid gap-1 text-xs text-muted",
								children: ["Condition", /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
									className: "field",
									value: job.existingSolar.condition,
									onChange: (event) => onPatch((current) => ({
										...current,
										existingSolar: {
											...current.existingSolar,
											condition: event.target.value
										}
									}))
								})]
							})
						]
					}) : null
				]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
				className: "flex flex-col gap-2",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h3", {
						className: "text-sm font-semibold",
						children: "Materials"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "flex flex-wrap gap-2",
						children: Object.keys(MATERIAL_LABEL).map((key) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
							type: "button",
							className: material === key ? "btn-solid" : "btn-quiet",
							onClick: () => onMaterial(key),
							children: MATERIAL_LABEL[key]
						}, key))
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", {
						className: "grid gap-1 text-xs text-muted",
						children: ["Waste", /* @__PURE__ */ (0, import_jsx_runtime.jsx)("select", {
							className: "field",
							value: waste,
							onChange: (event) => onWaste(Number(event.target.value)),
							children: WASTE_OPTIONS.map((value) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("option", {
								value,
								children: [value, "%"]
							}, value))
						})]
					}),
					bom.map((item) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "rounded-md border border-line p-2 text-sm",
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "flex items-baseline justify-between gap-2",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: item.item }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: item.qty == null ? UNAVAILABLE : `${item.qty} ${item.unit}` })]
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
								className: "text-xs text-muted",
								children: item.reason || item.formula
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", {
								className: "mt-1 flex items-center gap-2 text-xs text-muted",
								children: ["Unit price", /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
									className: "field",
									type: "number",
									step: "0.01",
									value: job.prices[item.id] ?? "",
									onChange: (event) => {
										const value = event.target.value === "" ? void 0 : Number(event.target.value);
										onPatch((current) => {
											const prices = { ...current.prices };
											if (value == null || Number.isNaN(value)) delete prices[item.id];
											else prices[item.id] = value;
											return {
												...current,
												prices
											};
										}, true);
									}
								})]
							})
						]
					}, item.id))
				]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
				className: "flex flex-col gap-2 border-t border-line pt-3",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h3", {
						className: "text-sm font-semibold",
						children: "Review"
					}),
					checks.map((check) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
						className: "text-sm",
						children: [
							check.pass ? "Pass" : "Open",
							" · ",
							check.label
						]
					}, check.id)),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", {
						className: "flex items-start gap-2 text-sm",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
							type: "checkbox",
							className: "mt-1",
							checked: job.review.checked,
							onChange: (event) => onPatch((current) => ({
								...current,
								review: {
									checked: event.target.checked,
									verifiedAt: null
								}
							}), true)
						}), "I compared these figures to the aerial or a site visit."]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
						type: "button",
						className: "btn-solid",
						disabled: !checks.every((check) => check.pass),
						onClick: () => onPatch((current) => ({
							...current,
							review: {
								checked: true,
								verifiedAt: (/* @__PURE__ */ new Date()).toISOString()
							}
						}), true),
						children: verified ? "Verified" : "Mark estimator verified"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
						type: "button",
						className: "btn-quiet",
						onClick: onOpenDiagnostics,
						children: "API diagnostics"
					})
				]
			})
		]
	});
}
function ManualPlaneForm({ onAdd }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("form", {
		className: "grid gap-2 rounded-md border border-dashed border-line p-3",
		onSubmit: (event) => {
			event.preventDefault();
			const data = new FormData(event.currentTarget);
			const lengthFt = Number(data.get("length"));
			const widthFt = Number(data.get("width"));
			const pitch = String(data.get("pitch") ?? "");
			const azimuth = String(data.get("azimuth") ?? "");
			const rise = pitch === "" ? null : Number(pitch);
			if (!Number.isFinite(lengthFt) || !Number.isFinite(widthFt) || lengthFt <= 0 || widthFt <= 0) return;
			onAdd({
				id: crypto.randomUUID(),
				label: String(data.get("label") || "Manual plane"),
				origin: "MANUAL",
				solar: null,
				path: null,
				pitchDegrees: rise == null || Number.isNaN(rise) ? null : degreesFromRise(rise),
				pitchSource: rise == null || Number.isNaN(rise) ? "UNAVAILABLE" : "MANUAL",
				azimuthDegrees: azimuth === "" ? null : Number(azimuth),
				azimuthSource: azimuth === "" ? "UNAVAILABLE" : "MANUAL",
				areaOverrideSqFt: null,
				manual: {
					lengthFt,
					widthFt,
					dimension: data.get("dimension") === "FOOTPRINT" ? "FOOTPRINT" : "SURFACE"
				},
				hasExistingPanels: false
			});
			event.currentTarget.reset();
		},
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "text-sm font-medium",
				children: "Add a plane by dimensions"
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
				className: "field",
				name: "label",
				placeholder: "Label"
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "grid grid-cols-2 gap-2",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
					className: "field",
					name: "length",
					type: "number",
					step: "0.1",
					min: "0",
					placeholder: "Length ft",
					required: true
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
					className: "field",
					name: "width",
					type: "number",
					step: "0.1",
					min: "0",
					placeholder: "Width ft",
					required: true
				})]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("select", {
				className: "field",
				name: "dimension",
				defaultValue: "SURFACE",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
					value: "SURFACE",
					children: "Dimensions are slope surface"
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
					value: "FOOTPRINT",
					children: "Dimensions are ground footprint"
				})]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "grid grid-cols-2 gap-2",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
					className: "field",
					name: "pitch",
					type: "number",
					step: "0.1",
					placeholder: "Pitch rise/12"
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
					className: "field",
					name: "azimuth",
					type: "number",
					step: "1",
					placeholder: "Azimuth °"
				})]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
				type: "submit",
				className: "btn-quiet",
				children: "Add plane"
			})
		]
	});
}
function EnteredEdgeForm({ onAdd }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("form", {
		className: "flex flex-wrap items-center gap-2",
		onSubmit: (event) => {
			event.preventDefault();
			const data = new FormData(event.currentTarget);
			const feet = Number(data.get("feet"));
			if (!Number.isFinite(feet) || feet < 0) return;
			onAdd(String(data.get("kind")), feet);
			event.currentTarget.reset();
		},
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("select", {
				className: "field",
				name: "kind",
				defaultValue: "eave",
				children: EDGE_KINDS.map((kind) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
					value: kind,
					children: EDGE_LABEL[kind]
				}, kind))
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
				className: "field w-24",
				name: "feet",
				type: "number",
				step: "0.1",
				min: "0",
				placeholder: "Feet",
				required: true
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
				type: "submit",
				className: "btn-quiet",
				children: "Enter length"
			})
		]
	});
}
var EDGE_COLOR = {
	ridge: "#e24b4b",
	hip: "#e38b2c",
	valley: "#2aa8c4",
	eave: "#2f9d6a",
	rake: "#8b6cc9",
	flashing: "#d4b15a"
};
function readLatLng(pos) {
	if (!pos) return null;
	if (typeof pos.lat === "function") {
		const point = pos;
		return {
			lat: point.lat(),
			lng: point.lng()
		};
	}
	const literal = pos;
	return typeof literal.lat === "number" && typeof literal.lng === "number" ? {
		lat: literal.lat,
		lng: literal.lng
	} : null;
}
function planeColor(azimuth) {
	if (azimuth == null) return "#22d3ee";
	const n = (azimuth % 360 + 360) % 360;
	if (n >= 45 && n < 135) return "#38bdf8";
	if (n >= 135 && n < 225) return "#f59e0b";
	if (n >= 225 && n < 315) return "#a78bfa";
	return "#64748b";
}
function handleEl() {
	const el = document.createElement("div");
	el.className = "vertex-handle";
	return el;
}
function dot(map, point, color) {
	return new google.maps.Circle({
		map,
		center: point,
		radius: .7,
		strokeColor: color,
		strokeWeight: 2,
		fillColor: "#f8fafc",
		fillOpacity: 1,
		clickable: false,
		zIndex: 40
	});
}
function MapCanvas(props) {
	const map = useMap();
	const markerLib = useMapsLibrary("marker");
	const feetRef = (0, import_react.useRef)(null);
	const projectionRef = (0, import_react.useRef)(null);
	const propsRef = (0, import_react.useRef)(props);
	propsRef.current = props;
	const flown = (0, import_react.useRef)("");
	const placeRef = (0, import_react.useRef)(() => {});
	(0, import_react.useEffect)(() => {
		if (!map) return;
		const overlay = new google.maps.OverlayView();
		overlay.onAdd = () => {};
		overlay.draw = () => {
			projectionRef.current = overlay.getProjection();
		};
		overlay.setMap(map);
		const div = map.getDiv();
		const observer = new ResizeObserver(() => {
			google.maps.event.trigger(map, "resize");
		});
		observer.observe(div);
		return () => {
			observer.disconnect();
			overlay.setMap(null);
		};
	}, [map]);
	(0, import_react.useEffect)(() => {
		if (!map) return;
		const job = propsRef.current.job;
		const coords = job?.coordinates;
		if (!coords || !job) {
			if (flown.current !== "overview") {
				flown.current = "overview";
				map.moveCamera({
					center: {
						lat: 32.75,
						lng: -97.33
					},
					zoom: 10,
					tilt: 0,
					heading: 0
				});
			}
			return;
		}
		const key = `${job.id}:${coords.lat.toFixed(5)}:${coords.lng.toFixed(5)}`;
		if (flown.current === key) return;
		flown.current = key;
		map.moveCamera({
			center: {
				lat: coords.lat,
				lng: coords.lng
			},
			zoom: 20,
			tilt: 0,
			heading: 0
		});
	}, [
		map,
		props.job?.id,
		props.job?.coordinates?.lat,
		props.job?.coordinates?.lng
	]);
	(0, import_react.useEffect)(() => {
		if (!map) return;
		map.setMapTypeId(props.mapType);
	}, [map, props.mapType]);
	(0, import_react.useEffect)(() => {
		if (!map || !markerLib || !props.job) return;
		const { job, tool, selectedPlaneId, selectedEdgeId, show } = props;
		const drawing = tool === "edge" || tool === "plane";
		const forwardDraw = (event) => {
			if (!drawing) return false;
			const point = readLatLng(event.latLng);
			if (!point) return false;
			event.stop();
			placeRef.current(point);
			return true;
		};
		const objects = [];
		const listeners = [];
		const forgetMarker = (marker) => {
			objects.push({ setMap: () => marker.map = null });
		};
		if (job.coordinates) {
			const pin = document.createElement("div");
			pin.className = "map-pin";
			pin.textContent = "Parcel";
			forgetMarker(new markerLib.AdvancedMarkerElement({
				map,
				position: {
					lat: job.coordinates.lat,
					lng: job.coordinates.lng
				},
				content: pin,
				title: job.formattedAddress || "Parcel",
				gmpClickable: false
			}));
		}
		for (const plane of job.planes) {
			if (show.planes && plane.path && plane.path.length >= 3) {
				const selected = plane.id === selectedPlaneId;
				const poly = new google.maps.Polygon({
					map,
					paths: plane.path,
					strokeColor: selected ? "#f8fafc" : planeColor(plane.azimuthDegrees),
					strokeWeight: selected ? 3 : 2,
					fillColor: planeColor(plane.azimuthDegrees),
					fillOpacity: selected ? .45 : .22,
					clickable: drawing || tool === "select",
					zIndex: selected ? 4 : 2
				});
				listeners.push(poly.addListener("click", (event) => {
					if (forwardDraw(event)) return;
					propsRef.current.onSelectPlane(plane.id);
					propsRef.current.onSelectEdge(null);
				}));
				objects.push(poly);
				if (tool === "move") plane.path.forEach((point, index) => {
					const marker = new markerLib.AdvancedMarkerElement({
						map,
						position: point,
						content: handleEl(),
						gmpDraggable: true,
						zIndex: 20
					});
					listeners.push(marker.addListener("drag", () => {
						const next = readLatLng(marker.position);
						if (!next || !plane.path) return;
						poly.setPaths(plane.path.map((p, i) => i === index ? next : p));
					}));
					listeners.push(marker.addListener("dragend", () => {
						const next = readLatLng(marker.position);
						if (next) propsRef.current.onMovePlaneVertex(plane.id, index, next);
					}));
					forgetMarker(marker);
				});
			} else if (show.planes && plane.solar?.center) {
				const el = document.createElement("div");
				el.className = plane.id === selectedPlaneId ? "plane-pill is-selected" : "plane-pill";
				const rise = plane.pitchDegrees == null ? "pitch not set" : `${(12 * Math.tan(plane.pitchDegrees * Math.PI / 180) || 0).toFixed(1)}:12`;
				el.textContent = `${plane.label} · ${rise}`;
				const marker = new markerLib.AdvancedMarkerElement({
					map,
					position: plane.solar.center,
					content: el,
					gmpClickable: !drawing,
					title: plane.label
				});
				listeners.push(marker.addListener("click", () => {
					propsRef.current.onSelectPlane(plane.id);
					propsRef.current.onSelectEdge(null);
				}));
				forgetMarker(marker);
			}
			if (show.bounds && plane.solar?.boundingBox && !plane.path) {
				const ring = bboxPath(plane.solar.boundingBox);
				objects.push(new google.maps.Polyline({
					map,
					path: [...ring, ring[0]],
					strokeOpacity: 0,
					clickable: false,
					icons: [{
						icon: {
							path: "M 0,-1 0,1",
							strokeOpacity: .95,
							strokeColor: "#94a3b8",
							scale: 2
						},
						offset: "0",
						repeat: "10px"
					}],
					zIndex: 1
				}));
			}
		}
		for (const edge of job.edges) {
			if (!show[edge.kind] || edge.path.length < 2) continue;
			const selected = edge.id === selectedEdgeId;
			const line = new google.maps.Polyline({
				map,
				path: edge.path,
				strokeColor: EDGE_COLOR[edge.kind],
				strokeWeight: selected ? 6 : 4,
				clickable: tool === "select",
				zIndex: selected ? 6 : 3
			});
			listeners.push(line.addListener("click", (event) => {
				if (forwardDraw(event)) return;
				propsRef.current.onSelectEdge(edge.id);
				propsRef.current.onSelectPlane(null);
			}));
			objects.push(line);
			if (tool === "move") edge.path.forEach((point, index) => {
				const marker = new markerLib.AdvancedMarkerElement({
					map,
					position: point,
					content: handleEl(),
					gmpDraggable: true,
					zIndex: 21
				});
				listeners.push(marker.addListener("drag", () => {
					const next = readLatLng(marker.position);
					if (!next) return;
					line.setPath(edge.path.map((p, i) => i === index ? next : p));
				}));
				listeners.push(marker.addListener("dragend", () => {
					const next = readLatLng(marker.position);
					if (next) propsRef.current.onMoveEdgeVertex(edge.id, index, next);
				}));
				forgetMarker(marker);
			});
		}
		return () => {
			listeners.forEach((listener) => listener.remove());
			objects.forEach((object) => object.setMap(null));
		};
	}, [
		map,
		markerLib,
		props.job,
		props.tool,
		props.selectedPlaneId,
		props.selectedEdgeId,
		props.show
	]);
	(0, import_react.useEffect)(() => {
		if (!map) return;
		const tool = propsRef.current.tool;
		if (tool !== "edge" && tool !== "plane") {
			placeRef.current = () => {};
			map.setOptions({
				draggableCursor: void 0,
				disableDoubleClickZoom: false
			});
			propsRef.current.drawApi.current = {
				undo() {},
				finish() {},
				cancel() {}
			};
			if (feetRef.current) feetRef.current.textContent = "";
			return;
		}
		if (!props.job?.coordinates) {
			if (feetRef.current) feetRef.current.textContent = "Measure an address before drawing.";
			return;
		}
		map.setOptions({
			draggableCursor: "crosshair",
			disableDoubleClickZoom: true
		});
		const draft = [];
		const rubber = new google.maps.Polyline({
			map,
			strokeColor: "#22d3ee",
			strokeWeight: 3,
			clickable: true,
			zIndex: 30
		});
		const dots = [];
		let lastAccept = 0;
		const pixels = (point) => projectionRef.current?.fromLatLngToContainerPixel(new google.maps.LatLng(point.lat, point.lng)) ?? null;
		const pixelDistance = (a, b) => {
			const pa = pixels(a);
			const pb = pixels(b);
			if (!pa || !pb) return Number.POSITIVE_INFINITY;
			return Math.hypot(pa.x - pb.x, pa.y - pb.y);
		};
		const snap = (point) => {
			const job = propsRef.current.job;
			const pool = [...draft.slice(0, -1)];
			job?.planes.forEach((plane) => plane.path?.forEach((vertex) => pool.push(vertex)));
			job?.edges.forEach((edge) => edge.path.forEach((vertex) => pool.push(vertex)));
			let best = point;
			let bestDistance = 12;
			for (const candidate of pool) {
				const distance = pixelDistance(point, candidate);
				if (distance < bestDistance) {
					bestDistance = distance;
					best = candidate;
				}
			}
			return best;
		};
		const paint = (cursor) => {
			const path = cursor ? [...draft, cursor] : [...draft];
			const drawingEdge = propsRef.current.tool === "edge";
			rubber.setOptions({ strokeColor: drawingEdge ? EDGE_COLOR[propsRef.current.edgeKind] : "#22d3ee" });
			rubber.setPath(path);
			if (!feetRef.current) return;
			const length = pathLengthFeet(path);
			const pitch = propsRef.current.pitch;
			const label = drawingEdge ? EDGE_LABEL[propsRef.current.edgeKind] : `Plane ${pitchRatio(pitch)}`;
			const ground = path.length >= 3 ? ringGroundSqMeters(path) : null;
			const surface = ground == null ? null : surfaceFromGroundM2(ground, pitch);
			const area = ground == null ? "" : ` · footprint ${Math.round(m2ToSqFt(ground)).toLocaleString()} sq ft${surface == null ? "" : ` · slope ${Math.round(m2ToSqFt(surface)).toLocaleString()} sq ft`}`;
			feetRef.current.textContent = draft.length === 0 ? `${label}. Click the roof. Double-click or Finish closes a plane.` : `${label}. ${draft.length} pt${length == null ? "" : ` · ${length.toFixed(1)} ft`}${area}`;
		};
		const clearDraft = () => {
			draft.splice(0, draft.length);
			dots.forEach((item) => item.setMap(null));
			dots.length = 0;
			rubber.setPath([]);
			paint();
		};
		const finishPlane = () => {
			if (draft.length < 3) return;
			propsRef.current.onCommitPlane(draft.map((point) => ({ ...point })), propsRef.current.pitch);
			clearDraft();
		};
		propsRef.current.drawApi.current = {
			undo() {
				draft.pop();
				dots.pop()?.setMap(null);
				paint();
			},
			finish: finishPlane,
			cancel: clearDraft
		};
		const place = (point) => {
			draft.push(point);
			const drawingEdge = propsRef.current.tool === "edge";
			const marker = dot(map, point, drawingEdge ? EDGE_COLOR[propsRef.current.edgeKind] : "#22d3ee");
			marker.setOptions({
				clickable: true,
				zIndex: 40
			});
			marker.addListener("click", (event) => {
				const next = readLatLng(event.latLng);
				if (next) accept(next);
			});
			dots.push(marker);
		};
		const accept = (raw) => {
			const now = performance.now();
			if (now - lastAccept < 50) return;
			lastAccept = now;
			const point = snap(raw);
			if (propsRef.current.tool === "edge") {
				if (draft.length > 0 && pixelDistance(point, draft[draft.length - 1]) < 4) return;
				place(point);
				if (draft.length >= 2) {
					propsRef.current.onCommitEdge(draft.map((vertex) => ({ ...vertex })), propsRef.current.edgeKind);
					clearDraft();
				} else paint();
				return;
			}
			if (draft.length >= 3 && pixelDistance(point, draft[0]) < 14) {
				finishPlane();
				return;
			}
			if (draft.length > 0 && pixelDistance(point, draft[draft.length - 1]) < 4) {
				if (draft.length >= 3) finishPlane();
				return;
			}
			place(point);
			paint();
		};
		placeRef.current = accept;
		rubber.addListener("click", (event) => {
			const point = readLatLng(event.latLng);
			if (point) accept(point);
		});
		const clickListener = map.addListener("click", (event) => {
			const point = readLatLng(event.latLng);
			if (point) accept(point);
		});
		const host = map.getDiv();
		const pointerOrigin = {
			x: 0,
			y: 0
		};
		const onPointerDown = (event) => {
			pointerOrigin.x = event.clientX;
			pointerOrigin.y = event.clientY;
		};
		const onPointerUp = (event) => {
			if (Math.hypot(event.clientX - pointerOrigin.x, event.clientY - pointerOrigin.y) > 6) return;
			const target = event.target;
			if (target instanceof Element && target.closest("button, a, input, .gm-bundled-control, .gmnoprint")) return;
			const projection = projectionRef.current;
			if (!projection) return;
			const rect = host.getBoundingClientRect();
			const point = readLatLng(projection.fromContainerPixelToLatLng(new google.maps.Point(event.clientX - rect.left, event.clientY - rect.top)));
			if (point) accept(point);
		};
		host.addEventListener("pointerdown", onPointerDown, true);
		host.addEventListener("pointerup", onPointerUp, true);
		const dblListener = map.addListener("dblclick", (event) => {
			event.stop();
			if (propsRef.current.tool === "plane") finishPlane();
		});
		const moveListener = map.addListener("mousemove", (event) => {
			const point = readLatLng(event.latLng);
			if (point && draft.length > 0) paint(point);
		});
		paint();
		return () => {
			clickListener.remove();
			dblListener.remove();
			moveListener.remove();
			host.removeEventListener("pointerdown", onPointerDown, true);
			host.removeEventListener("pointerup", onPointerUp, true);
			rubber.setMap(null);
			dots.forEach((item) => item.setMap(null));
			placeRef.current = () => {};
			propsRef.current.drawApi.current = {
				undo() {},
				finish() {},
				cancel() {}
			};
			map.setOptions({
				draggableCursor: void 0,
				disableDoubleClickZoom: false
			});
		};
	}, [
		map,
		props.tool,
		props.job?.id,
		props.job?.coordinates
	]);
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
		className: "pointer-events-none absolute inset-x-0 top-2 z-10 flex justify-center px-2",
		children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
			ref: feetRef,
			className: "rounded-md bg-bg/90 px-3 py-1 text-sm text-fg empty:hidden"
		})
	}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
		className: "absolute bottom-3 left-3 z-10 flex max-w-full flex-wrap gap-1 pr-16",
		children: [
			["planes", "Planes"],
			["bounds", "Bounds"],
			["ridge", "Ridge"],
			["hip", "Hip"],
			["valley", "Valley"],
			["eave", "Eave"],
			["rake", "Rake"],
			["flashing", "Flash"]
		].map(([key, label]) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
			type: "button",
			className: "legend-btn",
			onClick: () => props.onToggle(key),
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: `legend-swatch legend-${key} ${props.show[key] ? "" : "is-off"}` }), label]
		}, key))
	})] });
}
function RoofMap(props) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
		className: "map-stage",
		"data-tool": props.tool,
		children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(APIProvider, {
			apiKey: props.apiKey,
			libraries: ["marker", "geometry"],
			children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Map, {
				defaultCenter: {
					lat: 32.75,
					lng: -97.33
				},
				defaultZoom: 10,
				mapId: props.mapId,
				mapTypeId: "hybrid",
				gestureHandling: "greedy",
				clickableIcons: false,
				tilt: 0,
				heading: 0,
				style: {
					width: "100%",
					height: "100%"
				},
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(MapCanvas, { ...props })
			})
		})
	});
}
var PITCHES = [
	3,
	4,
	5,
	6,
	7,
	8,
	9,
	10,
	12
];
var EMPTY_DRAW = {
	undo() {},
	finish() {},
	cancel() {}
};
function Dashboard() {
	const jobs = usePipeline((state) => state.jobs);
	const selectedId = usePipeline((state) => state.selectedId);
	const hydrated = usePipeline((state) => state.hydrated);
	const select = usePipeline((state) => state.select);
	const upsertMeasured = usePipeline((state) => state.upsertMeasured);
	const patch = usePipeline((state) => state.patch);
	const remove = usePipeline((state) => state.remove);
	const job = jobs.find((item) => item.id === selectedId) ?? null;
	const [tab, setTab] = (0, import_react.useState)("jobs");
	const [intakeOpen, setIntakeOpen] = (0, import_react.useState)(false);
	const [diagnosticsOpen, setDiagnosticsOpen] = (0, import_react.useState)(false);
	const [query, setQuery] = (0, import_react.useState)("");
	const [filter, setFilter] = (0, import_react.useState)("");
	const [suggestions, setSuggestions] = (0, import_react.useState)([]);
	const [lookupError, setLookupError] = (0, import_react.useState)("");
	const [busy, setBusy] = (0, import_react.useState)(false);
	const [mapConfig, setMapConfig] = (0, import_react.useState)(null);
	const [mapError, setMapError] = (0, import_react.useState)("");
	const [tool, setTool] = (0, import_react.useState)("select");
	const [edgeKind, setEdgeKind] = (0, import_react.useState)("ridge");
	const [rise, setRise] = (0, import_react.useState)(6);
	const [mapType, setMapType] = (0, import_react.useState)("hybrid");
	const [selectedPlaneId, setSelectedPlaneId] = (0, import_react.useState)(null);
	const [selectedEdgeId, setSelectedEdgeId] = (0, import_react.useState)(null);
	const [material, setMaterial] = (0, import_react.useState)("asphalt");
	const [waste, setWaste] = (0, import_react.useState)(10);
	const [show, setShow] = (0, import_react.useState)({
		planes: true,
		bounds: false,
		ridge: true,
		hip: true,
		valley: true,
		eave: true,
		rake: true,
		flashing: true
	});
	const sessionRef = (0, import_react.useRef)(crypto.randomUUID());
	const drawApi = (0, import_react.useRef)(EMPTY_DRAW);
	(0, import_react.useEffect)(() => {
		hydratePipeline();
		fetchMapConfig().then(setMapConfig).catch(() => setMapError("The map key could not be loaded."));
	}, []);
	(0, import_react.useEffect)(() => {
		if (!hydrated) return;
		const current = usePipeline.getState().jobs;
		let changed = false;
		const jobs = current.map((item) => ({
			...item,
			planes: item.planes.map((plane) => {
				const pitchDegrees = repairLegacyPitchDegrees(plane.pitchDegrees, plane.pitchSource);
				if (pitchDegrees === plane.pitchDegrees) return plane;
				changed = true;
				return {
					...plane,
					pitchDegrees
				};
			})
		}));
		if (changed) usePipeline.setState({ jobs });
	}, [hydrated]);
	(0, import_react.useEffect)(() => {
		if (!intakeOpen) return;
		const text = query.trim();
		if (text.length < 3) {
			setSuggestions([]);
			return;
		}
		const controller = new AbortController();
		const timer = window.setTimeout(() => {
			fetchSuggestions(text, sessionRef.current, controller.signal).then(setSuggestions).catch(() => setSuggestions([]));
		}, 450);
		return () => {
			controller.abort();
			window.clearTimeout(timer);
		};
	}, [query, intakeOpen]);
	async function runMeasure(input) {
		setBusy(true);
		setLookupError("");
		try {
			const measured = await measureAddress({
				...input,
				sessionToken: sessionRef.current
			});
			upsertMeasured(measured);
			setIntakeOpen(false);
			setQuery("");
			setSuggestions([]);
			setTab("map");
			setSelectedPlaneId(null);
			setSelectedEdgeId(null);
			sessionRef.current = crypto.randomUUID();
		} catch (error) {
			setLookupError(error instanceof Error ? error.message : "Lookup failed.");
		} finally {
			setBusy(false);
		}
	}
	function patchJob(recipe, keepReview = false) {
		if (!job) return;
		patch(job.id, recipe, { keepReview });
	}
	function downloadCsv() {
		if (!job) return;
		const blob = new Blob([jobToCsv(job, material, waste)], { type: "text/csv;charset=utf-8" });
		const link = document.createElement("a");
		link.href = URL.createObjectURL(blob);
		link.download = `roof-${(job.placeId || job.id).slice(0, 12)}.csv`;
		link.click();
		URL.revokeObjectURL(link.href);
	}
	const visibleJobs = jobs.filter((item) => {
		return `${item.formattedAddress || ""} ${item.input}`.toLowerCase().includes(filter.trim().toLowerCase());
	});
	const solarBanner = job && job.solar.status !== "SUCCESS" ? job.solar.message : job ? "Solar segments are on the map as center pins. A dashed box is only a bounding box. Ridges, hips, valleys, rakes, and eaves are not in the Solar response." : "";
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "flex h-dvh flex-col bg-bg text-fg",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("header", {
				className: "flex items-center justify-between gap-3 border-b border-line px-4 py-3",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "font-display text-2xl uppercase leading-none tracking-wide",
					children: "ForgeOne CRM"
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "text-xs uppercase tracking-widest text-muted",
					children: "Roof geometry"
				})] }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "flex gap-2",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
						type: "button",
						className: "btn-quiet",
						onClick: () => setDiagnosticsOpen(true),
						children: "Diagnostics"
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
						type: "button",
						className: "btn-solid",
						onClick: () => {
							setIntakeOpen(true);
							setLookupError("");
						},
						children: "Measure address"
					})]
				})]
			}),
			solarBanner ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "border-b border-line bg-surface px-4 py-2 text-sm text-muted",
				children: solarBanner
			}) : null,
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "flex gap-2 border-b border-line p-2 md:hidden",
				children: [
					["jobs", "Jobs"],
					["map", "Map"],
					["takeoff", "Takeoff"]
				].map(([id, label]) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
					type: "button",
					className: tab === id ? "btn-solid flex-1" : "btn-quiet flex-1",
					onClick: () => setTab(id),
					children: label
				}, id))
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "grid min-h-0 flex-1 md:grid-cols-[18rem_minmax(0,1fr)_22rem]",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
						className: `${tab === "jobs" ? "flex" : "hidden"} h-full min-h-0 flex-col gap-3 border-line p-3 md:flex md:border-r`,
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
								className: "field",
								value: filter,
								placeholder: "Filter saved parcels",
								onChange: (event) => setFilter(event.target.value)
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto",
								children: [
									!hydrated ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
										className: "text-sm text-muted",
										children: "Loading saved parcels…"
									}) : null,
									hydrated && visibleJobs.length === 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
										className: "text-sm text-muted",
										children: "No parcels yet. Measure an address to drop a real pin. Roof numbers stay empty until Solar returns them or you trace the roof."
									}) : null,
									visibleJobs.map((item) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
										className: `rounded-md border p-3 ${item.id === job?.id ? "border-accent" : "border-line"}`,
										children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
											type: "button",
											className: "w-full text-left",
											onClick: () => {
												select(item.id);
												setTab("map");
												setSelectedPlaneId(null);
												setSelectedEdgeId(null);
											},
											children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
												className: "text-sm font-medium",
												children: item.formattedAddress || item.input
											}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
												className: "mt-1 text-xs text-muted",
												children: [
													item.solar.status === "SUCCESS" ? "Solar planes" : "No Solar geometry",
													" · ",
													item.planes.length,
													" planes · ",
													item.edges.length,
													" edges"
												]
											})]
										}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
											type: "button",
											className: "btn-quiet mt-2",
											onClick: () => remove(item.id),
											children: "Remove"
										})]
									}, item.id))
								]
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
								className: "text-xs text-muted",
								children: "Place IDs stay on this device. Coordinates expire after 30 days. Map tiles are not saved. Google Maps Platform usage can incur charges."
							})
						]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
						className: `${tab === "map" ? "flex" : "hidden"} h-full min-h-0 flex-col md:flex`,
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "flex flex-wrap items-center gap-2 border-b border-line p-2",
							children: [
								[
									["select", "Select"],
									["edge", "Draw edge"],
									["plane", "Draw plane"],
									["move", "Move points"]
								].map(([id, label]) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
									type: "button",
									className: tool === id ? "btn-solid" : "btn-quiet",
									onClick: () => setTool(id),
									disabled: !job?.coordinates,
									children: label
								}, id)),
								[
									["hybrid", "Hybrid"],
									["satellite", "Satellite"],
									["roadmap", "Map"]
								].map(([id, label]) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
									type: "button",
									className: mapType === id ? "btn-solid" : "btn-quiet",
									onClick: () => setMapType(id),
									children: label
								}, id)),
								tool === "edge" ? EDGE_KINDS.map((kind) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
									type: "button",
									className: edgeKind === kind ? "btn-solid" : "btn-quiet",
									onClick: () => setEdgeKind(kind),
									children: EDGE_LABEL[kind]
								}, kind)) : null,
								tool === "plane" ? PITCHES.map((value) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
									type: "button",
									className: rise === value ? "btn-solid" : "btn-quiet",
									onClick: () => setRise(value),
									children: [value, ":12"]
								}, value)) : null,
								tool === "plane" ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
										type: "button",
										className: "btn-quiet",
										onClick: () => drawApi.current.undo(),
										children: "Undo"
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
										type: "button",
										className: "btn-solid",
										onClick: () => drawApi.current.finish(),
										children: "Finish plane"
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
										type: "button",
										className: "btn-quiet",
										onClick: () => drawApi.current.cancel(),
										children: "Cancel"
									})
								] }) : null,
								tool === "edge" ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
									type: "button",
									className: "btn-quiet",
									onClick: () => drawApi.current.cancel(),
									children: "Cancel point"
								}) : null,
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
									type: "button",
									className: "btn-quiet",
									disabled: !job,
									onClick: downloadCsv,
									children: "Download CSV"
								})
							]
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "relative min-h-0 flex-1",
							children: [
								mapError ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
									className: "p-4 text-sm",
									children: mapError
								}) : null,
								!mapConfig && !mapError ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
									className: "p-4 text-sm text-muted",
									children: "Loading map…"
								}) : null,
								mapConfig ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(RoofMap, {
									apiKey: mapConfig.apiKey,
									mapId: mapConfig.mapId,
									job,
									tool,
									edgeKind,
									pitch: Math.atan(rise / 12) * 180 / Math.PI,
									mapType,
									selectedPlaneId,
									selectedEdgeId,
									show,
									drawApi,
									onToggle: (key) => setShow((current) => ({
										...current,
										[key]: !current[key]
									})),
									onSelectPlane: setSelectedPlaneId,
									onSelectEdge: setSelectedEdgeId,
									onCommitEdge: (path, kind) => {
										const id = crypto.randomUUID();
										patchJob((current) => ({
											...current,
											edges: [...current.edges, {
												id,
												kind,
												path,
												lengthOverrideFt: null,
												origin: "DRAWN"
											}]
										}));
										setSelectedEdgeId(id);
										setSelectedPlaneId(null);
									},
									onCommitPlane: (path, planePitch) => {
										const id = crypto.randomUUID();
										patchJob((current) => ({
											...current,
											planes: [...current.planes, {
												id,
												label: `Traced plane ${current.planes.filter((plane) => plane.origin === "MANUAL").length + 1}`,
												origin: "MANUAL",
												solar: null,
												path,
												pitchDegrees: planePitch,
												pitchSource: "MANUAL",
												azimuthDegrees: null,
												azimuthSource: "UNAVAILABLE",
												areaOverrideSqFt: null,
												manual: null,
												hasExistingPanels: false
											}]
										}));
										setSelectedPlaneId(id);
										setSelectedEdgeId(null);
									},
									onMovePlaneVertex: (planeId, index, pos) => {
										patchJob((current) => ({
											...current,
											planes: current.planes.map((plane) => plane.id === planeId && plane.path ? {
												...plane,
												path: plane.path.map((point, pointIndex) => pointIndex === index ? pos : point)
											} : plane)
										}));
									},
									onMoveEdgeVertex: (edgeId, index, pos) => {
										patchJob((current) => ({
											...current,
											edges: current.edges.map((edge) => edge.id === edgeId ? {
												...edge,
												path: edge.path.map((point, pointIndex) => pointIndex === index ? pos : point),
												lengthOverrideFt: null
											} : edge)
										}));
									}
								}) : null
							]
						})]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: `${tab === "takeoff" ? "block" : "hidden"} min-h-0 md:block`,
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(MeasurePanel, {
							job,
							selectedPlaneId,
							selectedEdgeId,
							material,
							waste,
							onMaterial: setMaterial,
							onWaste: setWaste,
							onSelectPlane: (id) => {
								setSelectedPlaneId(id);
								if (id) setSelectedEdgeId(null);
							},
							onSelectEdge: (id) => {
								setSelectedEdgeId(id);
								if (id) setSelectedPlaneId(null);
							},
							onPatch: patchJob,
							onOpenDiagnostics: () => setDiagnosticsOpen(true)
						})
					})
				]
			}),
			intakeOpen ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Modal, {
				onClose: () => setIntakeOpen(false),
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("form", {
					className: "flex flex-col gap-3",
					onSubmit: (event) => {
						event.preventDefault();
						const match = suggestions[0];
						if (match && query.trim().length >= 3) runMeasure({
							placeId: match.placeId,
							query
						});
						else runMeasure({ query });
					},
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "flex items-center justify-between",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
								className: "font-display text-2xl uppercase",
								children: "Measure address"
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
								type: "button",
								className: "btn-quiet",
								onClick: () => setIntakeOpen(false),
								children: "Close"
							})]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "text-sm text-muted",
							children: "Suggestions use Places. Choosing one resolves the place. A typed address uses Geocoding. Solar is requested unless this key recently blocked it. Nothing is invented if Solar fails."
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
							className: "field",
							autoFocus: true,
							value: query,
							placeholder: "Street address",
							onChange: (event) => setQuery(event.target.value)
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
							className: "flex max-h-64 flex-col overflow-y-auto",
							children: suggestions.map((suggestion) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
								type: "button",
								className: "border-b border-line px-2 py-3 text-left",
								onClick: () => void runMeasure({
									placeId: suggestion.placeId,
									query: `${suggestion.main}, ${suggestion.secondary}`
								}),
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
									className: "block text-sm",
									children: suggestion.main
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
									className: "text-xs text-muted",
									children: suggestion.secondary
								})]
							}, suggestion.placeId))
						}),
						lookupError ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "text-sm text-bad",
							children: lookupError
						}) : null,
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
							type: "submit",
							className: "btn-solid",
							disabled: busy || query.trim().length < 3,
							children: busy ? "Measuring…" : "Measure typed address"
						})
					]
				})
			}) : null,
			diagnosticsOpen ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Modal, {
				onClose: () => setDiagnosticsOpen(false),
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "modal-body flex flex-col gap-3 overflow-y-auto",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "flex items-center justify-between",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
								className: "font-display text-2xl uppercase",
								children: "Diagnostics"
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
								type: "button",
								className: "btn-quiet",
								onClick: () => setDiagnosticsOpen(false),
								children: "Close"
							})]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
							className: "text-sm text-muted",
							children: [
								"Project ",
								mapConfig?.projectNumber || "31967172109",
								". The key stays off this screen. Maps JavaScript receives it only so the map can load. Geocoding, Places, Address Validation, and Solar are called on the server."
							]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "text-sm text-muted",
							children: "iOS and Android 3D map SDKs are not used. This web app does not measure in 3D."
						}),
						!job ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "text-sm",
							children: "Measure an address to see a live result."
						}) : null,
						job ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
								className: "text-sm",
								children: ["Property: ", job.formattedAddress || job.input]
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
								className: "text-sm",
								children: [
									"Geocoding: ",
									job.geocodeStatus,
									". ",
									job.coordinateSource || "Not available — requires additional analysis"
								]
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
								className: "text-sm",
								children: [
									"Address Validation: ",
									job.addressValidation.status,
									". ",
									job.addressValidation.message
								]
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
								className: "text-sm",
								children: [
									"Solar: ",
									job.solar.status,
									". ",
									job.solar.message
								]
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
								className: "text-sm",
								children: [
									"Imagery: ",
									job.solar.imageryQuality || "Not available — requires additional analysis",
									" ",
									job.solar.imageryDate || ""
								]
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("ul", {
								className: "flex flex-col gap-2 text-sm",
								children: job.diagnostics.map((entry, index) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", { children: [
									entry.service,
									" · ",
									entry.level,
									" · ",
									entry.message
								] }, `${entry.at}-${index}`))
							})
						] }) : null,
						job ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
							type: "button",
							className: "btn-quiet",
							disabled: busy || !job.placeId,
							onClick: () => job.placeId && void runMeasure({
								placeId: job.placeId,
								query: job.formattedAddress || job.input
							}),
							children: "Refresh this parcel"
						}) : null
					]
				})
			}) : null
		]
	});
}
function Modal({ children, onClose }) {
	(0, import_react.useEffect)(() => {
		const onKey = (event) => {
			if (event.key === "Escape") onClose();
		};
		window.addEventListener("keydown", onKey);
		return () => window.removeEventListener("keydown", onKey);
	}, [onClose]);
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
		className: "modal-backdrop",
		role: "presentation",
		onMouseDown: onClose,
		children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
			className: "dialog-sheet",
			role: "dialog",
			"aria-modal": "true",
			onMouseDown: (event) => event.stopPropagation(),
			children
		})
	});
}
var SplitComponent = Dashboard;
//#endregion
export { SplitComponent as component };
