// @vitest-environment node
import "dotenv/config";
import { config as loadEnv } from "dotenv";
import { sql } from "drizzle-orm";
import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
} from "vitest";

loadEnv({ path: ".env.local", override: true });

import {
  createMetricsCalculator,
  type MetricsCalculator,
} from "@/analytics/application/metrics-calculator";
import { clients, type NewClient } from "@/clients/infrastructure/db/schema";

/**
 * Integration tests for MetricsCalculator against real Neon Postgres.
 *
 * Design:
 *  - We do NOT touch the 57 seeded rows. Every fixture uses
 *    `metrics-test-*@example.com` and we cleanup with LIKE on that prefix.
 *  - Every fixture row is `classificationStatus: 'classified'` so dimension
 *    aggregations include it.
 *  - We assert against expected counts derived from the fixture distribution.
 *
 * All `closed: true` rows must have `keyObjection: 'Ninguna'` (the objection
 * was overcome). `closed: false` rows carry a specific blocking objection.
 * This mirrors the ground-truth semantics exercised by the classifier.
 */

const hasDbUrl = Boolean(process.env.DATABASE_URL);

// Fixture: 8 rows with a deliberate distribution.
//
// Sellers × Industry × Closed breakdown:
//  - Toro Tecnología: 2 closed, 0 not -> 2/2 = 1.0
//  - Toro Salud:      0 closed, 1 not -> 0/1 = 0.0
//  - Puma Tecnología: 1 closed, 1 not -> 1/2 = 0.5
//  - Puma Retail:     1 closed, 1 not -> 1/2 = 0.5
//  - Lobo Tecnología: 0 closed, 1 not -> 0/1 = 0.0
//
// Totals: 8 rows, 4 closed, close_rate = 0.5
// Sellers aggregate: Toro 2/3 ≈ 0.667, Puma 2/4 = 0.5, Lobo 0/1 = 0.0
// Industries aggregate: Tec 3/5 = 0.6, Retail 1/2 = 0.5, Salud 0/1 = 0.0
// Pain points: Volumen Repetitivo × 4, Integración × 2, Costos × 2
//   -> Volumen Repetitivo is the top.
// Objections in closed (keyObjection=Ninguna × 4): Ninguna is the only bucket.
// Objections in not closed: Compliance × 1, Integración × 1, Precio × 2.
const FIXTURE: readonly NewClient[] = [
  {
    name: "Fixture Row 1",
    email: "metrics-test-1@example.com",
    phone: null,
    meetingDate: new Date("2026-01-02T12:00:00Z"),
    assignedSeller: "Toro",
    closed: true,
    transcript: "fixture",
    industry: "Tecnología",
    companySize: "Mid-market",
    mainPainPoint: "Volumen Repetitivo",
    keyObjection: "Ninguna",
    purchaseTimeline: "Corto",
    buyingSignal: "Muy Interesado",
    decisionMakerRole: "CEO",
    sentiment: "Positivo",
    classificationStatus: "classified",
  },
  {
    name: "Fixture Row 2",
    email: "metrics-test-2@example.com",
    phone: null,
    meetingDate: new Date("2026-01-03T12:00:00Z"),
    assignedSeller: "Toro",
    closed: true,
    transcript: "fixture",
    industry: "Tecnología",
    companySize: "Enterprise",
    mainPainPoint: "Volumen Repetitivo",
    keyObjection: "Ninguna",
    purchaseTimeline: "Corto",
    buyingSignal: "Muy Interesado",
    decisionMakerRole: "CTO",
    sentiment: "Positivo",
    classificationStatus: "classified",
  },
  {
    name: "Fixture Row 3",
    email: "metrics-test-3@example.com",
    phone: null,
    meetingDate: new Date("2026-01-04T12:00:00Z"),
    assignedSeller: "Toro",
    closed: false,
    transcript: "fixture",
    industry: "Salud",
    companySize: "Mid-market",
    mainPainPoint: "Integración",
    keyObjection: "Compliance",
    purchaseTimeline: "Largo",
    buyingSignal: "Dudoso",
    decisionMakerRole: "Gerente",
    sentiment: "Neutral",
    classificationStatus: "classified",
  },
  {
    name: "Fixture Row 4",
    email: "metrics-test-4@example.com",
    phone: null,
    meetingDate: new Date("2026-01-05T12:00:00Z"),
    assignedSeller: "Puma",
    closed: true,
    transcript: "fixture",
    industry: "Tecnología",
    companySize: "SMB",
    mainPainPoint: "Volumen Repetitivo",
    keyObjection: "Ninguna",
    purchaseTimeline: "Medio",
    buyingSignal: "Muy Interesado",
    decisionMakerRole: "Fundador",
    sentiment: "Positivo",
    classificationStatus: "classified",
  },
  {
    name: "Fixture Row 5",
    email: "metrics-test-5@example.com",
    phone: null,
    meetingDate: new Date("2026-01-06T12:00:00Z"),
    assignedSeller: "Puma",
    closed: false,
    transcript: "fixture",
    industry: "Tecnología",
    companySize: "SMB",
    mainPainPoint: "Integración",
    keyObjection: "Integración",
    purchaseTimeline: "Largo",
    buyingSignal: "Dudoso",
    decisionMakerRole: "Fundador",
    sentiment: "Negativo",
    classificationStatus: "classified",
  },
  {
    name: "Fixture Row 6",
    email: "metrics-test-6@example.com",
    phone: null,
    meetingDate: new Date("2026-01-07T12:00:00Z"),
    assignedSeller: "Puma",
    closed: true,
    transcript: "fixture",
    industry: "Retail",
    companySize: "Enterprise",
    mainPainPoint: "Volumen Repetitivo",
    keyObjection: "Ninguna",
    purchaseTimeline: "Medio",
    buyingSignal: "Muy Interesado",
    decisionMakerRole: "Gerente",
    // sentiment deliberately NULL to test dimension null-skip behaviour.
    sentiment: null,
    classificationStatus: "classified",
  },
  {
    name: "Fixture Row 7",
    email: "metrics-test-7@example.com",
    phone: null,
    meetingDate: new Date("2026-01-08T12:00:00Z"),
    assignedSeller: "Puma",
    closed: false,
    transcript: "fixture",
    industry: "Retail",
    companySize: "Enterprise",
    mainPainPoint: "Costos",
    keyObjection: "Precio",
    purchaseTimeline: "Largo",
    buyingSignal: "Dudoso",
    decisionMakerRole: "Gerente",
    sentiment: "Negativo",
    classificationStatus: "classified",
  },
  {
    name: "Fixture Row 8",
    email: "metrics-test-8@example.com",
    phone: null,
    meetingDate: new Date("2026-01-09T12:00:00Z"),
    assignedSeller: "Lobo",
    closed: false,
    transcript: "fixture",
    industry: "Tecnología",
    companySize: "Mid-market",
    mainPainPoint: "Costos",
    keyObjection: "Precio",
    purchaseTimeline: "Indefinido",
    buyingSignal: "Dudoso",
    decisionMakerRole: "CTO",
    sentiment: "Negativo",
    classificationStatus: "classified",
  },
];

