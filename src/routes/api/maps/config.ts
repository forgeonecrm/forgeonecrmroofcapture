import { createFileRoute } from "@tanstack/react-router";
import { mapsConfig } from "@/lib/pipeline/google.server";

export const Route = createFileRoute("/api/maps/config")({
  server: {
    handlers: {
      GET: async () => {
        const config = mapsConfig();
        return Response.json(
          { apiKey: config.apiKey, mapId: config.mapId, projectNumber: config.projectNumber },
          { headers: { "cache-control": "no-store" } },
        );
      },
    },
  },
});