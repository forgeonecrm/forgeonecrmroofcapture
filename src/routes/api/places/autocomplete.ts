import { createFileRoute } from "@tanstack/react-router";
import { autocompletePlaces } from "@/lib/pipeline/google.server";
import { scrub } from "@/lib/pipeline/scrub";

export const Route = createFileRoute("/api/places/autocomplete")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const body = (await request.json()) as { input?: string; sessionToken?: string };
          const suggestions = await autocompletePlaces(body.input ?? "", body.sessionToken || crypto.randomUUID());
          return Response.json({ suggestions }, { headers: { "cache-control": "no-store" } });
        } catch (error) {
          console.info(`[places] ${scrub(error instanceof Error ? error.message : "autocomplete failed")}`);
          return Response.json({ suggestions: [] });
        }
      },
    },
  },
});