describe.skipIf(!hasDbUrl)("MetricsCalculator (integration)", () => {
  let calc: MetricsCalculator;
  let rawDb: {
    execute: (query: ReturnType<typeof sql>) => Promise<unknown>;
    insert: (table: typeof clients) => {
      values: (rows: readonly NewClient[]) => Promise<unknown>;
    };
  };

  beforeAll(() => {
    const instance = createMetricsCalculator();
    calc = instance;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    rawDb = (instance as any).db;
  });

  beforeEach(async () => {
    await rawDb.execute(
      sql`DELETE FROM ${clients} WHERE ${clients.email} LIKE 'metrics-test-%@example.com'`,
    );
    await rawDb.insert(clients).values(FIXTURE);
  });

  afterAll(async () => {
    await rawDb.execute(
      sql`DELETE FROM ${clients} WHERE ${clients.email} LIKE 'metrics-test-%@example.com'`,
    );
  });

  // The 57 seeded rows may share seller names with the fixture (Toro/Puma).
  // We therefore assert relative DELTAS: compute a baseline with fixture
  // removed, re-insert, compute again, and compare. Specific fixture-local
  // identities (Lobo seller, the exact value-combinations) let us also
  // assert structural shape of the aggregated results.

  it("fixture shape: 8 rows / 4 closed under the metrics-test prefix", async () => {
    // We scope this assertion to the fixture's email prefix rather than
    // going through `calc.kpis()` (which is a global aggregation). Vitest
    // runs test files in parallel, so other DB-touching suites (e.g.
    // `drizzle-client-repository.test.ts`) may insert/delete their own
    // `test-*@example.com` rows between two `kpis()` calls and stomp any
    // delta-based assertion on `totalClients`. Querying by prefix keeps
    // the fixture check deterministic regardless of concurrent writers.
    const totalResult = (await rawDb.execute(
      sql`SELECT count(*)::int AS c FROM ${clients} WHERE ${clients.email} LIKE 'metrics-test-%@example.com'`,
    )) as { rows: Array<{ c: number }> };
    const closedResult = (await rawDb.execute(
      sql`SELECT count(*)::int AS c FROM ${clients} WHERE ${clients.email} LIKE 'metrics-test-%@example.com' AND ${clients.closed} = true`,
    )) as { rows: Array<{ c: number }> };

    expect(totalResult.rows[0]?.c).toBe(8);
    expect(closedResult.rows[0]?.c).toBe(4);
  });

  it("kpis with filter industry='Retail' scoped to fixture sellers", async () => {
    // Retail rows in the fixture: #6 (closed) + #7 (not closed) → 2 rows.
    // We combine with assignedSeller='Puma' to stay fixture-local. Real
    // seeds use different seller/industry combos; we trust fixture
    // uniqueness via the test-metrics email prefix (cleaned up each test).
    const before = await calc.kpis({
      industry: "Retail",
      assignedSeller: "Puma",
    });
    // Fixture Retail+Puma rows are exactly 2 (#6 closed, #7 not). Seeds MAY
    // add Puma+Retail rows too; we therefore assert RELATIVE: the delta
    // from removing fixture rows equals 2 total.
    await rawDb.execute(
      sql`DELETE FROM ${clients} WHERE ${clients.email} LIKE 'metrics-test-%@example.com'`,
    );
    const baseline = await calc.kpis({
      industry: "Retail",
      assignedSeller: "Puma",
    });
    await rawDb.insert(clients).values(FIXTURE);

    expect(before.totalClients - baseline.totalClients).toBe(2);
  });

  it("sellerRanking is sorted by closeRate DESC and covers all sellers", async () => {
    // Scope to Retail+(Puma|non-Puma) won't work for ranking. Instead we
    // assert ordering invariant using a filter only fixture satisfies.
    const ranking = await calc.sellerRanking();
    // Order: each consecutive pair must respect closeRate DESC.
    for (let i = 1; i < ranking.length; i++) {
      expect(ranking[i - 1]!.closeRate).toBeGreaterThanOrEqual(
        ranking[i]!.closeRate,
      );
    }
    // Toro/Puma/Lobo appear. They may or may not be in the top spots
    // depending on seed data, but they MUST appear since fixture is present.
    const sellerNames = ranking.map((r) => r.name);
    expect(sellerNames).toContain("Toro");
    expect(sellerNames).toContain("Puma");
    expect(sellerNames).toContain("Lobo");
  });

  it("sellerRanking with filter companySize='Mid-market' respects scoping", async () => {
    const ranking = await calc.sellerRanking({ companySize: "Mid-market" });
    // Ordering invariant holds in any subset.
    for (let i = 1; i < ranking.length; i++) {
      expect(ranking[i - 1]!.closeRate).toBeGreaterThanOrEqual(
        ranking[i]!.closeRate,
      );
    }
    for (const entry of ranking) {
      expect(entry.totalClients).toBeGreaterThan(0);
      expect(entry.closedCount).toBeLessThanOrEqual(entry.totalClients);
    }
  });

  it("sellerByIndustry returns one cell per (seller, industry) combination", async () => {
    const cells = await calc.sellerByIndustry();
    for (const c of cells) {
      expect(c.industry).not.toBeNull();
      expect(c.total).toBeGreaterThan(0);
      expect(c.closed).toBeLessThanOrEqual(c.total);
      expect(c.closeRate).toBeGreaterThanOrEqual(0);
      expect(c.closeRate).toBeLessThanOrEqual(1);
    }
    // Fixture guarantees cells for (Toro, Tecnología), (Toro, Salud),
    // (Puma, Tecnología), (Puma, Retail), (Lobo, Tecnología).
    const pairs = cells.map((c) => `${c.seller}|${c.industry}`);
    expect(pairs).toContain("Toro|Tecnología");
    expect(pairs).toContain("Toro|Salud");
    expect(pairs).toContain("Puma|Tecnología");
    expect(pairs).toContain("Puma|Retail");
    expect(pairs).toContain("Lobo|Tecnología");
  });

  it("sellerConversion returns rows sorted by totalClients DESC and includes fixture sellers with correct shape", async () => {
    const rows = await calc.sellerConversion();
    // Ordering invariant: totalClients DESC.
    for (let i = 1; i < rows.length; i++) {
      expect(rows[i - 1]!.totalClients).toBeGreaterThanOrEqual(
        rows[i]!.totalClients,
      );
    }
    // Fixture presence.
    const sellers = rows.map((r) => r.seller);
    expect(sellers).toContain("Toro");
    expect(sellers).toContain("Puma");
    expect(sellers).toContain("Lobo");
    // Shape per row.
    for (const r of rows) {
      expect(typeof r.seller).toBe("string");
      expect(typeof r.totalClients).toBe("number");
      expect(typeof r.closedClients).toBe("number");
      expect(typeof r.openClients).toBe("number");
      expect(typeof r.closeRate).toBe("number");
      expect(r.closeRate).toBeGreaterThanOrEqual(0);
      expect(r.closeRate).toBeLessThanOrEqual(1);
    }
  });

  it("sellerConversion respects filter industry (baseline delta)", async () => {
    const before = await calc.sellerConversion({ industry: "Retail" });
    await rawDb.execute(
      sql`DELETE FROM ${clients} WHERE ${clients.email} LIKE 'metrics-test-%@example.com'`,
    );
    const baseline = await calc.sellerConversion({ industry: "Retail" });
    await rawDb.insert(clients).values(FIXTURE);

    // Fixture Retail rows: #6 (Puma, closed), #7 (Puma, open). Delta = 2 total, 1 closed.
    const beforePumaTotal =
      before.find((r) => r.seller === "Puma")?.totalClients ?? 0;
    const baselinePumaTotal =
      baseline.find((r) => r.seller === "Puma")?.totalClients ?? 0;
    expect(beforePumaTotal - baselinePumaTotal).toBe(2);

    const beforePumaClosed =
      before.find((r) => r.seller === "Puma")?.closedClients ?? 0;
    const baselinePumaClosed =
      baseline.find((r) => r.seller === "Puma")?.closedClients ?? 0;
    expect(beforePumaClosed - baselinePumaClosed).toBe(1);
  });

  it("sellerConversion respects filter assignedSeller", async () => {
    const rows = await calc.sellerConversion({ assignedSeller: "Puma" });
    expect(rows.length).toBe(1);
    expect(rows[0]!.seller).toBe("Puma");
    expect(rows[0]!.openClients).toBe(
      rows[0]!.totalClients - rows[0]!.closedClients,
    );
  });

  it("sellerConversion returns [] when filters match 0 rows", async () => {
    const rows = await calc.sellerConversion({
      assignedSeller: "__NO_SUCH_SELLER__",
    });
    expect(rows).toEqual([]);
  });

  it("sellerConversion tie-breaks alphabetically on equal totalClients", async () => {
    const rows = await calc.sellerConversion();
    // Among rows sharing totalClients, names must be ASC.
    for (let i = 1; i < rows.length; i++) {
      const prev = rows[i - 1]!;
      const cur = rows[i]!;
      if (prev.totalClients === cur.totalClients) {
        expect(prev.seller.localeCompare(cur.seller)).toBeLessThanOrEqual(0);
      }
    }
  });

  it("returns empty arrays and null pain point when filters match 0 rows", async () => {
    const impossible = { assignedSeller: "__NO_SUCH_SELLER__" };
    const kpi = await calc.kpis(impossible);
    expect(kpi.totalClients).toBe(0);
    expect(kpi.topPainPoint).toBeNull();

    const ranking = await calc.sellerRanking(impossible);
    expect(ranking).toEqual([]);

    const cells = await calc.sellerByIndustry(impossible);
    expect(cells).toEqual([]);
  });
});
