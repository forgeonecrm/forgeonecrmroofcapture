import { i as __toESM } from "../_runtime.mjs";
import { _ as lazyRouteComponent, b as useRouter, f as Scripts, g as Outlet, h as createRouter, p as HeadContent, q as require_react, v as createFileRoute, x as require_jsx_runtime, y as createRootRoute } from "../_libs/@tanstack/react-router+[...].mjs";
import { t as TriangleAlert } from "../_libs/lucide-react.mjs";
import { a as union, i as string, n as number, r as object, t as literal } from "../_libs/zod.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/router-DqK8QbXP.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_runtime = require_jsx_runtime();
var __defProp = Object.defineProperty;
var __exportAll = (all, no_symbols) => {
	let target = {};
	for (var name in all) __defProp(target, name, {
		get: all[name],
		enumerable: true
	});
	if (!no_symbols) __defProp(target, Symbol.toStringTag, { value: "Module" });
	return target;
};
var FALLBACK_MESSAGE = "An unexpected error occurred. Try reloading the page.";
function errorMessage(error) {
	if (error instanceof Error && error.message) return error.message;
	if (typeof error === "string" && error) return error;
	return FALLBACK_MESSAGE;
}
function AppErrorComponent({ error }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("main", {
		className: "flex min-h-screen flex-col items-center justify-center gap-3 px-6 text-center bg-zinc-50 text-zinc-900 dark:bg-zinc-950 dark:text-zinc-50",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
				className: "text-red-500",
				"aria-hidden": "true",
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(TriangleAlert, {
					className: "size-10",
					strokeWidth: 2
				})
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h1", {
				className: "text-lg font-semibold",
				children: "Something went wrong"
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "max-w-md text-sm break-words text-zinc-500 dark:text-zinc-400",
				children: errorMessage(error)
			})
		]
	});
}
/**
* Path-based preview hosts serve the dev server under `/{port_id}/` and strip
* that prefix before forwarding, so SSR sees `/` while the browser URL keeps the
* prefix. TanStack Start resets `basepath` on hydration, so a `rewrite` keeps
* client routing and generated links aligned with the public URL.
*/
var PATH_BASED_PREVIEW_HOSTS = /* @__PURE__ */ new Set([
	"preview.grok.genai.mil",
	"preview.grok.mil",
	"preview.grokgsac.com"
]);
var PORT_ID_PREFIX = /^\/hds-[a-z0-9]+-\d+-[a-z0-9]+(?=\/|$)/i;
function previewPathPrefix(hostname, pathname) {
	if (!PATH_BASED_PREVIEW_HOSTS.has(hostname.toLowerCase())) return void 0;
	return PORT_ID_PREFIX.exec(pathname)?.[0];
}
function prefixRewrite(prefix) {
	return {
		input: ({ url }) => {
			if (url.pathname === prefix) url.pathname = "/";
			else if (url.pathname.startsWith(`${prefix}/`)) url.pathname = url.pathname.slice(prefix.length);
			return url;
		},
		output: ({ url }) => {
			url.pathname = `${prefix}${url.pathname}`;
			return url;
		}
	};
}
function previewPathRewrite() {
	if (typeof window === "undefined") return void 0;
	const prefix = previewPathPrefix(window.location.hostname, window.location.pathname);
	return prefix ? prefixRewrite(prefix) : void 0;
}
/**
* App-wide client provider mounted once near the root (in `src/routes/__root.tsx`):
*
*   <AuthProvider><Outlet /></AuthProvider>
*
* Better Auth's React client (`@/lib/auth/client`) needs NO context provider —
* its `useSession()` works standalone — so this is a passthrough today. It's
* kept as the single, stable mount point for any future client-side providers
* (e.g. a toast or theme provider) without churning the root shell.
*/
function AuthProvider({ children }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(import_jsx_runtime.Fragment, { children });
}
var CONNECTOR_TOKEN_READY_EVENT = "grok:connector-token-ready";
function isGrokEmbedderOrigin(origin) {
	try {
		const url = new URL(origin);
		if (url.protocol !== "https:" && url.protocol !== "http:") return false;
		const host = url.hostname.toLowerCase();
		if (host === "grok.com" || host.endsWith(".grok.com")) return true;
		if (host === "localhost" || host === "127.0.0.1" || host === "[::1]") return true;
		return false;
	} catch {
		return false;
	}
}
function isSandboxPreviewGuestHost(hostname) {
	const host = hostname.toLowerCase();
	return host === "grok-sandbox.com" || host.endsWith(".grok-sandbox.com");
}
function isRemintPreviewPair(guestHost, parentHost) {
	const guest = guestHost.toLowerCase();
	const parent = parentHost.toLowerCase();
	const i = guest.indexOf(".preview.");
	if (i <= 0) return false;
	const label = guest.slice(0, i);
	const rest = guest.slice(i + 9);
	if (label.includes(".") || !rest.includes(".")) return false;
	return parent === rest || parent === `grok.${rest}`;
}
function resolveParentEmbedderOrigin(parentIsSelf, referrer, ancestorOrigin, guestHostname = "") {
	if (parentIsSelf) return null;
	for (const candidate of [referrer, ancestorOrigin ?? ""].filter(Boolean)) try {
		const url = new URL(candidate.includes("://") ? candidate : `https://${candidate}`);
		if (url.protocol !== "https:" && url.protocol !== "http:") continue;
		if (isGrokEmbedderOrigin(url.origin)) return url.origin;
		if (isSandboxPreviewGuestHost(guestHostname) || isRemintPreviewPair(guestHostname, url.hostname)) return url.origin;
	} catch {}
	return null;
}
/**
* Guest side of the grok-web ↔ sandbox preview postMessage bridge.
*
* Activates only when this page is framed by an allowlisted Grok embedder.
* Top-level runs (download/export, local `npm run dev`, deployed sites) noop.
*/
var PREVIEW_BRIDGE_CHANNEL = "grok-preview-bridge";
var EnvelopeSchema = object({
	channel: literal(PREVIEW_BRIDGE_CHANNEL),
	version: number().int().positive(),
	type: string().min(1)
});
var HelloSchema = EnvelopeSchema.extend({ type: literal("hello") });
var NavigateSchema = EnvelopeSchema.extend({
	type: literal("navigate"),
	path: string().min(1)
});
var HistorySchema = EnvelopeSchema.extend({
	type: literal("history"),
	delta: union([literal(-1), literal(1)])
});
var ConnectorTokenReadySchema = EnvelopeSchema.extend({ type: literal("connector-token-ready") });
function isSafeBridgePath(path) {
	if (!path.startsWith("/") || path.startsWith("//") || path.includes("\\")) return false;
	try {
		return new URL(path, "https://preview.invalid").origin === "https://preview.invalid";
	} catch {
		return false;
	}
}
/**
* Origin of the Grok embedder framing this page, or null when the page runs
* top-level (download/export, local `npm run dev`, deployed sites) or under a
* non-Grok parent. Client-only; null during SSR.
*/
function resolveCurrentEmbedderOrigin() {
	if (typeof window === "undefined") return null;
	const ancestorOrigin = typeof location.ancestorOrigins !== "undefined" && location.ancestorOrigins.length > 0 ? location.ancestorOrigins[0] : null;
	return resolveParentEmbedderOrigin(window.parent === window, document.referrer, ancestorOrigin, window.location.hostname);
}
/**
* Install host↔guest messaging. Returns a dispose function.
* Noops (returns a no-op dispose) when not embedded under a Grok parent.
*/
function installPreviewHostBridge(options = {}) {
	const parentOrigin = resolveCurrentEmbedderOrigin();
	if (parentOrigin === null) return () => {};
	const ROOT_STATE_KEY = "__grokPreviewBridgeRoot";
	const originalPushState = window.history.pushState.bind(window.history);
	const originalReplaceState = window.history.replaceState.bind(window.history);
	const isAtHistoryRoot = () => {
		const state = window.history.state;
		return Boolean(state && typeof state === "object" && state[ROOT_STATE_KEY] === true);
	};
	try {
		const current = window.history.state;
		if (!(current !== null && typeof current === "object" && Object.prototype.hasOwnProperty.call(current, ROOT_STATE_KEY))) {
			const isRoot = window.history.length <= 1;
			originalReplaceState(current && typeof current === "object" ? {
				...current,
				[ROOT_STATE_KEY]: isRoot
			} : { [ROOT_STATE_KEY]: isRoot }, "", window.location.href);
		}
	} catch {}
	const post = (message) => {
		window.parent.postMessage(message, parentOrigin);
	};
	const reportLocation = () => {
		post({
			channel: PREVIEW_BRIDGE_CHANNEL,
			version: 1,
			type: "location",
			path: window.location.pathname || "/",
			search: window.location.search,
			hash: window.location.hash
		});
	};
	const reportRoutes = () => {
		const paths = options.getRoutePaths?.() ?? [];
		post({
			channel: PREVIEW_BRIDGE_CHANNEL,
			version: 1,
			type: "routes",
			paths
		});
	};
	const defaultNavigate = (path) => {
		if (!isSafeBridgePath(path)) return;
		try {
			const url = new URL(path, window.location.origin);
			if (url.origin !== window.location.origin) return;
			const next = `${url.pathname}${url.search}${url.hash}`;
			window.history.pushState(window.history.state, "", next);
			window.dispatchEvent(new PopStateEvent("popstate", { state: window.history.state }));
		} catch {}
	};
	const navigate = (path) => {
		if (!isSafeBridgePath(path)) return;
		if (options.navigate) {
			options.navigate(path);
			return;
		}
		defaultNavigate(path);
	};
	const announce = () => {
		reportLocation();
		reportRoutes();
		post({
			channel: PREVIEW_BRIDGE_CHANNEL,
			version: 1,
			type: "ready"
		});
	};
	const onHello = (data) => {
		if (!HelloSchema.safeParse(data).success) return;
		announce();
	};
	const onNavigate = (data) => {
		const parsed = NavigateSchema.safeParse(data);
		if (!parsed.success) return;
		navigate(parsed.data.path);
		queueMicrotask(reportLocation);
	};
	const onHistory = (data) => {
		const parsed = HistorySchema.safeParse(data);
		if (!parsed.success) return;
		if (parsed.data.delta === -1 && isAtHistoryRoot()) return;
		window.history.go(parsed.data.delta);
	};
	const onConnectorTokenReady = (data) => {
		if (!ConnectorTokenReadySchema.safeParse(data).success) return;
		window.dispatchEvent(new Event(CONNECTOR_TOKEN_READY_EVENT));
	};
	const hostMessageHandlers = /* @__PURE__ */ new Map([
		["hello", onHello],
		["navigate", onNavigate],
		["history", onHistory],
		["connector-token-ready", onConnectorTokenReady]
	]);
	const onMessage = (event) => {
		if (event.source !== window.parent) return;
		if (event.origin !== parentOrigin) return;
		const envelope = EnvelopeSchema.safeParse(event.data);
		if (!envelope.success || envelope.data.version !== 1) return;
		hostMessageHandlers.get(envelope.data.type)?.(event.data);
	};
	const onPopState = () => {
		reportLocation();
	};
	const onHashChange = () => {
		reportLocation();
	};
	window.history.pushState = (data, unused, url) => {
		const next = data && typeof data === "object" ? {
			...data,
			[ROOT_STATE_KEY]: false
		} : data;
		originalPushState(next, unused, url);
		reportLocation();
	};
	window.history.replaceState = (data, unused, url) => {
		const next = isAtHistoryRoot() ? {
			...data && typeof data === "object" ? data : {},
			[ROOT_STATE_KEY]: true
		} : data;
		originalReplaceState(next, unused, url);
		reportLocation();
	};
	window.addEventListener("message", onMessage);
	window.addEventListener("popstate", onPopState);
	window.addEventListener("hashchange", onHashChange);
	announce();
	return () => {
		window.removeEventListener("message", onMessage);
		window.removeEventListener("popstate", onPopState);
		window.removeEventListener("hashchange", onHashChange);
		window.history.pushState = originalPushState;
		window.history.replaceState = originalReplaceState;
	};
}
/** Collect static path patterns from a TanStack route tree (best-effort). */
function collectRoutePathsFromTree(routeTree) {
	const paths = /* @__PURE__ */ new Set();
	const walk = (node) => {
		if (!node || typeof node !== "object") return;
		const record = node;
		const full = typeof record.fullPath === "string" ? record.fullPath : typeof record.path === "string" ? record.path : null;
		if (full !== null && full !== "") paths.add(full.startsWith("/") ? full : `/${full}`);
		else if (full === "") paths.add("/");
		const children = record.children;
		if (Array.isArray(children)) for (const child of children) walk(child);
		else if (children && typeof children === "object") for (const child of Object.values(children)) walk(child);
	};
	walk(routeTree);
	return [...paths];
}
/**
* Mount once in `__root.tsx` so the Grok preview chrome can drive navigation
* (and later receive registered routes). Noops when the app is not embedded.
*/
function PreviewHostBridge() {
	const router = useRouter();
	(0, import_react.useEffect)(() => {
		return installPreviewHostBridge({
			navigate: (path) => {
				router.history.push(path);
			},
			getRoutePaths: () => collectRoutePathsFromTree(router.routeTree)
		});
	}, [router]);
	return null;
}
var styles_default = "/assets/styles-jJaSZrSU.css";
var Route$4 = createRootRoute({
	head: () => ({
		meta: [
			{ charSet: "utf-8" },
			{
				name: "viewport",
				content: "width=device-width, initial-scale=1"
			},
			{ title: "ForgeOne Roof Geometry" },
			{
				name: "theme-color",
				content: "#0f172a"
			}
		],
		links: [
			{
				rel: "icon",
				type: "image/svg+xml",
				href: "/favicon.svg"
			},
			{
				rel: "stylesheet",
				href: styles_default
			},
			{
				rel: "manifest",
				href: "/__grok/manifest.webmanifest"
			},
			{
				rel: "apple-touch-icon",
				href: "/__grok/icon-180.png"
			},
			{
				rel: "stylesheet",
				href: "https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500&family=Plus+Jakarta+Sans:wght@400;500;600;700&display=swap"
			}
		]
	}),
	component: () => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("html", {
		lang: "en",
		suppressHydrationWarning: true,
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("head", { children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(HeadContent, {}) }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("body", { children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(PreviewHostBridge, {}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(AuthProvider, { children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Outlet, {}) }),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Scripts, {})
		] })]
	})
});
var $$splitComponentImporter = () => import("./routes-D4pyk8IC.mjs");
var Route$3 = createFileRoute("/")({ component: lazyRouteComponent($$splitComponentImporter, "component") });
/**
* Server-only Google Maps Platform key for project 31967172109
* (gmp-demo-project-576437582). Never import this from a client component.
* Maps JavaScript still has to receive the key in the browser; that happens
* through /api/maps/config and is not written into the page as visible text.
*/
var GOOGLE_MAPS_API_KEY = "AIzaSyDgX-zgWxGTnwQc-LOAgwahbtypQYtUdjo";
function num(value) {
	return typeof value === "number" && Number.isFinite(value) ? value : null;
}
function latLng(value) {
	if (!value || typeof value !== "object") return null;
	const v = value;
	const lat = num(v.latitude ?? v.lat);
	const lng = num(v.longitude ?? v.lng);
	if (lat == null || lng == null) return null;
	return {
		lat,
		lng
	};
}
function dateText(value) {
	if (!value || typeof value !== "object") return void 0;
	const d = value;
	if (typeof d.year !== "number") return void 0;
	const month = typeof d.month === "number" ? String(d.month).padStart(2, "0") : "01";
	const day = typeof d.day === "number" ? String(d.day).padStart(2, "0") : "01";
	return `${d.year}-${month}-${day}`;
}
function snapshot(raw) {
	const stats = raw.stats ?? {};
	const box = raw.boundingBox;
	const sw = box ? latLng(box.sw) : null;
	const ne = box ? latLng(box.ne) : null;
	return {
		pitchDegrees: num(raw.pitchDegrees),
		azimuthDegrees: num(raw.azimuthDegrees),
		areaMeters2: num(stats.areaMeters2),
		groundAreaMeters2: num(stats.groundAreaMeters2),
		heightMeters: num(raw.planeHeightAtCenterMeters),
		center: latLng(raw.center),
		boundingBox: sw && ne ? {
			sw,
			ne
		} : null
	};
}
/**
* Map a Google Solar buildingInsights resource.
* Bounding boxes are stored and never converted into roof polygons.
* Linear edges are not in this response and are left unset.
*/
function mapSolarInsights(raw, ids = () => crypto.randomUUID()) {
	const root = raw ?? {};
	const potential = root.solarPotential ?? {};
	const whole = potential.wholeRoofStats ?? {};
	const planes = (Array.isArray(potential.roofSegmentStats) ? potential.roofSegmentStats : []).map((segment, index) => {
		const snap = snapshot(segment ?? {});
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
			hasExistingPanels: false
		};
	});
	return {
		imageryQuality: typeof root.imageryQuality === "string" ? root.imageryQuality : void 0,
		imageryDate: dateText(root.imageryDate),
		buildingName: typeof root.name === "string" ? root.name : void 0,
		wholeRoofAreaM2: num(whole.areaMeters2),
		wholeRoofGroundM2: num(whole.groundAreaMeters2),
		maxPanels: num(potential.maxArrayPanelsCount),
		panelCapacityWatts: num(potential.panelCapacityWatts),
		panelHeightMeters: num(potential.panelHeightMeters),
		panelWidthMeters: num(potential.panelWidthMeters),
		maxSunshineHours: num(potential.maxSunshineHoursPerYear),
		planes
	};
}
/** Remove API keys from anything that might be logged or shown. */
function scrub(value) {
	return value.replace(/key=[^&\s"'<>]+/gi, "key=[REDACTED]").replace(/AIza[0-9A-Za-z\-_]{20,}/g, "[REDACTED]");
}
var KEY = GOOGLE_MAPS_API_KEY;
var BLOCK_MS = 6e5;
var CACHE_MS = 9e5;
var COORD_TTL_MS = 2592e6;
var measureCache = /* @__PURE__ */ new Map();
var suggestCache = /* @__PURE__ */ new Map();
var blockedUntil = /* @__PURE__ */ new Map();
var confirmedProject;
function nowIso() {
	return (/* @__PURE__ */ new Date()).toISOString();
}
function isBlocked(service) {
	return (blockedUntil.get(service) ?? 0) > Date.now();
}
function block(service) {
	blockedUntil.set(service, Date.now() + BLOCK_MS);
}
function diag(level, service, message) {
	return {
		at: nowIso(),
		level,
		service,
		message: scrub(message)
	};
}
function readFailure(json) {
	const body = json ?? {};
	const message = scrub(body.error?.message || body.error_message || body.status || "Request failed");
	const info = body.error?.details?.find((d) => d?.reason || d?.metadata?.consumer);
	const project = info?.metadata?.consumer?.replace(/^projects\//, "");
	if (project) confirmedProject = project;
	return {
		message,
		reason: info?.reason,
		project
	};
}
async function readBody(res) {
	const text = await res.text();
	if (!text) return null;
	try {
		return JSON.parse(text);
	} catch {
		return { error_message: scrub(text).slice(0, 280) };
	}
}
function blankSolar(status, message, extra) {
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
		...extra
	};
}
function emptyExisting() {
	return {
		recorded: false,
		present: false,
		panelCount: null,
		capacityKw: null,
		inverter: "",
		year: null,
		condition: "",
		notes: ""
	};
}
async function placeDetails(placeId, sessionToken, logs) {
	const url = new URL(`https://places.googleapis.com/v1/places/${encodeURIComponent(placeId)}`);
	if (sessionToken) url.searchParams.set("sessionToken", sessionToken);
	const res = await fetch(url, { headers: {
		"X-Goog-Api-Key": KEY,
		"X-Goog-FieldMask": "id,formattedAddress,location,types"
	} });
	const json = await readBody(res);
	if (!res.ok || !json?.location || typeof json.location.latitude !== "number") {
		const failure = readFailure(json);
		logs.push(diag("warn", "PLACES", `Place Details returned HTTP ${res.status}. ${failure.reason ? failure.reason + ". " : ""}${failure.message}`));
		return null;
	}
	const lat = json.location.latitude;
	const lng = json.location.longitude;
	if (typeof lng !== "number") return null;
	logs.push(diag("info", "PLACES", "Place Details returned formattedAddress and location. Session token was sent so autocomplete can bill as one session."));
	return {
		address: json.formattedAddress ?? null,
		lat,
		lng,
		types: Array.isArray(json.types) ? json.types : []
	};
}
async function geocode(input, logs) {
	const url = new URL("https://maps.googleapis.com/maps/api/geocode/json");
	url.searchParams.set("key", KEY);
	if (input.placeId) url.searchParams.set("place_id", input.placeId);
	else if (input.address) url.searchParams.set("address", input.address);
	else return null;
	const res = await fetch(url);
	const json = await readBody(res);
	const status = json?.status || `HTTP_${res.status}`;
	if (status !== "OK" || !json?.results?.[0]?.geometry?.location) {
		const failure = readFailure(json);
		logs.push(diag(status === "ZERO_RESULTS" ? "warn" : "error", "GEOCODING", `Geocoding status ${status}. ${failure.reason ? failure.reason + ". " : ""}${failure.message || json?.error_message || ""}`.trim()));
		return null;
	}
	const hit = json.results[0];
	const lat = hit.geometry?.location?.lat;
	const lng = hit.geometry?.location?.lng;
	if (typeof lat !== "number" || typeof lng !== "number" || !hit.place_id) {
		logs.push(diag("error", "GEOCODING", "Geocoding returned OK without a coordinate or place ID."));
		return null;
	}
	logs.push(diag("info", "GEOCODING", `Geocoding OK. location_type ${hit.geometry?.location_type || "unknown"}. Place ID stored. Coordinates carry a 30-day TTL.`));
	return {
		address: hit.formatted_address || input.address || "",
		placeId: hit.place_id,
		lat,
		lng,
		locationType: hit.geometry?.location_type ?? null,
		partial: !!hit.partial_match
	};
}
async function validateAddress(address, logs) {
	if (isBlocked("addressvalidation")) {
		const message = "Address Validation skipped. This key returned API_KEY_SERVICE_BLOCKED within the last 10 minutes, so it was not called again.";
		logs.push(diag("info", "ADDRESS_VALIDATION", message));
		return {
			status: "SKIPPED",
			message
		};
	}
	const res = await fetch("https://addressvalidation.googleapis.com/v1:validateAddress", {
		method: "POST",
		headers: {
			"content-type": "application/json",
			"X-Goog-Api-Key": KEY
		},
		body: JSON.stringify({ address: {
			regionCode: "US",
			addressLines: [address]
		} })
	});
	const json = await readBody(res);
	if (!res.ok) {
		const failure = readFailure(json);
		const blocked = res.status === 403 || failure.reason === "API_KEY_SERVICE_BLOCKED";
		if (blocked) block("addressvalidation");
		const message = blocked ? `Address Validation is blocked on this key (${failure.reason || "HTTP 403"}). Add addressvalidation.googleapis.com to the key API restrictions on project ${failure.project || confirmedProject || "31967172109"}. The parcel pin still comes from Places or Geocoding.` : `Address Validation HTTP ${res.status}. ${failure.message}`;
		logs.push(diag(blocked ? "warn" : "error", "ADDRESS_VALIDATION", message));
		return {
			status: blocked ? "BLOCKED" : "FAILED",
			message
		};
	}
	const result = json?.result;
	const verdict = result?.verdict ?? {};
	const granularity = typeof verdict.validationGranularity === "string" ? verdict.validationGranularity : void 0;
	const addressComplete = typeof verdict.addressComplete === "boolean" ? verdict.addressComplete : void 0;
	const dpv = result?.uspsData?.dpvConfirmation;
	const message = `Address Validation OK. Granularity ${granularity || "unspecified"}. DPV ${dpv || "not returned"}.`;
	logs.push(diag("info", "ADDRESS_VALIDATION", message));
	return {
		status: "SUCCESS",
		message,
		granularity,
		addressComplete,
		dpv
	};
}
async function solarInsights(lat, lng, logs) {
	if (isBlocked("solar")) {
		const message = "Solar API skipped. This key returned API_KEY_SERVICE_BLOCKED within the last 10 minutes, so buildingInsights was not called again. No roof geometry was invented.";
		logs.push(diag("info", "SOLAR", message));
		return {
			solar: blankSolar("SKIPPED", message, { reason: "API_KEY_SERVICE_BLOCKED" }),
			planes: []
		};
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
		const message = blocked ? `Solar API blocked by this key (${failure.reason || "HTTP 403"}). Confirmed consumer ${failure.project ? "projects/" + failure.project : "not returned"}. Add solar.googleapis.com to the key's API restrictions. No planes, areas, or edge lengths were fabricated.` : noCoverage ? "Solar API returned NOT_FOUND for requiredQuality BASE. Google has no building insights for this coordinate. No substitute geometry was created." : `Solar API HTTP ${res.status}. ${failure.reason ? failure.reason + ". " : ""}${failure.message}`;
		logs.push(diag(noCoverage ? "warn" : "error", "SOLAR", message));
		return {
			solar: blankSolar(blocked ? "BLOCKED" : noCoverage ? "NO_COVERAGE" : "FAILED", message, {
				reason: failure.reason,
				httpStatus: res.status,
				projectNumber: failure.project
			}),
			planes: []
		};
	}
	const mapped = mapSolarInsights(json);
	logs.push(diag("info", "SOLAR", `buildingInsights OK. Imagery ${mapped.imageryQuality || "unspecified"} ${mapped.imageryDate || ""}. Planes ${mapped.planes.length}. wholeRoofStats.areaMeters2 ${mapped.wholeRoofAreaM2 ?? "absent"}. Bounding boxes were kept as bounds, not drawn as roof outlines. requiredQuality=BASE returns the best imagery Google has. Data layers were not requested.`));
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
			maxSunshineHours: mapped.maxSunshineHours
		},
		planes: mapped.planes
	};
}
async function measureProperty(input) {
	const query = input.query?.trim() ?? "";
	const placeId = input.placeId?.trim() ?? "";
	if (!placeId && query.length < 3) return {
		ok: false,
		status: 400,
		message: "Enter a street address."
	};
	if (query.length > 240 || placeId.length > 300) return {
		ok: false,
		status: 400,
		message: "That address is too long."
	};
	const cacheKey = placeId ? `p:${placeId}` : `q:${query.toLowerCase()}`;
	const cached = measureCache.get(cacheKey);
	if (cached && Date.now() - cached.at < CACHE_MS) {
		const job = structuredClone(cached.job);
		job.diagnostics = [...job.diagnostics, diag("info", "CACHE", "Same parcel returned from a 15-minute server memory cache so Google was not billed again. Coordinates are not written to a server disk.")];
		return {
			ok: true,
			job
		};
	}
	const logs = [];
	let formatted = null;
	let resolvedPlace = placeId || null;
	let lat = null;
	let lng = null;
	let locationType = null;
	let partial = false;
	let coordinateSource = null;
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
		if (!coded) return {
			ok: false,
			status: 422,
			message: placeId ? "Google could not resolve that place." : "Google Geocoding did not find that address."
		};
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
	const cachedAt = /* @__PURE__ */ new Date();
	const expiresAt = new Date(cachedAt.getTime() + COORD_TTL_MS);
	const stamp = cachedAt.toISOString();
	const job = {
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
			expiresAt: expiresAt.toISOString()
		},
		geocodeStatus: "SUCCESS",
		addressValidation: validation,
		solar: solar.solar,
		planes: solar.planes,
		edges: [],
		existingSolar: emptyExisting(),
		review: {
			checked: false,
			verifiedAt: null
		},
		prices: {},
		diagnostics: logs
	};
	measureCache.set(cacheKey, {
		at: Date.now(),
		job: structuredClone(job)
	});
	if (resolvedPlace) measureCache.set(`p:${resolvedPlace}`, {
		at: Date.now(),
		job: structuredClone(job)
	});
	return {
		ok: true,
		job
	};
}
async function autocompletePlaces(input, sessionToken) {
	const text = input.trim();
	if (text.length < 3 || text.length > 200) return [];
	const cacheKey = text.toLowerCase();
	const cached = suggestCache.get(cacheKey);
	if (cached && Date.now() - cached.at < 6e4) return cached.suggestions;
	const res = await fetch("https://places.googleapis.com/v1/places:autocomplete", {
		method: "POST",
		headers: {
			"content-type": "application/json",
			"X-Goog-Api-Key": KEY,
			"X-Goog-FieldMask": "suggestions.placePrediction.placeId,suggestions.placePrediction.structuredFormat.mainText.text,suggestions.placePrediction.structuredFormat.secondaryText.text,suggestions.placePrediction.text.text"
		},
		body: JSON.stringify({
			input: text,
			includedRegionCodes: ["us"],
			sessionToken,
			languageCode: "en"
		})
	});
	const json = await readBody(res);
	if (!res.ok || !json?.suggestions) return [];
	const suggestions = [];
	for (const row of json.suggestions) {
		const prediction = row.placePrediction;
		if (!prediction?.placeId) continue;
		suggestions.push({
			placeId: prediction.placeId,
			main: prediction.structuredFormat?.mainText?.text || prediction.text?.text || "Place",
			secondary: prediction.structuredFormat?.secondaryText?.text || ""
		});
		if (suggestions.length === 5) break;
	}
	suggestCache.set(cacheKey, {
		at: Date.now(),
		suggestions
	});
	return suggestions;
}
function mapsConfig() {
	return {
		apiKey: KEY,
		mapId: "DEMO_MAP_ID",
		projectNumber: confirmedProject || "31967172109"
	};
}
var Route$2 = createFileRoute("/api/maps/config")({ server: { handlers: { GET: async () => {
	const config = mapsConfig();
	return Response.json({
		apiKey: config.apiKey,
		mapId: config.mapId,
		projectNumber: config.projectNumber
	}, { headers: { "cache-control": "no-store" } });
} } } });
var Route$1 = createFileRoute("/api/places/autocomplete")({ server: { handlers: { POST: async ({ request }) => {
	try {
		const body = await request.json();
		const suggestions = await autocompletePlaces(body.input ?? "", body.sessionToken || crypto.randomUUID());
		return Response.json({ suggestions }, { headers: { "cache-control": "no-store" } });
	} catch (error) {
		console.info(`[places] ${scrub(error instanceof Error ? error.message : "autocomplete failed")}`);
		return Response.json({ suggestions: [] });
	}
} } } });
var Route = createFileRoute("/api/property/measure")({ server: { handlers: { POST: async ({ request }) => {
	try {
		const result = await measureProperty(await request.json());
		if (!result.ok) return Response.json({ message: result.message }, { status: result.status });
		return Response.json({ job: result.job }, { headers: { "cache-control": "no-store" } });
	} catch (error) {
		const message = scrub(error instanceof Error ? error.message : "Lookup failed.");
		console.info(`[measure] ${message}`);
		return Response.json({ message: "Lookup failed before a parcel was returned." }, { status: 502 });
	}
} } } });
var rootRouteChildren = {
	IndexRoute: Route$3.update({
		id: "/",
		path: "/",
		getParentRoute: () => Route$4
	}),
	ApiMapsConfigRoute: Route$2.update({
		id: "/api/maps/config",
		path: "/api/maps/config",
		getParentRoute: () => Route$4
	}),
	ApiPlacesAutocompleteRoute: Route$1.update({
		id: "/api/places/autocomplete",
		path: "/api/places/autocomplete",
		getParentRoute: () => Route$4
	}),
	ApiPropertyMeasureRoute: Route.update({
		id: "/api/property/measure",
		path: "/api/property/measure",
		getParentRoute: () => Route$4
	})
};
var routeTree = Route$4._addFileChildren(rootRouteChildren)._addFileTypes();
var router_exports = /* @__PURE__ */ __exportAll({ getRouter: () => getRouter });
function getRouter() {
	return createRouter({
		routeTree,
		rewrite: previewPathRewrite(),
		defaultErrorComponent: AppErrorComponent
	});
}
//#endregion
export { previewPathPrefix as n, router_exports as t };
