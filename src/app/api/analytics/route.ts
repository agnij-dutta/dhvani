// GET /api/analytics -> { overall: LatencyStats-per-field, recent: AnalyticsRecord[] }

import { getAnalytics } from "@/server/analytics";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request): Promise<Response> {
  const limitParam = new URL(req.url).searchParams.get("limit");
  const limit = Math.min(Math.max(Number(limitParam) || 50, 1), 500);
  try {
    const payload = await getAnalytics(limit);
    return Response.json(payload, { headers: { "cache-control": "no-store" } });
  } catch (e) {
    return Response.json({ error: (e as Error).message }, { status: 500 });
  }
}
