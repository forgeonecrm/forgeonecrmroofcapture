import { APIProvider, Map, useMap, useMapsLibrary } from "@vis.gl/react-google-maps";
import { useEffect, useRef, type MutableRefObject } from "react";
import { bboxPath, m2ToSqFt, pathLengthFeet, pitchRatio, ringGroundSqMeters, surfaceFromGroundM2 } from "@/lib/pipeline/geometry";
import type { EdgeKind, Job, LatLng } from "@/lib/pipeline/types";
import { EDGE_LABEL } from "@/lib/pipeline/types";

export type MapTool = "select" | "edge" | "plane" | "move";

export type ShowFlags = {
  planes: boolean;
  bounds: boolean;
  ridge: boolean;
  hip: boolean;
  valley: boolean;
  eave: boolean;
  rake: boolean;
  flashing: boolean;
};

const EDGE_COLOR: Record<EdgeKind, string> = {
  ridge: "#e24b4b",
  hip: "#e38b2c",
  valley: "#2aa8c4",
  eave: "#2f9d6a",
  rake: "#8b6cc9",
  flashing: "#d4b15a",
};

export type DrawApi = {
  undo: () => void;
  finish: () => void;
  cancel: () => void;
};

type RoofMapProps = {
  apiKey: string;
  mapId: string;
  job: Job | null;
  tool: MapTool;
  edgeKind: EdgeKind;
  pitch: number;
  selectedPlaneId: string | null;
  selectedEdgeId: string | null;
  show: ShowFlags;
  mapType: "hybrid" | "satellite" | "roadmap";
  onSelectPlane: (id: string | null) => void;
  onSelectEdge: (id: string | null) => void;
  onCommitEdge: (path: LatLng[], kind: EdgeKind) => void;
  onCommitPlane: (path: LatLng[], pitch: number) => void;
  onMovePlaneVertex: (planeId: string, index: number, pos: LatLng) => void;
  onMoveEdgeVertex: (edgeId: string, index: number, pos: LatLng) => void;
  onToggle: (key: keyof ShowFlags) => void;
  drawApi: MutableRefObject<DrawApi>;
};

function readLatLng(
  pos: google.maps.LatLng | google.maps.LatLngLiteral | google.maps.LatLngAltitude | null | undefined,
): LatLng | null {
  if (!pos) return null;
  if (typeof (pos as google.maps.LatLng).lat === "function") {
    const point = pos as google.maps.LatLng;
    return { lat: point.lat(), lng: point.lng() };
  }
  const literal = pos as google.maps.LatLngLiteral;
  return typeof literal.lat === "number" && typeof literal.lng === "number"
    ? { lat: literal.lat, lng: literal.lng }
    : null;
}

function planeColor(azimuth: number | null): string {
  if (azimuth == null) return "#22d3ee";
  const n = ((azimuth % 360) + 360) % 360;
  if (n >= 45 && n < 135) return "#38bdf8";
  if (n >= 135 && n < 225) return "#f59e0b";
  if (n >= 225 && n < 315) return "#a78bfa";
  return "#64748b";
}

function handleEl(): HTMLDivElement {
  const el = document.createElement("div");
  el.className = "vertex-handle";
  return el;
}

function dot(map: google.maps.Map, point: LatLng, color: string): google.maps.Circle {
  return new google.maps.Circle({
    map,
    center: point,
    radius: 0.7,
    strokeColor: color,
    strokeWeight: 2,
    fillColor: "#f8fafc",
    fillOpacity: 1,
    clickable: false,
    zIndex: 40,
  });
}

