import { NextResponse, type NextRequest } from "next/server";

import type { ClientFilters } from "@/clients/application/client-repository";
import { createDrizzleClientRepository } from "@/clients/infrastructure/drizzle-client-repository";

/**
 * GET /api/clients — list endpoint for the dashboard table (PRD §RF3.3) and
 * the filter strip (§RF3.2). Server-rendered (§RF3.1) so opening the
 * dashboard always shows fresh data and the charts + table share one view.
 *
 * Query params (all optional):
 *   assignedSeller, industry, companySize, sentiment, search — strings
 *   closed — 'true' | 'false' (malformed → ignored, treated as unset)
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
    const filters = parseFilters(request.nextUrl.searchParams);
    const repo = createDrizzleClientRepository();
    const rows = await repo.findAll(filters);
    return NextResponse.json({ clients: rows, total: rows.length });
  } catch (err) {
    console.error("[GET /api/clients] error:", err);
    return NextResponse.json({ error: "internal" }, { status: 500 });
  }
}

function parseFilters(sp: URLSearchParams): ClientFilters {
  const filters: Record<string, string | boolean> = {};
  for (const key of [
    "assignedSeller",
    "industry",
    "companySize",
    "sentiment",
    "search",
  ] as const) {
    const value = sp.get(key);
    if (value !== null && value.length > 0) filters[key] = value;
  }
  const closed = sp.get("closed");
  if (closed === "true") filters.closed = true;
  else if (closed === "false") filters.closed = false;
  // Any other value → ignore, so malformed inputs don't silently downgrade
  // to `closed=false`.
  return filters as ClientFilters;
}
