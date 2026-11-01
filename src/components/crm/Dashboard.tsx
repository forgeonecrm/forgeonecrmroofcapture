import { useEffect, useRef, useState, type ReactNode } from "react";
import { fetchMapConfig, fetchSuggestions, measureAddress } from "@/lib/pipeline/api";
import { jobToCsv } from "@/lib/pipeline/csv";
import { repairLegacyPitchDegrees } from "@/lib/pipeline/geometry";
import type { MaterialSystem } from "@/lib/pipeline/materials";
import { hydratePipeline, usePipeline } from "@/lib/pipeline/store";
import type { EdgeKind, Job, LatLng, Suggestion } from "@/lib/pipeline/types";
import { EDGE_KINDS, EDGE_LABEL, UNAVAILABLE } from "@/lib/pipeline/types";
import { MeasurePanel } from "./MeasurePanel";
import { RoofMap, type DrawApi, type MapTool, type ShowFlags } from "./RoofMap";

const PITCHES = [3, 4, 5, 6, 7, 8, 9, 10, 12];

const EMPTY_DRAW: DrawApi = { undo() {}, finish() {}, cancel() {} };

export function Dashboard() {
  const jobs = usePipeline((state) => state.jobs);
  const selectedId = usePipeline((state) => state.selectedId);
  const hydrated = usePipeline((state) => state.hydrated);
  const select = usePipeline((state) => state.select);
  const upsertMeasured = usePipeline((state) => state.upsertMeasured);
  const patch = usePipeline((state) => state.patch);
  const remove = usePipeline((state) => state.remove);
  const job = jobs.find((item) => item.id === selectedId) ?? null;

  const [tab, setTab] = useState<"jobs" | "map" | "takeoff">("jobs");
  const [intakeOpen, setIntakeOpen] = useState(false);
  const [diagnosticsOpen, setDiagnosticsOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("");
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [lookupError, setLookupError] = useState("");
  const [busy, setBusy] = useState(false);
  const [mapConfig, setMapConfig] = useState<{ apiKey: string; mapId: string; projectNumber: string } | null>(null);
  const [mapError, setMapError] = useState("");
  const [tool, setTool] = useState<MapTool>("select");
  const [edgeKind, setEdgeKind] = useState<EdgeKind>("ridge");
  const [rise, setRise] = useState(6);
  const [mapType, setMapType] = useState<"hybrid" | "satellite" | "roadmap">("hybrid");
  const [selectedPlaneId, setSelectedPlaneId] = useState<string | null>(null);
  const [selectedEdgeId, setSelectedEdgeId] = useState<string | null>(null);
  const [material, setMaterial] = useState<MaterialSystem>("asphalt");
  const [waste, setWaste] = useState(10);
  const [show, setShow] = useState<ShowFlags>({
    planes: true,
    bounds: false,
    ridge: true,
    hip: true,
    valley: true,
    eave: true,
    rake: true,
    flashing: true,
  });
  const sessionRef = useRef(crypto.randomUUID());
  const drawApi = useRef<DrawApi>(EMPTY_DRAW);

  useEffect(() => {
    void hydratePipeline();
    fetchMapConfig()
      .then(setMapConfig)
      .catch(() => setMapError("The map key could not be loaded."));
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    const current = usePipeline.getState().jobs;
    let changed = false;
    const jobs = current.map((item) => ({
      ...item,
      planes: item.planes.map((plane) => {
        const pitchDegrees = repairLegacyPitchDegrees(plane.pitchDegrees, plane.pitchSource);
        if (pitchDegrees === plane.pitchDegrees) return plane;
        changed = true;
        return { ...plane, pitchDegrees };
      }),
    }));
    if (changed) usePipeline.setState({ jobs });
  }, [hydrated]);

  useEffect(() => {
    if (!intakeOpen) return;
    const text = query.trim();
    if (text.length < 3) {
      setSuggestions([]);
      return;
    }
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      fetchSuggestions(text, sessionRef.current, controller.signal)
        .then(setSuggestions)
        .catch(() => setSuggestions([]));
    }, 450);
    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [query, intakeOpen]);

  async function runMeasure(input: { query?: string; placeId?: string }) {
    setBusy(true);
    setLookupError("");
    try {
      const measured = await measureAddress({ ...input, sessionToken: sessionRef.current });
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

  function patchJob(recipe: (current: Job) => Job, keepReview = false) {
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
    const hay = `${item.formattedAddress || ""} ${item.input}`.toLowerCase();
    return hay.includes(filter.trim().toLowerCase());
  });

  const solarBanner =
    job && job.solar.status !== "SUCCESS"
      ? job.solar.message
      : job
        ? "Solar segments are on the map as center pins. A dashed box is only a bounding box. Ridges, hips, valleys, rakes, and eaves are not in the Solar response."
        : "";

  return (
    <div className="flex h-dvh flex-col bg-bg text-fg">
      <header className="flex items-center justify-between gap-3 border-b border-line px-4 py-3">
        <div>
          <p className="font-display text-2xl uppercase leading-none tracking-wide">ForgeOne CRM</p>
          <p className="text-xs uppercase tracking-widest text-muted">Roof geometry</p>
        </div>
        <div className="flex gap-2">
          <button type="button" className="btn-quiet" onClick={() => setDiagnosticsOpen(true)}>
            Diagnostics
          </button>
          <button
            type="button"
            className="btn-solid"
            onClick={() => {
              setIntakeOpen(true);
              setLookupError("");
            }}
          >
            Measure address
          </button>
        </div>
      </header>

      {solarBanner ? <p className="border-b border-line bg-surface px-4 py-2 text-sm text-muted">{solarBanner}</p> : null}

      <div className="flex gap-2 border-b border-line p-2 md:hidden">
        {(
          [
            ["jobs", "Jobs"],
            ["map", "Map"],
            ["takeoff", "Takeoff"],
          ] as const
        ).map(([id, label]) => (
          <button key={id} type="button" className={tab === id ? "btn-solid flex-1" : "btn-quiet flex-1"} onClick={() => setTab(id)}>
            {label}
          </button>
        ))}
      </div>

      <div className="grid min-h-0 flex-1 md:grid-cols-[18rem_minmax(0,1fr)_22rem]">
        <section className={`${tab === "jobs" ? "flex" : "hidden"} h-full min-h-0 flex-col gap-3 border-line p-3 md:flex md:border-r`}>
          <input className="field" value={filter} placeholder="Filter saved parcels" onChange={(event) => setFilter(event.target.value)} />
          <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto">
            {!hydrated ? <p className="text-sm text-muted">Loading saved parcels…</p> : null}
            {hydrated && visibleJobs.length === 0 ? (
              <p className="text-sm text-muted">No parcels yet. Measure an address to drop a real pin. Roof numbers stay empty until Solar returns them or you trace the roof.</p>
            ) : null}
            {visibleJobs.map((item) => (
              <div key={item.id} className={`rounded-md border p-3 ${item.id === job?.id ? "border-accent" : "border-line"}`}>
                <button
                  type="button"
                  className="w-full text-left"
                  onClick={() => {
                    select(item.id);
                    setTab("map");
                    setSelectedPlaneId(null);
                    setSelectedEdgeId(null);
                  }}
                >
                  <p className="text-sm font-medium">{item.formattedAddress || item.input}</p>
                  <p className="mt-1 text-xs text-muted">
                    {item.solar.status === "SUCCESS" ? "Solar planes" : "No Solar geometry"} · {item.planes.length} planes · {item.edges.length} edges
                  </p>
                </button>
                <button type="button" className="btn-quiet mt-2" onClick={() => remove(item.id)}>
                  Remove
                </button>
              </div>
            ))}
          </div>
          <p className="text-xs text-muted">
            Place IDs stay on this device. Coordinates expire after 30 days. Map tiles are not saved. Google Maps Platform usage can incur charges.
          </p>
        </section>

        <section className={`${tab === "map" ? "flex" : "hidden"} h-full min-h-0 flex-col md:flex`}>
          <div className="flex flex-wrap items-center gap-2 border-b border-line p-2">
            {(
              [
                ["select", "Select"],
                ["edge", "Draw edge"],
                ["plane", "Draw plane"],
                ["move", "Move points"],
              ] as const
            ).map(([id, label]) => (
              <button key={id} type="button" className={tool === id ? "btn-solid" : "btn-quiet"} onClick={() => setTool(id)} disabled={!job?.coordinates}>
                {label}
              </button>
            ))}
            {(
              [
                ["hybrid", "Hybrid"],
                ["satellite", "Satellite"],
                ["roadmap", "Map"],
              ] as const
            ).map(([id, label]) => (
              <button key={id} type="button" className={mapType === id ? "btn-solid" : "btn-quiet"} onClick={() => setMapType(id)}>
                {label}
              </button>
            ))}
            {tool === "edge"
              ? EDGE_KINDS.map((kind) => (
                  <button key={kind} type="button" className={edgeKind === kind ? "btn-solid" : "btn-quiet"} onClick={() => setEdgeKind(kind)}>
                    {EDGE_LABEL[kind]}
                  </button>
                ))
              : null}
            {tool === "plane"
              ? PITCHES.map((value) => (
                  <button key={value} type="button" className={rise === value ? "btn-solid" : "btn-quiet"} onClick={() => setRise(value)}>
                    {value}:12
                  </button>
                ))
              : null}
            {tool === "plane" ? (
              <>
                <button type="button" className="btn-quiet" onClick={() => drawApi.current.undo()}>Undo</button>
                <button type="button" className="btn-solid" onClick={() => drawApi.current.finish()}>Finish plane</button>
                <button type="button" className="btn-quiet" onClick={() => drawApi.current.cancel()}>Cancel</button>
              </>
            ) : null}
            {tool === "edge" ? (
              <button type="button" className="btn-quiet" onClick={() => drawApi.current.cancel()}>Cancel point</button>
            ) : null}
            <button type="button" className="btn-quiet" disabled={!job} onClick={downloadCsv}>Download CSV</button>
          </div>
          <div className="relative min-h-0 flex-1">
            {mapError ? <p className="p-4 text-sm">{mapError}</p> : null}
            {!mapConfig && !mapError ? <p className="p-4 text-sm text-muted">Loading map…</p> : null}
            {mapConfig ? (
              <RoofMap
                apiKey={mapConfig.apiKey}
                mapId={mapConfig.mapId}
                job={job}
                tool={tool}
                edgeKind={edgeKind}
                pitch={(Math.atan(rise / 12) * 180) / Math.PI}
                mapType={mapType}
                selectedPlaneId={selectedPlaneId}
                selectedEdgeId={selectedEdgeId}
                show={show}
                drawApi={drawApi}
                onToggle={(key) => setShow((current) => ({ ...current, [key]: !current[key] }))}
                onSelectPlane={setSelectedPlaneId}
                onSelectEdge={setSelectedEdgeId}
                onCommitEdge={(path: LatLng[], kind: EdgeKind) => {
                  const id = crypto.randomUUID();
                  patchJob((current) => ({
                    ...current,
                    edges: [...current.edges, { id, kind, path, lengthOverrideFt: null, origin: "DRAWN" }],
                  }));
                  setSelectedEdgeId(id);
                  setSelectedPlaneId(null);
                }}
                onCommitPlane={(path, planePitch) => {
                  const id = crypto.randomUUID();
                  patchJob((current) => ({
                    ...current,
                    planes: [
                      ...current.planes,
                      {
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
                        hasExistingPanels: false,
                      },
                    ],
                  }));
                  setSelectedPlaneId(id);
                  setSelectedEdgeId(null);
                }}
                onMovePlaneVertex={(planeId, index, pos) => {
                  patchJob((current) => ({
                    ...current,
                    planes: current.planes.map((plane) =>
                      plane.id === planeId && plane.path
                        ? { ...plane, path: plane.path.map((point, pointIndex) => (pointIndex === index ? pos : point)) }
                        : plane,
                    ),
                  }));
                }}
                onMoveEdgeVertex={(edgeId, index, pos) => {
                  patchJob((current) => ({
                    ...current,
                    edges: current.edges.map((edge) =>
                      edge.id === edgeId
                        ? { ...edge, path: edge.path.map((point, pointIndex) => (pointIndex === index ? pos : point)), lengthOverrideFt: null }
                        : edge,
                    ),
                  }));
                }}
              />
            ) : null}
          </div>
        </section>

        <div className={`${tab === "takeoff" ? "block" : "hidden"} min-h-0 md:block`}>
          <MeasurePanel
            job={job}
            selectedPlaneId={selectedPlaneId}
            selectedEdgeId={selectedEdgeId}
            material={material}
            waste={waste}
            onMaterial={setMaterial}
            onWaste={setWaste}
            onSelectPlane={(id) => {
              setSelectedPlaneId(id);
              if (id) setSelectedEdgeId(null);
            }}
            onSelectEdge={(id) => {
              setSelectedEdgeId(id);
              if (id) setSelectedPlaneId(null);
            }}
            onPatch={patchJob}
            onOpenDiagnostics={() => setDiagnosticsOpen(true)}
          />
        </div>
      </div>

      {intakeOpen ? (
        <Modal onClose={() => setIntakeOpen(false)}>
          <form
            className="flex flex-col gap-3"
            onSubmit={(event) => {
              event.preventDefault();
              const match = suggestions[0];
              if (match && query.trim().length >= 3) void runMeasure({ placeId: match.placeId, query });
              else void runMeasure({ query });
            }}
          >
            <div className="flex items-center justify-between">
              <h2 className="font-display text-2xl uppercase">Measure address</h2>
              <button type="button" className="btn-quiet" onClick={() => setIntakeOpen(false)}>Close</button>
            </div>
            <p className="text-sm text-muted">
              Suggestions use Places. Choosing one resolves the place. A typed address uses Geocoding. Solar is requested unless this key recently blocked it. Nothing is invented if Solar fails.
            </p>
            <input
              className="field"
              autoFocus
              value={query}
              placeholder="Street address"
              onChange={(event) => setQuery(event.target.value)}
            />
            <div className="flex max-h-64 flex-col overflow-y-auto">
              {suggestions.map((suggestion) => (
                <button
                  key={suggestion.placeId}
                  type="button"
                  className="border-b border-line px-2 py-3 text-left"
                  onClick={() => void runMeasure({ placeId: suggestion.placeId, query: `${suggestion.main}, ${suggestion.secondary}` })}
                >
                  <span className="block text-sm">{suggestion.main}</span>
                  <span className="text-xs text-muted">{suggestion.secondary}</span>
                </button>
              ))}
            </div>
            {lookupError ? <p className="text-sm text-bad">{lookupError}</p> : null}
            <button type="submit" className="btn-solid" disabled={busy || query.trim().length < 3}>
              {busy ? "Measuring…" : "Measure typed address"}
            </button>
          </form>
        </Modal>
      ) : null}

      {diagnosticsOpen ? (
        <Modal onClose={() => setDiagnosticsOpen(false)}>
          <div className="modal-body flex flex-col gap-3 overflow-y-auto">
            <div className="flex items-center justify-between">
              <h2 className="font-display text-2xl uppercase">Diagnostics</h2>
              <button type="button" className="btn-quiet" onClick={() => setDiagnosticsOpen(false)}>Close</button>
            </div>
            <p className="text-sm text-muted">
              Project {mapConfig?.projectNumber || "31967172109"}. The key stays off this screen. Maps JavaScript receives it only so the map can load. Geocoding, Places, Address Validation, and Solar are called on the server.
            </p>
            <p className="text-sm text-muted">
              iOS and Android 3D map SDKs are not used. This web app does not measure in 3D.
            </p>
            {!job ? <p className="text-sm">Measure an address to see a live result.</p> : null}
            {job ? (
              <>
                <p className="text-sm">Property: {job.formattedAddress || job.input}</p>
                <p className="text-sm">Geocoding: {job.geocodeStatus}. {job.coordinateSource || UNAVAILABLE}</p>
                <p className="text-sm">Address Validation: {job.addressValidation.status}. {job.addressValidation.message}</p>
                <p className="text-sm">Solar: {job.solar.status}. {job.solar.message}</p>
                <p className="text-sm">Imagery: {job.solar.imageryQuality || UNAVAILABLE} {job.solar.imageryDate || ""}</p>
                <ul className="flex flex-col gap-2 text-sm">
                  {job.diagnostics.map((entry, index) => (
                    <li key={`${entry.at}-${index}`}>
                      {entry.service} · {entry.level} · {entry.message}
                    </li>
                  ))}
                </ul>
              </>
            ) : null}
            {job ? (
              <button type="button" className="btn-quiet" disabled={busy || !job.placeId} onClick={() => job.placeId && void runMeasure({ placeId: job.placeId, query: job.formattedAddress || job.input })}>
                Refresh this parcel
              </button>
            ) : null}
          </div>
        </Modal>
      ) : null}
    </div>
  );
}

function Modal({ children, onClose }: { children: ReactNode; onClose: () => void }) {
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={onClose}>
      <div
        className="dialog-sheet"
        role="dialog"
        aria-modal="true"
        onMouseDown={(event) => event.stopPropagation()}
      >
        {children}
      </div>
    </div>
  );
}
