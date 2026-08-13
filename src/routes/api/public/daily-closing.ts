import { createFileRoute } from "@tanstack/react-router";

// Called by the scheduled database job at 00:00 Cairo time for the day that just
// ended. Idempotent: re-running for the same date updates that date's single row.
export const Route = createFileRoute("/api/public/daily-closing")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { isAuthorizedSyncRequest } = await import("@/lib/sheets/webhook-auth.server");
        if (!(await isAuthorizedSyncRequest(request))) {
          return new Response("Unauthorized", { status: 401 });
        }

        let payload: { date?: string } = {};
        try {
          payload = (await request.json()) as { date?: string };
        } catch {
          payload = {};
        }

        const date = payload.date ?? "";
        if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
          return new Response("Invalid payload", { status: 400 });
        }

        const { writeDailyClosing } = await import("@/lib/sheets/sync.server");
        const result = await writeDailyClosing(date);
        return Response.json({ ok: result.ok });
      },
    },
  },
});
