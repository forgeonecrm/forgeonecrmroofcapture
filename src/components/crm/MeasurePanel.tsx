import { compass, degreesFromRise, edgeLength, edgeTotals, footprintTotalSqFt, formatMeasure, isVerified, m2ToSqFt, planeFigures, reviewChecks, riseFromDegrees, workingSurfaceSqFt } from "@/lib/pipeline/geometry";
import { MATERIAL_LABEL, WASTE_OPTIONS, materialBom, type MaterialSystem } from "@/lib/pipeline/materials";
import type { EdgeKind, Job, Plane, Source } from "@/lib/pipeline/types";
import { EDGE_KINDS, EDGE_LABEL, UNAVAILABLE } from "@/lib/pipeline/types";

function Badge({ source }: { source: Source }) {
  return <span className={`badge badge-${source.toLowerCase()}`}>{source === "SOLAR" ? "Solar" : source === "CONVERTED" ? "Converted" : source === "CALCULATED" ? "Calculated" : source === "MANUAL" ? "Manual" : "Unavailable"}</span>;
}

function Metric({ label, value, source, detail }: { label: string; value: string; source?: Source; detail?: string }) {
  return (
    <div className="rounded-md border border-line bg-surface-2 p-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs uppercase tracking-wide text-muted">{label}</p>
        {source ? <Badge source={source} /> : null}
      </div>
      <p className="mt-1 text-sm text-fg">{value}</p>
      {detail ? <p className="mt-1 text-xs text-muted">{detail}</p> : null}
    </div>
  );
}

