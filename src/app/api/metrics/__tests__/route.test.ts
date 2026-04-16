// @vitest-environment node
import { config as loadEnv } from "dotenv";
import { NextRequest } from "next/server";
import { describe, expect, it } from "vitest";

loadEnv({ path: ".env.local", override: true });

import { GET } from "@/app/api/metrics/route";

/**
 * Integration tests for GET /api/metrics. These tests read whatever is in
 * the seeded DB (57 classified rows from task 5.4) — they assert shape and
 * invariants, not specific values, so re-runs never flake.
 */

const hasDbUrl = Boolean(process.env.DATABASE_URL);

describe.skipIf(!hasDbUrl)("GET /api/metrics (integration)", () => {
  it("returns 200 with all expected top-level keys", async () => {
    const req = new NextRequest("http://localhost/api/metrics");
    const res = await GET(req);

    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      kpis: unknown;
      sellers: unknown;
      closeRateBy: Record<string, unknown>;
      sellerByIndustry: unknown;
      objections: unknown;
    };

    expect(body.kpis).toBeDefined();
    expect(Array.isArray(body.sellers)).toBe(true);
    expect(body.closeRateBy).toBeDefined();
    expect(Array.isArray(body.sellerByIndustry)).toBe(true);
    expect(body.objections).toBeDefined();
  });

  it("closeRateBy contains all 6 expected dimensions", async () => {
    const req = new NextRequest("http://localhost/api/metrics");
    const res = await GET(req);
    const body = (await res.json()) as {
      closeRateBy: Record<string, unknown>;
    };

    expect(Object.keys(body.closeRateBy).sort()).toEqual(
      [
        "buyingSignal",
        "companySize",
        "decisionMakerRole",
        "industry",
        "purchaseTimeline",
        "sentiment",
      ].sort(),
    );
    for (const dim of Object.values(body.closeRateBy)) {
      expect(Array.isArray(dim)).toBe(true);
    }
  });

  it("accepts a filter query and narrows the KPI total", async () => {
    // Sanity check: a filter query returns a kpis.totalClients <= the
    // unfiltered total. We don't know the absolute numbers without inspecting
    // the seed — this invariant is stable regardless.
    const baseline = await GET(new NextRequest("http://localhost/api/metrics"));
    const filtered = await GET(
      new NextRequest("http://localhost/api/metrics?closed=true"),
    );

    expect(baseline.status).toBe(200);
    expect(filtered.status).toBe(200);
    const baseBody = (await baseline.json()) as {
      kpis: { totalClients: number };
    };
    const filteredBody = (await filtered.json()) as {
      kpis: { totalClients: number };
    };
    expect(filteredBody.kpis.totalClients).toBeLessThanOrEqual(
      baseBody.kpis.totalClients,
    );
  });
});
