import type { EdgeKind } from "./types";
import { UNAVAILABLE } from "./types";

export type MaterialSystem = "asphalt" | "metal" | "tile" | "tpo";

export type BomLine = {
  id: string;
  item: string;
  formula: string;
  qty: number | null;
  unit: string;
  reason?: string;
};

export const MATERIAL_LABEL: Record<MaterialSystem, string> = {
  asphalt: "Architectural asphalt",
  metal: "Standing seam metal",
  tile: "Concrete S tile",
  tpo: "60-mil TPO",
};

const WASTE = [5, 10, 12, 15, 20] as const;
export const WASTE_OPTIONS = WASTE;

function ceilDiv(value: number, size: number): number {
  return Math.ceil(value / size);
}

function line(
  id: string,
  item: string,
  formula: string,
  qty: number | null,
  unit: string,
  reason?: string,
): BomLine {
  return { id, item, formula, qty, unit, reason };
}

function needEdges(feet: number | null, label: string): string | undefined {
  return feet == null ? `${label}: ${UNAVAILABLE}` : undefined;
}

export function materialBom(
  system: MaterialSystem,
  wastePct: number,
  areaSqFt: number | null,
  edges: Record<EdgeKind, number | null>,
): BomLine[] {
  if (areaSqFt == null || areaSqFt <= 0) {
    return [
      line(
        "area",
        "Field material",
        "Needs a roof surface area",
        null,
        "—",
        UNAVAILABLE,
      ),
    ];
  }
  const waste = 1 + wastePct / 100;
  const squares = (areaSqFt * waste) / 100;
  const eave = edges.eave;
  const rake = edges.rake;
  const ridge = edges.ridge;
  const hip = edges.hip;
  const valley = edges.valley;
  const drip = eave != null && rake != null ? eave + rake : null;
  const hipRidge = ridge != null && hip != null ? ridge + hip : null;

  if (system === "asphalt") {
    return [
      line("shingles", "Architectural shingles", `${squares.toFixed(2)} sq × 3 bundles/sq`, ceilDiv(squares, 1 / 3), "bundles"),
      line("underlayment", "Synthetic underlayment", `${squares.toFixed(2)} sq ÷ 10 sq/roll`, Math.ceil(squares / 10), "rolls"),
      line(
        "starter",
        "Starter strip",
        drip == null ? "eaves + rakes" : `${drip.toFixed(1)} lf ÷ 100 lf/roll`,
        drip == null ? null : Math.ceil(drip / 100),
        "rolls",
        needEdges(drip, "Eaves and rakes"),
      ),
      line(
        "hipridge",
        "Hip and ridge cap",
        hipRidge == null ? "ridges + hips" : `${hipRidge.toFixed(1)} lf ÷ 25 lf/bundle`,
        hipRidge == null ? null : Math.ceil(hipRidge / 25),
        "bundles",
        needEdges(hipRidge, "Ridges and hips"),
      ),
      line(
        "ice",
        "Ice and water",
        "Assumes 3 ft along eaves and 6 ft total valley width, 200 sq ft/roll",
        eave == null || valley == null ? null : Math.ceil((eave * 3 + valley * 6) / 200),
        "rolls",
        eave == null || valley == null ? `Eaves and valleys: ${UNAVAILABLE}` : undefined,
      ),
      line(
        "drip",
        "Drip edge",
        drip == null ? "eaves + rakes" : `${drip.toFixed(1)} lf × 1.10 ÷ 10 ft sticks`,
        drip == null ? null : Math.ceil((drip * 1.1) / 10),
        "sticks",
        needEdges(drip, "Eaves and rakes"),
      ),
      line("nails", "Coil nails", `${squares.toFixed(2)} sq × 2.5 lb`, Math.ceil(squares * 2.5), "lb"),
    ];
  }

  if (system === "metal") {
    return [
      line("panels", "16 in standing-seam panels", `${(areaSqFt * waste).toFixed(0)} sq ft of panel`, Math.ceil(areaSqFt * waste), "sq ft"),
      line(
        "ridge",
        "Ridge cap",
        ridge == null ? "ridge length" : `${ridge.toFixed(1)} lf × 1.10`,
        ridge == null ? null : Math.ceil(ridge * 1.1),
        "lf",
        needEdges(ridge, "Ridges"),
      ),
      line(
        "rake",
        "Rake trim",
        rake == null ? "rake length" : `${rake.toFixed(1)} lf × 1.10`,
        rake == null ? null : Math.ceil(rake * 1.1),
        "lf",
        needEdges(rake, "Rakes"),
      ),
      line(
        "valley",
        "W-valley",
        valley == null ? "valley length" : `${valley.toFixed(1)} lf × 1.10`,
        valley == null ? null : Math.ceil(valley * 1.1),
        "lf",
        needEdges(valley, "Valleys"),
      ),
      line("underlayment", "High-temp underlayment", `${squares.toFixed(2)} sq ÷ 10`, Math.ceil(squares / 10), "rolls"),
      line("clips", "Expansion clips", "about 1 clip per 2 sq ft of panel", Math.ceil((areaSqFt * waste) / 2), "clips"),
    ];
  }

  if (system === "tile") {
    return [
      line("tile", "Field tile", `${squares.toFixed(2)} sq × 90 tiles/sq`, Math.ceil(squares * 90), "tiles"),
      line(
        "caps",
        "Hip and ridge caps",
        hipRidge == null ? "ridges + hips" : `${hipRidge.toFixed(1)} lf ÷ 1 ft per cap`,
        hipRidge == null ? null : Math.ceil(hipRidge),
        "caps",
        needEdges(hipRidge, "Ridges and hips"),
      ),
      line("underlayment", "Self-adhered underlayment", `${squares.toFixed(2)} sq ÷ 2 sq/roll`, Math.ceil(squares / 2), "rolls"),
      line("battens", "1×2 battens", `${squares.toFixed(2)} sq × 32 lf`, Math.ceil(squares * 32), "lf"),
    ];
  }

  return [
    line("membrane", "60-mil TPO", `${squares.toFixed(2)} sq ÷ 10 sq/roll`, Math.ceil(squares / 10), "rolls"),
    line("iso", "2 in polyiso", `${(areaSqFt * waste).toFixed(0)} sq ft ÷ 32 sq ft/board`, Math.ceil((areaSqFt * waste) / 32), "boards"),
    line("plates", "Plates and fasteners", "4 per 32 sq ft board", Math.ceil((areaSqFt * waste) / 32) * 4, "sets"),
    line("adhesive", "Bonding adhesive", `${squares.toFixed(2)} sq ÷ 6 sq per 5-gal pail`, Math.ceil(squares / 6), "pails"),
    line(
      "edge",
      "Edge metal",
      drip == null ? "eaves + rakes" : `${drip.toFixed(1)} lf × 1.10 ÷ 10 ft`,
      drip == null ? null : Math.ceil((drip * 1.1) / 10),
      "sticks",
      needEdges(drip, "Eaves and rakes"),
    ),
  ];
}
