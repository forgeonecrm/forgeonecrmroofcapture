import { previewPathPrefix } from "@/lib/preview-path-prefix";
import type { Job, Suggestion } from "./types";

function apiUrl(path: string): string {
  if (typeof window === "undefined") return path;
  const prefix = previewPathPrefix(window.location.hostname, window.location.pathname);
  return `${prefix ?? ""}${path}`;
}

export async function fetchSuggestions(input: string, sessionToken: string, signal: AbortSignal): Promise<Suggestion[]> {
  const res = await fetch(apiUrl("/api/places/autocomplete"), {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ input, sessionToken }),
    signal,
  });
  if (!res.ok) return [];
  const data = (await res.json()) as { suggestions?: Suggestion[] };
  return data.suggestions ?? [];
}

export async function measureAddress(input: {
  query?: string;
  placeId?: string;
  sessionToken?: string;
}): Promise<Job> {
  const res = await fetch(apiUrl("/api/property/measure"), {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(input),
  });
  const data = (await res.json()) as { job?: Job; message?: string };
  if (!res.ok || !data.job) {
    throw new Error(data.message || "Lookup failed.");
  }
  return data.job;
}

export async function fetchMapConfig(): Promise<{ apiKey: string; mapId: string; projectNumber: string }> {
  const res = await fetch(apiUrl("/api/maps/config"));
  if (!res.ok) throw new Error("Map configuration failed.");
  return (await res.json()) as { apiKey: string; mapId: string; projectNumber: string };
}
