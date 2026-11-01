import { createFileRoute } from "@tanstack/react-router";
import { measureProperty } from "@/lib/pipeline/google.server";
import { scrub } from "@/lib/pipeline/scrub";

export const Route = createFileRoute("/api/property/measure")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const body = (await request.json()) as { query?: string; placeId?: string; sessionToken?: string };
          const result = await measureProperty(body);
          if (!result.ok) {
            return Response.json({ message: result.message }, { status: result.status });
          }
          return Response.json({ job: result.job }, { headers: { "cache-control": "no-store" } });
        } catch (error) {
          const message = scrub(error instanceof Error ? error.message : "Lookup failed.");
          console.info(`[measure] ${message}`);
          return Response.json({ message: "Lookup failed before a parcel was returned." }, { status: 502 });
        }
      },
    },
  },
});
