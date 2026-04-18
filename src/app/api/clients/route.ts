import { NextResponse, type NextRequest } from "next/server";

import { createDrizzleClientRepository } from "@/clients/infrastructure/drizzle-client-repository";
import { parseFiltersFromSearchParams } from "@/shared/filters/parse-filters";

export const dynamic = "force-dynamic";
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