export function MeasurePanel({
  job,
  selectedPlaneId,
  selectedEdgeId,
  material,
  waste,
  onMaterial,
  onWaste,
  onSelectPlane,
  onSelectEdge,
  onPatch,
  onOpenDiagnostics,
}: {
  job: Job | null;
  selectedPlaneId: string | null;
  selectedEdgeId: string | null;
  material: MaterialSystem;
  waste: number;
  onMaterial: (value: MaterialSystem) => void;
  onWaste: (value: number) => void;
  onSelectPlane: (id: string | null) => void;
  onSelectEdge: (id: string | null) => void;
  onPatch: (recipe: (job: Job) => Job, keepReview?: boolean) => void;
  onOpenDiagnostics: () => void;
}) {
  if (!job) {
    return (
      <aside className="flex h-full flex-col gap-3 overflow-y-auto border-line p-4 md:border-l">
        <h2 className="font-display text-xl uppercase tracking-wide">Measurements</h2>
        <p className="text-sm text-muted">
          Measure a street address. If Solar returns planes, pitch, azimuth, and area show up here with the Google field that supplied them. Edges stay blank until you draw or enter them.
        </p>
      </aside>
    );
  }

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
    flashing: totals.flashing.feet,
  });
  const capacityKw =
    job.solar.maxPanels != null && job.solar.panelCapacityWatts != null
      ? (job.solar.maxPanels * job.solar.panelCapacityWatts) / 1000
      : null;

  const updatePlane = (id: string, recipe: (plane: Plane) => Plane) => {
    onPatch((current) => ({
      ...current,
      planes: current.planes.map((plane) => (plane.id === id ? recipe(plane) : plane)),
    }));
  };

  return (
    <aside className="flex h-full flex-col gap-4 overflow-y-auto border-line p-4 md:border-l">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h2 className="font-display text-xl uppercase tracking-wide">Measurements</h2>
          <p className="text-sm text-muted">{job.formattedAddress || job.input}</p>
        </div>
        {verified ? <span className="badge badge-manual">Estimator verified</span> : null}
      </div>

      <div className="flex flex-wrap gap-2 text-xs text-muted">
        <span>Place ID {job.placeId || UNAVAILABLE}</span>
        <span>·</span>
        <span>
          {job.coordinates
            ? `Pin expires ${new Date(job.coordinates.expiresAt).toLocaleDateString()}`
            : "Coordinates expired or missing"}
        </span>
      </div>

      <div className="grid gap-2">
        <Metric
          label="Footprint"
          value={formatMeasure(footprint, 0, "sq ft")}
          source={footprint == null ? "UNAVAILABLE" : "CALCULATED"}
          detail="Flat area of the traces, or Solar groundAreaMeters2. Not the slope."
        />
        <Metric
          label="Slope area"
          value={formatMeasure(area.sqFt, 0, "sq ft")}
          source={area.source}
          detail={area.detail}
        />
        <Metric
          label="Squares"
          value={area.sqFt == null ? UNAVAILABLE : formatMeasure(area.sqFt / 100, 2, "sq")}
          source={area.sqFt == null ? "UNAVAILABLE" : "CALCULATED"}
          detail="Slope area ÷ 100. This is the number materials use."
        />
        <Metric
          label="Solar potential"
          value={
            job.solar.maxPanels == null
              ? UNAVAILABLE
              : `${job.solar.maxPanels} panels${capacityKw == null ? "" : ` · ${capacityKw.toFixed(2)} kW calculated`}`
          }
          source={job.solar.maxPanels == null ? "UNAVAILABLE" : "SOLAR"}
          detail="maxArrayPanelsCount and panelCapacityWatts. This is potential, not an existing array."
        />
      </div>

      <section className="flex flex-col gap-2">
        <h3 className="text-sm font-semibold">Planes</h3>
        {job.planes.length === 0 ? (
          <p className="text-sm text-muted">No planes yet. Draw a facet on the aerial, or add length and width below.</p>
        ) : null}
        {job.planes.map((plane) => {
          const figures = planeFigures(plane);
          const open = plane.id === selectedPlaneId;
          const rise = plane.pitchDegrees == null ? null : riseFromDegrees(plane.pitchDegrees);
          return (
            <div key={plane.id} className={`rounded-md border p-3 ${open ? "border-accent" : "border-line"}`}>
              <button type="button" className="flex w-full items-center justify-between gap-2 text-left" onClick={() => onSelectPlane(open ? null : plane.id)}>
                <span className="font-medium">{plane.label}</span>
                <Badge source={plane.origin === "SOLAR" ? "SOLAR" : "MANUAL"} />
              </button>
              <p className="mt-2 text-sm">
                Pitch {rise == null ? "not set" : `${rise.toFixed(1)}:12`}
                {plane.pitchDegrees == null ? "" : ` · ${plane.pitchDegrees.toFixed(1)}°`}
              </p>
              <p className="text-sm">
                Azimuth {plane.azimuthDegrees == null ? "not set" : `${plane.azimuthDegrees.toFixed(0)}° ${compass(plane.azimuthDegrees)}`}
              </p>
              <p className="text-sm">Footprint {formatMeasure(figures.footprintSqFt, 0, "sq ft")}</p>
              <p className="text-sm">Slope {formatMeasure(figures.surfaceSqFt, 0, "sq ft")}</p>
              {plane.solar?.areaMeters2 != null ? (
                <p className="text-xs text-muted">Solar slope {plane.solar.areaMeters2.toFixed(2)} m² · {m2ToSqFt(plane.solar.areaMeters2).toFixed(0)} sq ft</p>
              ) : null}
              {plane.solar?.boundingBox && !plane.path ? (
                <p className="text-xs text-muted">A dashed box is the Solar bounding box, not the roof outline.</p>
              ) : null}
              {open ? (
                <div className="mt-3 grid gap-2">
                  <p className="text-xs text-muted">Pitch is rise per 12. 6:12 is 26.6°, not 6°.</p>
                  <div className="flex flex-wrap gap-1">
                    {[3, 4, 5, 6, 7, 8, 9, 10, 12].map((value) => (
                      <button
                        key={value}
                        type="button"
                        className={rise != null && Math.abs(rise - value) < 0.2 ? "btn-solid" : "btn-quiet"}
                        onClick={() =>
                          updatePlane(plane.id, (current) => ({
                            ...current,
                            pitchDegrees: degreesFromRise(value),
                            pitchSource: "MANUAL",
                          }))
                        }
                      >
                        {value}:12
                      </button>
                    ))}
                  </div>
                  <label className="grid gap-1 text-xs text-muted">
                    Azimuth degrees
                    <input
                      className="field"
                      type="number"
                      step="1"
                      value={plane.azimuthDegrees ?? ""}
                      onChange={(event) => {
                        const value = event.target.value === "" ? null : Number(event.target.value);
                        updatePlane(plane.id, (current) => ({
                          ...current,
                          azimuthDegrees: value,
                          azimuthSource: value == null ? "UNAVAILABLE" : current.solar && value === current.solar.azimuthDegrees ? "SOLAR" : "MANUAL",
                        }));
                      }}
                    />
                  </label>
                  <label className="grid gap-1 text-xs text-muted">
                    Slope area correction (sq ft)
                    <input
                      className="field"
                      type="number"
                      step="1"
                      value={plane.areaOverrideSqFt ?? ""}
                      onChange={(event) => {
                        const value = event.target.value === "" ? null : Number(event.target.value);
                        updatePlane(plane.id, (current) => ({ ...current, areaOverrideSqFt: value }));
                      }}
                    />
                  </label>
                  <p className="text-xs text-muted">{figures.note}</p>
                  {plane.origin === "SOLAR" ? (
                    <button
                      type="button"
                      className="btn-quiet"
                      onClick={() =>
                        updatePlane(plane.id, (current) => ({
                          ...current,
                          pitchDegrees: current.solar?.pitchDegrees ?? null,
                          pitchSource: current.solar?.pitchDegrees == null ? "UNAVAILABLE" : "SOLAR",
                          azimuthDegrees: current.solar?.azimuthDegrees ?? null,
                          azimuthSource: current.solar?.azimuthDegrees == null ? "UNAVAILABLE" : "SOLAR",
                          areaOverrideSqFt: null,
                        }))
                      }
                    >
                      Reset corrections
                    </button>
                  ) : (
                    <button
                      type="button"
                      className="btn-quiet"
                      onClick={() => onPatch((current) => ({ ...current, planes: current.planes.filter((item) => item.id !== plane.id) }))}
                    >
                      Remove plane
                    </button>
                  )}
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={plane.hasExistingPanels}
                      onChange={(event) => updatePlane(plane.id, (current) => ({ ...current, hasExistingPanels: event.target.checked }))}
                    />
                    Existing panels on this plane
                  </label>
                </div>
              ) : null}
            </div>
          );
        })}
        <ManualPlaneForm
          onAdd={(plane) => onPatch((current) => ({ ...current, planes: [...current.planes, plane] }))}
        />
      </section>

      <section className="flex flex-col gap-2">
        <h3 className="text-sm font-semibold">Edges</h3>
        <p className="text-xs text-muted">A dash means {UNAVAILABLE}. Draw the line on the aerial or enter the length. Solar does not classify edges.</p>
        {EDGE_KINDS.map((kind) => (
          <div key={kind} className="flex items-center justify-between gap-2 text-sm">
            <span>{EDGE_LABEL[kind]}</span>
            <span className="text-right">
              {totals[kind].feet == null ? "—" : formatMeasure(totals[kind].feet, 1, "ft")}
            </span>
          </div>
        ))}
        {job.edges.map((edge) => {
          const length = edgeLength(edge);
          const open = edge.id === selectedEdgeId;
          return (
            <div key={edge.id} className={`rounded-md border p-3 ${open ? "border-accent" : "border-line"}`}>
              <button type="button" className="text-left text-sm font-medium" onClick={() => onSelectEdge(open ? null : edge.id)}>
                {EDGE_LABEL[edge.kind]} · {length.feet == null ? UNAVAILABLE : `${length.feet.toFixed(1)} ft`}
              </button>
              {open ? (
                <div className="mt-2 grid gap-2">
                  <label className="grid gap-1 text-xs text-muted">
                    Kind
                    <select
                      className="field"
                      value={edge.kind}
                      onChange={(event) =>
                        onPatch((current) => ({
                          ...current,
                          edges: current.edges.map((item) =>
                            item.id === edge.id ? { ...item, kind: event.target.value as EdgeKind } : item,
                          ),
                        }))
                      }
                    >
                      {EDGE_KINDS.map((kind) => (
                        <option key={kind} value={kind}>{EDGE_LABEL[kind]}</option>
                      ))}
                    </select>
                  </label>
                  <label className="grid gap-1 text-xs text-muted">
                    Length feet
                    <input
                      className="field"
                      type="number"
                      step="0.1"
                      value={edge.lengthOverrideFt ?? ""}
                      placeholder={length.feet == null ? "" : length.feet.toFixed(1)}
                      onChange={(event) => {
                        const value = event.target.value === "" ? null : Number(event.target.value);
                        onPatch((current) => ({
                          ...current,
                          edges: current.edges.map((item) =>
                            item.id === edge.id ? { ...item, lengthOverrideFt: value } : item,
                          ),
                        }));
                      }}
                    />
                  </label>
                  <p className="text-xs text-muted">{length.detail}</p>
                  <button
                    type="button"
                    className="btn-quiet"
                    onClick={() => onPatch((current) => ({ ...current, edges: current.edges.filter((item) => item.id !== edge.id) }))}
                  >
                    Remove edge
                  </button>
                </div>
              ) : null}
            </div>
          );
        })}
        <EnteredEdgeForm
          onAdd={(kind, feet) =>
            onPatch((current) => ({
              ...current,
              edges: [
                ...current.edges,
                { id: crypto.randomUUID(), kind, path: [], lengthOverrideFt: feet, origin: "ENTERED" },
              ],
            }))
          }
        />
      </section>

      <section className="flex flex-col gap-2">
        <h3 className="text-sm font-semibold">Existing solar</h3>
        <p className="text-xs text-muted">Not detected from imagery. Record it only if you have seen the array.</p>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={job.existingSolar.recorded}
            onChange={(event) =>
              onPatch((current) => ({
                ...current,
                existingSolar: { ...current.existingSolar, recorded: event.target.checked },
              }))
            }
          />
          Record an existing system
        </label>
        {job.existingSolar.recorded ? (
          <div className="grid gap-2">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={job.existingSolar.present}
                onChange={(event) =>
                  onPatch((current) => ({
                    ...current,
                    existingSolar: { ...current.existingSolar, present: event.target.checked },
                  }))
                }
              />
              Array is on the roof
            </label>
            <label className="grid gap-1 text-xs text-muted">
              Panels
              <input
                className="field"
                type="number"
                value={job.existingSolar.panelCount ?? ""}
                onChange={(event) =>
                  onPatch((current) => ({
                    ...current,
                    existingSolar: {
                      ...current.existingSolar,
                      panelCount: event.target.value === "" ? null : Number(event.target.value),
                    },
                  }))
                }
              />
            </label>
            <label className="grid gap-1 text-xs text-muted">
              System kW
              <input
                className="field"
                type="number"
                step="0.1"
                value={job.existingSolar.capacityKw ?? ""}
                onChange={(event) =>
                  onPatch((current) => ({
                    ...current,
                    existingSolar: {
                      ...current.existingSolar,
                      capacityKw: event.target.value === "" ? null : Number(event.target.value),
                    },
                  }))
                }
              />
            </label>
            <label className="grid gap-1 text-xs text-muted">
              Inverter
              <input
                className="field"
                value={job.existingSolar.inverter}
                onChange={(event) =>
                  onPatch((current) => ({
                    ...current,
                    existingSolar: { ...current.existingSolar, inverter: event.target.value },
                  }))
                }
              />
            </label>
            <label className="grid gap-1 text-xs text-muted">
              Year
              <input
                className="field"
                type="number"
                value={job.existingSolar.year ?? ""}
                onChange={(event) =>
                  onPatch((current) => ({
                    ...current,
                    existingSolar: {
                      ...current.existingSolar,
                      year: event.target.value === "" ? null : Number(event.target.value),
                    },
                  }))
                }
              />
            </label>
            <label className="grid gap-1 text-xs text-muted">
              Condition
              <input
                className="field"
                value={job.existingSolar.condition}
                onChange={(event) =>
                  onPatch((current) => ({
                    ...current,
                    existingSolar: { ...current.existingSolar, condition: event.target.value },
                  }))
                }
              />
            </label>
          </div>
        ) : null}
      </section>

      <section className="flex flex-col gap-2">
        <h3 className="text-sm font-semibold">Materials</h3>
        <div className="flex flex-wrap gap-2">
          {(Object.keys(MATERIAL_LABEL) as MaterialSystem[]).map((key) => (
            <button key={key} type="button" className={material === key ? "btn-solid" : "btn-quiet"} onClick={() => onMaterial(key)}>
              {MATERIAL_LABEL[key]}
            </button>
          ))}
        </div>
        <label className="grid gap-1 text-xs text-muted">
          Waste
          <select className="field" value={waste} onChange={(event) => onWaste(Number(event.target.value))}>
            {WASTE_OPTIONS.map((value) => (
              <option key={value} value={value}>{value}%</option>
            ))}
          </select>
        </label>
        {bom.map((item) => (
          <div key={item.id} className="rounded-md border border-line p-2 text-sm">
            <div className="flex items-baseline justify-between gap-2">
              <span>{item.item}</span>
              <span>{item.qty == null ? UNAVAILABLE : `${item.qty} ${item.unit}`}</span>
            </div>
            <p className="text-xs text-muted">{item.reason || item.formula}</p>
            <label className="mt-1 flex items-center gap-2 text-xs text-muted">
              Unit price
              <input
                className="field"
                type="number"
                step="0.01"
                value={job.prices[item.id] ?? ""}
                onChange={(event) => {
                  const value = event.target.value === "" ? undefined : Number(event.target.value);
                  onPatch((current) => {
                    const prices = { ...current.prices };
                    if (value == null || Number.isNaN(value)) delete prices[item.id];
                    else prices[item.id] = value;
                    return { ...current, prices };
                  }, true);
                }}
              />
            </label>
          </div>
        ))}
      </section>

      <section className="flex flex-col gap-2 border-t border-line pt-3">
        <h3 className="text-sm font-semibold">Review</h3>
        {checks.map((check) => (
          <p key={check.id} className="text-sm">
            {check.pass ? "Pass" : "Open"} · {check.label}
          </p>
        ))}
        <label className="flex items-start gap-2 text-sm">
          <input
            type="checkbox"
            className="mt-1"
            checked={job.review.checked}
            onChange={(event) =>
              onPatch(
                (current) => ({
                  ...current,
                  review: { checked: event.target.checked, verifiedAt: null },
                }),
                true,
              )
            }
          />
          I compared these figures to the aerial or a site visit.
        </label>
        <button
          type="button"
          className="btn-solid"
          disabled={!checks.every((check) => check.pass)}
          onClick={() =>
            onPatch(
              (current) => ({
                ...current,
                review: { checked: true, verifiedAt: new Date().toISOString() },
              }),
              true,
            )
          }
        >
          {verified ? "Verified" : "Mark estimator verified"}
        </button>
        <button type="button" className="btn-quiet" onClick={onOpenDiagnostics}>
          API diagnostics
        </button>
      </section>
    </aside>
  );
}