function MapCanvas(props: Omit<RoofMapProps, "apiKey" | "mapId">) {
  const map = useMap();
  const markerLib = useMapsLibrary("marker");
  const feetRef = useRef<HTMLSpanElement>(null);
  const projectionRef = useRef<google.maps.MapCanvasProjection | null>(null);
  const propsRef = useRef(props);
  propsRef.current = props;
  const flown = useRef("");
  const placeRef = useRef<(point: LatLng) => void>(() => {});

  useEffect(() => {
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

  useEffect(() => {
    if (!map) return;
    const job = propsRef.current.job;
    const coords = job?.coordinates;
    if (!coords || !job) {
      if (flown.current !== "overview") {
        flown.current = "overview";
        map.moveCamera({ center: { lat: 32.75, lng: -97.33 }, zoom: 10, tilt: 0, heading: 0 });
      }
      return;
    }
    const key = `${job.id}:${coords.lat.toFixed(5)}:${coords.lng.toFixed(5)}`;
    if (flown.current === key) return;
    flown.current = key;
    map.moveCamera({ center: { lat: coords.lat, lng: coords.lng }, zoom: 20, tilt: 0, heading: 0 });
  }, [map, props.job?.id, props.job?.coordinates?.lat, props.job?.coordinates?.lng]);

  useEffect(() => {
    if (!map) return;
    map.setMapTypeId(props.mapType);
  }, [map, props.mapType]);

  useEffect(() => {
    if (!map || !markerLib || !props.job) return;
    const { job, tool, selectedPlaneId, selectedEdgeId, show } = props;
    const drawing = tool === "edge" || tool === "plane";
    const forwardDraw = (event: google.maps.MapMouseEvent) => {
      if (!drawing) return false;
      const point = readLatLng(event.latLng);
      if (!point) return false;
      event.stop();
      placeRef.current(point);
      return true;
    };
    const objects: { setMap: (next: google.maps.Map | null) => void }[] = [];
    const listeners: google.maps.MapsEventListener[] = [];
    const forgetMarker = (marker: google.maps.marker.AdvancedMarkerElement) => {
      objects.push({ setMap: () => (marker.map = null) });
    };

    if (job.coordinates) {
      const pin = document.createElement("div");
      pin.className = "map-pin";
      pin.textContent = "Parcel";
      forgetMarker(
        new markerLib.AdvancedMarkerElement({
          map,
          position: { lat: job.coordinates.lat, lng: job.coordinates.lng },
          content: pin,
          title: job.formattedAddress || "Parcel",
          gmpClickable: false,
        }),
      );
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
          fillOpacity: selected ? 0.45 : 0.22,
          clickable: drawing || tool === "select",
          zIndex: selected ? 4 : 2,
        });
        listeners.push(
          poly.addListener("click", (event: google.maps.MapMouseEvent) => {
            if (forwardDraw(event)) return;
            propsRef.current.onSelectPlane(plane.id);
            propsRef.current.onSelectEdge(null);
          }),
        );
        objects.push(poly);
        if (tool === "move") {
          plane.path.forEach((point, index) => {
            const marker = new markerLib.AdvancedMarkerElement({
              map,
              position: point,
              content: handleEl(),
              gmpDraggable: true,
              zIndex: 20,
            });
            listeners.push(
              marker.addListener("drag", () => {
                const next = readLatLng(marker.position);
                if (!next || !plane.path) return;
                poly.setPaths(plane.path.map((p, i) => (i === index ? next : p)));
              }),
            );
            listeners.push(
              marker.addListener("dragend", () => {
                const next = readLatLng(marker.position);
                if (next) propsRef.current.onMovePlaneVertex(plane.id, index, next);
              }),
            );
            forgetMarker(marker);
          });
        }
      } else if (show.planes && plane.solar?.center) {
        const el = document.createElement("div");
        el.className = plane.id === selectedPlaneId ? "plane-pill is-selected" : "plane-pill";
        const rise =
          plane.pitchDegrees == null ? "pitch not set" : `${((12 * Math.tan((plane.pitchDegrees * Math.PI) / 180)) || 0).toFixed(1)}:12`;
        el.textContent = `${plane.label} · ${rise}`;
        const marker = new markerLib.AdvancedMarkerElement({
          map,
          position: plane.solar.center,
          content: el,
          gmpClickable: !drawing,
          title: plane.label,
        });
        listeners.push(
          marker.addListener("click", () => {
            propsRef.current.onSelectPlane(plane.id);
            propsRef.current.onSelectEdge(null);
          }),
        );
        forgetMarker(marker);
      }
      if (show.bounds && plane.solar?.boundingBox && !plane.path) {
        const ring = bboxPath(plane.solar.boundingBox);
        objects.push(
          new google.maps.Polyline({
            map,
            path: [...ring, ring[0]!],
            strokeOpacity: 0,
            clickable: false,
            icons: [
              {
                icon: { path: "M 0,-1 0,1", strokeOpacity: 0.95, strokeColor: "#94a3b8", scale: 2 },
                offset: "0",
                repeat: "10px",
              },
            ],
            zIndex: 1,
          }),
        );
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
        zIndex: selected ? 6 : 3,
      });
      listeners.push(
        line.addListener("click", (event: google.maps.MapMouseEvent) => {
          if (forwardDraw(event)) return;
          propsRef.current.onSelectEdge(edge.id);
          propsRef.current.onSelectPlane(null);
        }),
      );
      objects.push(line);
      if (tool === "move") {
        edge.path.forEach((point, index) => {
          const marker = new markerLib.AdvancedMarkerElement({
            map,
            position: point,
            content: handleEl(),
            gmpDraggable: true,
            zIndex: 21,
          });
          listeners.push(
            marker.addListener("drag", () => {
              const next = readLatLng(marker.position);
              if (!next) return;
              line.setPath(edge.path.map((p, i) => (i === index ? next : p)));
            }),
          );
          listeners.push(
            marker.addListener("dragend", () => {
              const next = readLatLng(marker.position);
              if (next) propsRef.current.onMoveEdgeVertex(edge.id, index, next);
            }),
          );
          forgetMarker(marker);
        });
      }
    }

    return () => {
      listeners.forEach((listener) => listener.remove());
      objects.forEach((object) => object.setMap(null));
    };
  }, [map, markerLib, props.job, props.tool, props.selectedPlaneId, props.selectedEdgeId, props.show]);

  useEffect(() => {
    if (!map) return;
    const tool = propsRef.current.tool;
    if (tool !== "edge" && tool !== "plane") {
      placeRef.current = () => {};
      map.setOptions({ draggableCursor: undefined, disableDoubleClickZoom: false });
      propsRef.current.drawApi.current = { undo() {}, finish() {}, cancel() {} };
      if (feetRef.current) feetRef.current.textContent = "";
      return;
    }
    if (!props.job?.coordinates) {
      if (feetRef.current) feetRef.current.textContent = "Measure an address before drawing.";
      return;
    }
    map.setOptions({ draggableCursor: "crosshair", disableDoubleClickZoom: true });
    const draft: LatLng[] = [];
    const rubber = new google.maps.Polyline({
      map,
      strokeColor: "#22d3ee",
      strokeWeight: 3,
      clickable: true,
      zIndex: 30,
    });
    const dots: google.maps.Circle[] = [];
    let lastAccept = 0;

    const pixels = (point: LatLng) =>
      projectionRef.current?.fromLatLngToContainerPixel(new google.maps.LatLng(point.lat, point.lng)) ?? null;

    const pixelDistance = (a: LatLng, b: LatLng) => {
      const pa = pixels(a);
      const pb = pixels(b);
      if (!pa || !pb) return Number.POSITIVE_INFINITY;
      return Math.hypot(pa.x - pb.x, pa.y - pb.y);
    };

    const snap = (point: LatLng): LatLng => {
      const job = propsRef.current.job;
      const pool: LatLng[] = [...draft.slice(0, -1)];
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

    const paint = (cursor?: LatLng) => {
      const path = cursor ? [...draft, cursor] : [...draft];
      const drawingEdge = propsRef.current.tool === "edge";
      rubber.setOptions({
        strokeColor: drawingEdge ? EDGE_COLOR[propsRef.current.edgeKind] : "#22d3ee",
      });
      rubber.setPath(path);
      if (!feetRef.current) return;
      const length = pathLengthFeet(path);
      const pitch = propsRef.current.pitch;
      const label = drawingEdge ? EDGE_LABEL[propsRef.current.edgeKind] : `Plane ${pitchRatio(pitch)}`;
      const ground = path.length >= 3 ? ringGroundSqMeters(path) : null;
      const surface = ground == null ? null : surfaceFromGroundM2(ground, pitch);
      const area =
        ground == null
          ? ""
          : ` · footprint ${Math.round(m2ToSqFt(ground)).toLocaleString()} sq ft${
              surface == null ? "" : ` · slope ${Math.round(m2ToSqFt(surface)).toLocaleString()} sq ft`
            }`;
      feetRef.current.textContent =
        draft.length === 0
          ? `${label}. Click the roof. Double-click or Finish closes a plane.`
          : `${label}. ${draft.length} pt${length == null ? "" : ` · ${length.toFixed(1)} ft`}${area}`;
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
      propsRef.current.onCommitPlane(
        draft.map((point) => ({ ...point })),
        propsRef.current.pitch,
      );
      clearDraft();
    };

    propsRef.current.drawApi.current = {
      undo() {
        draft.pop();
        dots.pop()?.setMap(null);
        paint();
      },
      finish: finishPlane,
      cancel: clearDraft,
    };

    const place = (point: LatLng) => {
      draft.push(point);
      const drawingEdge = propsRef.current.tool === "edge";
      const marker = dot(map, point, drawingEdge ? EDGE_COLOR[propsRef.current.edgeKind] : "#22d3ee");
      marker.setOptions({ clickable: true, zIndex: 40 });
      marker.addListener("click", (event: google.maps.MapMouseEvent) => {
        const next = readLatLng(event.latLng);
        if (next) accept(next);
      });
      dots.push(marker);
    };

    const accept = (raw: LatLng) => {
      const now = performance.now();
      if (now - lastAccept < 50) return;
      lastAccept = now;
      const point = snap(raw);
      if (propsRef.current.tool === "edge") {
        if (draft.length > 0 && pixelDistance(point, draft[draft.length - 1]!) < 4) return;
        place(point);
        if (draft.length >= 2) {
          propsRef.current.onCommitEdge(
            draft.map((vertex) => ({ ...vertex })),
            propsRef.current.edgeKind,
          );
          clearDraft();
        } else paint();
        return;
      }
      if (draft.length >= 3 && pixelDistance(point, draft[0]!) < 14) {
        finishPlane();
        return;
      }
      if (draft.length > 0 && pixelDistance(point, draft[draft.length - 1]!) < 4) {
        if (draft.length >= 3) finishPlane();
        return;
      }
      place(point);
      paint();
    };

    placeRef.current = accept;
    rubber.addListener("click", (event: google.maps.MapMouseEvent) => {
      const point = readLatLng(event.latLng);
      if (point) accept(point);
    });

    const clickListener = map.addListener("click", (event: google.maps.MapMouseEvent) => {
      const point = readLatLng(event.latLng);
      if (point) accept(point);
    });
    const host = map.getDiv();
    const pointerOrigin = { x: 0, y: 0 };
    const onPointerDown = (event: PointerEvent) => {
      pointerOrigin.x = event.clientX;
      pointerOrigin.y = event.clientY;
    };
    const onPointerUp = (event: PointerEvent) => {
      if (Math.hypot(event.clientX - pointerOrigin.x, event.clientY - pointerOrigin.y) > 6) return;
      const target = event.target;
      if (target instanceof Element && target.closest("button, a, input, .gm-bundled-control, .gmnoprint")) return;
      const projection = projectionRef.current;
      if (!projection) return;
      const rect = host.getBoundingClientRect();
      const latLng = projection.fromContainerPixelToLatLng(
        new google.maps.Point(event.clientX - rect.left, event.clientY - rect.top),
      );
      const point = readLatLng(latLng);
      if (point) accept(point);
    };
    host.addEventListener("pointerdown", onPointerDown, true);
    host.addEventListener("pointerup", onPointerUp, true);
    const dblListener = map.addListener("dblclick", (event: google.maps.MapMouseEvent) => {
      event.stop();
      if (propsRef.current.tool === "plane") finishPlane();
    });
    const moveListener = map.addListener("mousemove", (event: google.maps.MapMouseEvent) => {
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
      propsRef.current.drawApi.current = { undo() {}, finish() {}, cancel() {} };
      map.setOptions({ draggableCursor: undefined, disableDoubleClickZoom: false });
    };
  }, [map, props.tool, props.job?.id, props.job?.coordinates]);

  const legend: [keyof ShowFlags, string][] = [
    ["planes", "Planes"],
    ["bounds", "Bounds"],
    ["ridge", "Ridge"],
    ["hip", "Hip"],
    ["valley", "Valley"],
    ["eave", "Eave"],
    ["rake", "Rake"],
    ["flashing", "Flash"],
  ];

  return (
    <>
      <div className="pointer-events-none absolute inset-x-0 top-2 z-10 flex justify-center px-2">
        <span ref={feetRef} className="rounded-md bg-bg/90 px-3 py-1 text-sm text-fg empty:hidden" />
      </div>
      <div className="absolute bottom-3 left-3 z-10 flex max-w-full flex-wrap gap-1 pr-16">
        {legend.map(([key, label]) => (
          <button key={key} type="button" className="legend-btn" onClick={() => props.onToggle(key)}>
            <span className={`legend-swatch legend-${key} ${props.show[key] ? "" : "is-off"}`} />
            {label}
          </button>
        ))}
      </div>
    </>
  );
}

export function RoofMap(props: RoofMapProps) {
  return (
    <div className="map-stage" data-tool={props.tool}>
      <APIProvider apiKey={props.apiKey} libraries={["marker", "geometry"]}>
        <Map
          defaultCenter={{ lat: 32.75, lng: -97.33 }}
          defaultZoom={10}
          mapId={props.mapId}
          mapTypeId="hybrid"
          gestureHandling="greedy"
          clickableIcons={false}
          tilt={0}
          heading={0}
          style={{ width: "100%", height: "100%" }}
        >
          <MapCanvas {...props} />
        </Map>
      </APIProvider>
    </div>
  );
}
