import assert from "node:assert/strict";
import test from "node:test";
import {
  degreesFromRise,
  haversineMeters,
  pathLengthFeet,
  pitchRatio,
  planeArea,
  planeFigures,
  repairLegacyPitchDegrees,
  ringGroundSqMeters,
} from "./geometry.ts";
import { mapSolarInsights } from "./mapSolar.ts";
import { scrub } from "./scrub.ts";

test("scrub removes key material", () => {
  const dirty = "failed key=AIzaSyEXAMPLEKEY1234567890abc and AIzaSyEXAMPLEKEY1234567890abc";
  const clean = scrub(dirty);
  assert.equal(clean.includes("AIza"), false);
  assert.match(clean, /REDACTED/);
});

test("legacy pitch chips were rise, not degrees", () => {
  const repaired = repairLegacyPitchDegrees(6, "MANUAL");
  assert.ok(repaired != null && Math.abs(repaired - 26.565) < 0.02);
  assert.equal(repairLegacyPitchDegrees(repaired, "MANUAL"), repaired);
  assert.equal(repairLegacyPitchDegrees(18.4, "SOLAR"), 18.4);
});

test("pitch ratio uses tangent", () => {
  assert.equal(pitchRatio(0), "0.0:12");
  const six = Number(pitchRatio(26.565).split(":")[0]);
  assert.ok(Math.abs(six - 6) < 0.05);
});

test("6:12 pitch round-trips and lifts footprint to slope area", () => {
  const degrees = degreesFromRise(6);
  assert.ok(Math.abs(degrees - 26.565) < 0.02);
  assert.equal(pitchRatio(degrees), "6.0:12");
  const lat = 32.75;
  const lng = -97.33;
  const dLat = 40 / 3.280839895 / 111320;
  const dLng = 100 / 3.280839895 / (111320 * Math.cos((lat * Math.PI) / 180));
  const figures = planeFigures({
    id: "p",
    label: "Test",
    origin: "MANUAL",
    solar: null,
    path: [
      { lat, lng },
      { lat, lng: lng + dLng },
      { lat: lat + dLat, lng: lng + dLng },
      { lat: lat + dLat, lng },
    ],
    pitchDegrees: degrees,
    pitchSource: "MANUAL",
    azimuthDegrees: null,
    azimuthSource: "UNAVAILABLE",
    areaOverrideSqFt: null,
    manual: null,
    hasExistingPanels: false,
  });
  assert.ok(figures.footprintSqFt != null && Math.abs(figures.footprintSqFt - 4000) < 40);
  const expected = figures.footprintSqFt! / Math.cos((degrees * Math.PI) / 180);
  assert.ok(figures.surfaceSqFt != null && Math.abs(figures.surfaceSqFt - expected) < 5);
  assert.ok(figures.surfaceSqFt! > figures.footprintSqFt!);
});

test("square ring area is about 100 ft by 40 ft", () => {
  const lat = 32.75;
  const lng = -97.33;
  const dLat = 40 / 3.280839895 / 111320;
  const dLng = 100 / 3.280839895 / (111320 * Math.cos((lat * Math.PI) / 180));
  const path = [
    { lat, lng },
    { lat, lng: lng + dLng },
    { lat: lat + dLat, lng: lng + dLng },
    { lat: lat + dLat, lng },
  ];
  const meters = ringGroundSqMeters(path);
  assert.ok(meters != null);
  const sqft = meters! * 10.76391041671;
  assert.ok(Math.abs(sqft - 4000) < 40);
  const edge = pathLengthFeet([path[0]!, path[1]!]);
  assert.ok(edge != null && Math.abs(edge - 100) < 1);
});

test("haversine is symmetric", () => {
  const a = { lat: 32.75, lng: -97.33 };
  const b = { lat: 32.76, lng: -97.34 };
  assert.ok(Math.abs(haversineMeters(a, b) - haversineMeters(b, a)) < 0.001);
});

test("solar mapper keeps direct fields and does not invent edges or polygons", () => {
  let n = 0;
  const mapped = mapSolarInsights(
    {
      name: "buildings/test",
      imageryQuality: "HIGH",
      imageryDate: { year: 2024, month: 6, day: 2 },
      solarPotential: {
        maxArrayPanelsCount: 12,
        panelCapacityWatts: 400,
        panelHeightMeters: 1.7,
        panelWidthMeters: 1.0,
        maxSunshineHoursPerYear: 1600,
        wholeRoofStats: { areaMeters2: 150.2, groundAreaMeters2: 140 },
        roofSegmentStats: [
          {
            pitchDegrees: 22.5,
            azimuthDegrees: 180,
            planeHeightAtCenterMeters: 7.5,
            stats: { areaMeters2: 80.25, groundAreaMeters2: 74.1 },
            center: { latitude: 32.7, longitude: -97.3 },
            boundingBox: {
              sw: { latitude: 32.699, longitude: -97.301 },
              ne: { latitude: 32.701, longitude: -97.299 },
            },
          },
        ],
      },
    },
    () => `plane-${n++}`,
  );
  assert.equal(mapped.planes.length, 1);
  assert.equal(mapped.planes[0]!.path, null);
  assert.equal(mapped.planes[0]!.pitchSource, "SOLAR");
  assert.equal(mapped.planes[0]!.solar?.areaMeters2, 80.25);
  assert.equal(mapped.wholeRoofAreaM2, 150.2);
  assert.equal(mapped.maxPanels, 12);
  const area = planeArea(mapped.planes[0]!);
  assert.equal(area.source, "CONVERTED");
  assert.ok(area.sqFt != null && Math.abs(area.sqFt - 80.25 * 10.76391041671) < 0.01);
});
