import { NextResponse, type NextRequest } from "next/server";

import { createDrizzleClientRepository } from "@/clients/infrastructure/drizzle-client-repository";
import { parseFiltersFromSearchParams } from "@/shared/filters/parse-filters";

/**
 * GET /api/clients — list endpoint for the dashboard table (PRD §RF3.3) and
 * the filter strip (§RF3.2). Server-rendered (§RF3.1) so opening the
 * dashboard always shows fresh data and the charts + table share one view.
 *
 * Query params (all optional): see
 * {@link parseFiltersFromSearchParams} — that helper is the single source
 * of truth for the URL contract (`vendor`, `industry`, `size`, `closed`,
 * `sentiment`, `search`).
 *
 * Response: { clients: Client[], total: number }.
 *
 * Screaming Architecture note: this handler is a THIN adapter — it parses
 * the request, delegates to the repository port, and renders JSON. No
 * domain logic lives here.
 */

// Always recompute — this is a data endpoint, never cacheable.
export const dynamic = "force-dynamic";
// Neon HTTP driver requires Node (not Edge runtime).
export const runtime = "nodejs";

export async function GET(request: NextRequest): Promise<Response> {
  try {
    const filters = parseFiltersFromSearchParams(request.nextUrl.searchParams);
    const repo = createDrizzleClientRepository();
    const rows = await repo.findAll(filters);
    return NextResponse.json({ clients: rows, total: rows.length });
  } catch (err) {
    console.error("[GET /api/clients] error:", err);
    return NextResponse.json({ error: "internal" }, { status: 500 });
  }
}
