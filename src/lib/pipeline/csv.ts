import { compass, edgeLength, edgeTotals, planeArea, pitchRatio, workingSurfaceSqFt } from "./geometry";
import { materialBom, type MaterialSystem } from "./materials";
import type { Job } from "./types";
import { EDGE_KINDS, EDGE_LABEL, UNAVAILABLE } from "./types";

function cell(value: string | number | null | undefined): string {
  const text = value == null || value === "" ? "" : String(value);
  return `"${text.replace(/"/g, '""')}"`;
}

function row(values: (string | number | null | undefined)[]): string {
  return values.map(cell).join(",");
}

export function jobToCsv(job: Job, system: MaterialSystem, wastePct: number): string {
  const area = workingSurfaceSqFt(job);
  const totals = edgeTotals(job.edges);
  const lines: string[] = [];
  lines.push(row(["ForgeOne roof geometry"]));
  lines.push(row(["Address", job.formattedAddress ?? job.input]));
  lines.push(row(["Place ID", job.placeId ?? ""]));
  lines.push(row(["Coordinate source", job.coordinateSource ?? ""]));
  lines.push(
    row([
      "Latitude",
      job.coordinates ? job.coordinates.lat : UNAVAILABLE,
    ]),
  );
  lines.push(row(["Longitude", job.coordinates ? job.coordinates.lng : UNAVAILABLE]));
  lines.push(row(["Coordinates cached", job.coordinates?.cachedAt ?? ""]));
  lines.push(row(["Coordinates expire", job.coordinates?.expiresAt ?? ""]));
  lines.push(row(["Geocoding", job.geocodeStatus]));
  lines.push(row(["Address validation", job.addressValidation.status, job.addressValidation.message]));
  lines.push(row(["Solar API", job.solar.status, job.solar.message]));
  lines.push(row(["Imagery quality", job.solar.imageryQuality ?? UNAVAILABLE]));
  lines.push(row(["Imagery date", job.solar.imageryDate ?? UNAVAILABLE]));
  lines.push(
    row([
      "Whole roof m2",
      job.solar.wholeRoofAreaM2 ?? UNAVAILABLE,
      "solarPotential.wholeRoofStats.areaMeters2",
    ]),
  );
  lines.push(row(["Working surface sq ft", area.sqFt ?? UNAVAILABLE, area.detail]));
  lines.push(row(["Working surface source", area.source]));
  lines.push(
    row([
      "Max array panels",
      job.solar.maxPanels ?? UNAVAILABLE,
      "solarPotential.maxArrayPanelsCount (potential, not an existing system)",
    ]),
  );
  lines.push(row(["Panel watts", job.solar.panelCapacityWatts ?? UNAVAILABLE]));
  lines.push(row(["Max sunshine hours per year", job.solar.maxSunshineHours ?? UNAVAILABLE]));
  for (const kind of EDGE_KINDS) {
    const total = totals[kind];
    lines.push(row([EDGE_LABEL[kind] + " ft", total.feet ?? UNAVAILABLE, total.source]));
  }
  lines.push(row(["Existing solar recorded", job.existingSolar.recorded ? "yes" : "no"]));
  lines.push(row(["Existing solar present", job.existingSolar.recorded ? (job.existingSolar.present ? "yes" : "no") : UNAVAILABLE]));
  lines.push(row(["Existing panel count", job.existingSolar.panelCount ?? ""]));
  lines.push(row(["Existing kW", job.existingSolar.capacityKw ?? ""]));
  lines.push(row([]));
  lines.push(row(["Planes"]));
  lines.push(
    row(["Label", "Origin", "Pitch deg", "Pitch source", "Ratio", "Azimuth deg", "Azimuth source", "Heading", "Area sq ft", "Area source", "Solar m2", "Solar ground m2", "Height m"]),
  );
  for (const plane of job.planes) {
    const reading = planeArea(plane);
    lines.push(
      row([
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
        plane.solar?.heightMeters,
      ]),
    );
  }
  lines.push(row([]));
  lines.push(row(["Edges"]));
  lines.push(row(["Kind", "Feet", "Source", "Points", "Detail"]));
  for (const edge of job.edges) {
    const length = edgeLength(edge);
    lines.push(row([edge.kind, length.feet, length.source, edge.path.length, length.detail]));
  }
  lines.push(row([]));
  lines.push(row(["Materials", system, `waste ${wastePct}%`]));
  lines.push(row(["Item", "Qty", "Unit", "Formula", "Unit price", "Extended"]));
  for (const item of materialBom(system, wastePct, area.sqFt, {
    ridge: totals.ridge.feet,
    hip: totals.hip.feet,
    valley: totals.valley.feet,
    eave: totals.eave.feet,
    rake: totals.rake.feet,
    flashing: totals.flashing.feet,
  })) {
    const price = job.prices[item.id];
    const extended = item.qty != null && price != null ? item.qty * price : "";
    lines.push(row([item.item, item.qty ?? UNAVAILABLE, item.unit, item.reason ?? item.formula, price ?? "", extended]));
  }
  lines.push(row([]));
  lines.push(row(["API log"]));
  for (const entry of job.diagnostics) {
    lines.push(row([entry.at, entry.level, entry.service, entry.message]));
  }
  return lines.join("\n");
}