function ManualPlaneForm({ onAdd }: { onAdd: (plane: Plane) => void }) {
  return (
    <form
      className="grid gap-2 rounded-md border border-dashed border-line p-3"
      onSubmit={(event) => {
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
            dimension: data.get("dimension") === "FOOTPRINT" ? "FOOTPRINT" : "SURFACE",
          },
          hasExistingPanels: false,
        });
        event.currentTarget.reset();
      }}
    >
      <p className="text-sm font-medium">Add a plane by dimensions</p>
      <input className="field" name="label" placeholder="Label" />
      <div className="grid grid-cols-2 gap-2">
        <input className="field" name="length" type="number" step="0.1" min="0" placeholder="Length ft" required />
        <input className="field" name="width" type="number" step="0.1" min="0" placeholder="Width ft" required />
      </div>
      <select className="field" name="dimension" defaultValue="SURFACE">
        <option value="SURFACE">Dimensions are slope surface</option>
        <option value="FOOTPRINT">Dimensions are ground footprint</option>
      </select>
      <div className="grid grid-cols-2 gap-2">
        <input className="field" name="pitch" type="number" step="0.1" placeholder="Pitch rise/12" />
        <input className="field" name="azimuth" type="number" step="1" placeholder="Azimuth °" />
      </div>
      <button type="submit" className="btn-quiet">Add plane</button>
    </form>
  );
}

function EnteredEdgeForm({ onAdd }: { onAdd: (kind: EdgeKind, feet: number) => void }) {
  return (
    <form
      className="flex flex-wrap items-center gap-2"
      onSubmit={(event) => {
        event.preventDefault();
        const data = new FormData(event.currentTarget);
        const feet = Number(data.get("feet"));
        if (!Number.isFinite(feet) || feet < 0) return;
        onAdd(String(data.get("kind")) as EdgeKind, feet);
        event.currentTarget.reset();
      }}
    >
      <select className="field" name="kind" defaultValue="eave">
        {EDGE_KINDS.map((kind) => (
          <option key={kind} value={kind}>{EDGE_LABEL[kind]}</option>
        ))}
      </select>
      <input className="field w-24" name="feet" type="number" step="0.1" min="0" placeholder="Feet" required />
      <button type="submit" className="btn-quiet">Enter length</button>
    </form>
  );
}
