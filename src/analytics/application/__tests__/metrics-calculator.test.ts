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

const hasDbUrl = Boolean(process.env.DATABASE_URL);

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
    leadSource: "Recomendación",
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
    leadSource: "Recomendación",
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
    leadSource: "No Mencionado",
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
    leadSource: "Recomendación",
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
    leadSource: "No Mencionado",
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
    leadSource: "Recomendación",
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
    leadSource: "No Mencionado",
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
    leadSource: "No Mencionado",
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

  it("fixture shape: 8 rows / 4 closed under the metrics-test prefix", async () => {
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
    const before = await calc.kpis({
      industry: "Retail",
      assignedSeller: "Puma",
    });
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
    const ranking = await calc.sellerRanking();
    for (let i = 1; i < ranking.length; i++) {
      expect(ranking[i - 1]!.closeRate).toBeGreaterThanOrEqual(
        ranking[i]!.closeRate,
      );
    }
    const sellerNames = ranking.map((r) => r.name);
    expect(sellerNames).toContain("Toro");
    expect(sellerNames).toContain("Puma");
    expect(sellerNames).toContain("Lobo");
  });

  it("sellerRanking with filter companySize='Mid-market' respects scoping", async () => {
    const ranking = await calc.sellerRanking({ companySize: "Mid-market" });
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
    const pairs = cells.map((c) => `${c.seller}|${c.industry}`);
    expect(pairs).toContain("Toro|Tecnología");
    expect(pairs).toContain("Toro|Salud");
    expect(pairs).toContain("Puma|Tecnología");
    expect(pairs).toContain("Puma|Retail");
    expect(pairs).toContain("Lobo|Tecnología");
  });

  it("sellerConversion returns rows sorted by totalClients DESC and includes fixture sellers with correct shape", async () => {
    const rows = await calc.sellerConversion();
    for (let i = 1; i < rows.length; i++) {
      expect(rows[i - 1]!.totalClients).toBeGreaterThanOrEqual(
        rows[i]!.totalClients,
      );
    }
    const sellers = rows.map((r) => r.seller);
    expect(sellers).toContain("Toro");
    expect(sellers).toContain("Puma");
    expect(sellers).toContain("Lobo");
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
    for (let i = 1; i < rows.length; i++) {
      const prev = rows[i - 1]!;
      const cur = rows[i]!;
      if (prev.totalClients === cur.totalClients) {
        expect(prev.seller.localeCompare(cur.seller)).toBeLessThanOrEqual(0);
      }
    }
  });

  it("sellerConversion computes closeRate edge cases correctly", async () => {
    const all = await calc.sellerConversion();
    const lobo = all.find((r) => r.seller === "Lobo");
    expect(lobo).toBeDefined();
    if (lobo) {
      expect(lobo.closeRate).toBeGreaterThanOrEqual(0);
      expect(lobo.closeRate).toBeLessThanOrEqual(1);
      expect(lobo.openClients).toBe(lobo.totalClients - lobo.closedClients);
      if (lobo.totalClients > 0) {
        expect(lobo.closeRate).toBeCloseTo(
          lobo.closedClients / lobo.totalClients,
          5,
        );
      }
    }
  });

  it("sellerConversion honors filters.closed when explicitly provided", async () => {
    const rows = await calc.sellerConversion({ closed: true });
    for (const r of rows) {
      expect(r.openClients).toBe(0);
      expect(r.totalClients).toBe(r.closedClients);
      expect(r.closeRate).toBe(1);
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

  describe("painPointCounts", () => {
    it("returns pain points sorted DESC by count, tiebreak alphabetical", async () => {
      const results = await calc.painPointCounts();
      await rawDb.execute(
        sql`DELETE FROM ${clients} WHERE ${clients.email} LIKE 'metrics-test-%@example.com'`,
      );
      const baseline = await calc.painPointCounts();
      await rawDb.insert(clients).values(FIXTURE);

      const before = results.find((r) => r.painPoint === "Volumen Repetitivo");
      const after = baseline.find((r) => r.painPoint === "Volumen Repetitivo");
      expect((before?.count ?? 0) - (after?.count ?? 0)).toBe(4);

      for (let i = 1; i < results.length; i++) {
        expect(results[i - 1]!.count).toBeGreaterThanOrEqual(results[i]!.count);
      }
    });

    it("excludes rows where mainPainPoint IS NULL", async () => {
      await rawDb.insert(clients).values([
        {
          name: "Null Pain Test",
          email: "metrics-test-null-pain@example.com",
          phone: null,
          meetingDate: new Date("2026-01-10T12:00:00Z"),
          assignedSeller: "Toro",
          closed: false,
          transcript: "fixture",
          industry: "Tecnología",
          companySize: "Mid-market",
          mainPainPoint: null,
          keyObjection: "Precio",
          leadSource: null,
          sentiment: null,
          classificationStatus: "classified",
        },
      ]);
      const results = await calc.painPointCounts();
      expect(results.every((r) => r.painPoint !== null)).toBe(true);
    });

    it("returns [] when no rows match the filter", async () => {
      const results = await calc.painPointCounts({
        assignedSeller: "__NO_SUCH_SELLER__",
      });
      expect(results).toEqual([]);
    });
  });

  describe("companySizeDistribution", () => {
    it("returns sizes sorted DESC by count, tiebreak alphabetical", async () => {
      const results = await calc.companySizeDistribution();

      for (let i = 1; i < results.length; i++) {
        expect(results[i - 1]!.count).toBeGreaterThanOrEqual(results[i]!.count);
      }

      await rawDb.execute(
        sql`DELETE FROM ${clients} WHERE ${clients.email} LIKE 'metrics-test-%@example.com'`,
      );
      const baseline = await calc.companySizeDistribution();
      await rawDb.insert(clients).values(FIXTURE);

      const beforeMid = results.find((r) => r.companySize === "Mid-market");
      const afterMid = baseline.find((r) => r.companySize === "Mid-market");
      expect((beforeMid?.count ?? 0) - (afterMid?.count ?? 0)).toBe(3);
    });

    it("excludes rows where companySize IS NULL", async () => {
      await rawDb.insert(clients).values([
        {
          name: "Null Size Test",
          email: "metrics-test-null-size@example.com",
          phone: null,
          meetingDate: new Date("2026-01-10T12:00:00Z"),
          assignedSeller: "Toro",
          closed: false,
          transcript: "fixture",
          industry: "Tecnología",
          companySize: null,
          mainPainPoint: "Costos",
          keyObjection: "Precio",
          leadSource: null,
          sentiment: null,
          classificationStatus: "classified",
        },
      ]);
      const results = await calc.companySizeDistribution();
      expect(results.every((r) => r.companySize !== null)).toBe(true);
    });

    it("respects assignedSeller filter", async () => {
      const results = await calc.companySizeDistribution({
        assignedSeller: "Puma",
      });
      for (let i = 1; i < results.length; i++) {
        expect(results[i - 1]!.count).toBeGreaterThanOrEqual(results[i]!.count);
      }
      const sizes = results.map((r) => r.companySize);
      expect(sizes).toContain("Enterprise");
      expect(sizes).toContain("SMB");
    });

    it("returns [] when no rows match the filter", async () => {
      const results = await calc.companySizeDistribution({
        assignedSeller: "__NO_SUCH_SELLER__",
      });
      expect(results).toEqual([]);
    });
  });

  describe("topLeadSources", () => {
    it("returns top 5 by default, ordered DESC by count", async () => {
      const results = await calc.topLeadSources(undefined, 10);
      for (let i = 1; i < results.length; i++) {
        expect(results[i - 1]!.count).toBeGreaterThanOrEqual(results[i]!.count);
      }
      const sources = results.map((r) => r.leadSource);
      expect(sources).toContain("Recomendación");
    });

    it("excludes 'No Mencionado' even when it's the most frequent", async () => {
      const results = await calc.topLeadSources(undefined, 10);
      expect(results.map((r) => r.leadSource)).not.toContain("No Mencionado");
    });

    it("default limit is 5", async () => {
      const results = await calc.topLeadSources();
      expect(results.length).toBeLessThanOrEqual(5);
    });

    it("respects custom limit", async () => {
      const results = await calc.topLeadSources(undefined, 1);
      expect(results.length).toBeLessThanOrEqual(1);
    });

    it("returns [] when no rows match filter", async () => {
      const results = await calc.topLeadSources({
        assignedSeller: "__NO_SUCH_SELLER__",
      });
      expect(results).toEqual([]);
    });
  });

  describe("topIndustries", () => {
    it("returns top 2 by default, excluding Otros", async () => {
      await rawDb.insert(clients).values([
        {
          name: "Otros A",
          email: "metrics-test-otros-a@example.com",
          phone: null,
          meetingDate: new Date("2026-01-11T12:00:00Z"),
          assignedSeller: "Toro",
          closed: false,
          transcript: "fixture",
          industry: "Otros",
          companySize: "Mid-market",
          mainPainPoint: "Costos",
          keyObjection: null,
          leadSource: null,
          sentiment: null,
          classificationStatus: "classified",
        },
        {
          name: "Otros B",
          email: "metrics-test-otros-b@example.com",
          phone: null,
          meetingDate: new Date("2026-01-12T12:00:00Z"),
          assignedSeller: "Toro",
          closed: false,
          transcript: "fixture",
          industry: "Otros",
          companySize: "Mid-market",
          mainPainPoint: "Costos",
          keyObjection: null,
          leadSource: null,
          sentiment: null,
          classificationStatus: "classified",
        },
        {
          name: "Otros C",
          email: "metrics-test-otros-c@example.com",
          phone: null,
          meetingDate: new Date("2026-01-13T12:00:00Z"),
          assignedSeller: "Toro",
          closed: false,
          transcript: "fixture",
          industry: "Otros",
          companySize: "Mid-market",
          mainPainPoint: "Costos",
          keyObjection: null,
          leadSource: null,
          sentiment: null,
          classificationStatus: "classified",
        },
      ]);
      const results = await calc.topIndustries();
      expect(results.length).toBeLessThanOrEqual(2);
      expect(results.map((r) => r.industry)).not.toContain("Otros");
    });

    it("respects custom limit", async () => {
      const results = await calc.topIndustries(undefined, 1);
      expect(results.length).toBeLessThanOrEqual(1);
      expect(results.map((r) => r.industry)).not.toContain("Otros");
    });

    it("sorts DESC by count", async () => {
      const results = await calc.topIndustries(undefined, 10);
      for (let i = 1; i < results.length; i++) {
        expect(results[i - 1]!.count).toBeGreaterThanOrEqual(results[i]!.count);
      }
    });

    it("returns [] when no rows match filter", async () => {
      const results = await calc.topIndustries({
        assignedSeller: "__NO_SUCH_SELLER__",
      });
      expect(results).toEqual([]);
    });
  });
});
