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
  createTemporalMetrics,
  type TemporalMetrics,
} from "@/analytics/application/temporal-metrics";
import { clients, type NewClient } from "@/clients/infrastructure/db/schema";

const hasDbUrl = Boolean(process.env.DATABASE_URL);

const FIXTURE: readonly NewClient[] = [
  {
    name: "T1",
    email: "temporal-test-1@example.com",
    phone: null,
    meetingDate: new Date("2026-04-05T12:00:00Z"),
    assignedSeller: "Ana",
    closed: true,
    transcript: "fixture",
    industry: "Tecnología",
    companySize: "SMB",
    mainPainPoint: null,
    keyObjection: "Ninguna",
    leadSource: null,
    sentiment: null,
    classificationStatus: "classified",
  },
  {
    name: "T2",
    email: "temporal-test-2@example.com",
    phone: null,
    meetingDate: new Date("2026-04-10T12:00:00Z"),
    assignedSeller: "Ana",
    closed: true,
    transcript: "fixture",
    industry: "Tecnología",
    companySize: "SMB",
    mainPainPoint: null,
    keyObjection: "Ninguna",
    leadSource: null,
    sentiment: null,
    classificationStatus: "classified",
  },
  {
    name: "T3",
    email: "temporal-test-3@example.com",
    phone: null,
    meetingDate: new Date("2026-04-15T12:00:00Z"),
    assignedSeller: "Ana",
    closed: false,
    transcript: "fixture",
    industry: "Retail",
    companySize: "SMB",
    mainPainPoint: null,
    keyObjection: "Precio",
    leadSource: null,
    sentiment: null,
    classificationStatus: "classified",
  },
  {
    name: "T4",
    email: "temporal-test-4@example.com",
    phone: null,
    meetingDate: new Date("2026-04-18T12:00:00Z"),
    assignedSeller: "Bruno",
    closed: true,
    transcript: "fixture",
    industry: "Tecnología",
    companySize: "SMB",
    mainPainPoint: null,
    keyObjection: "Ninguna",
    leadSource: null,
    sentiment: null,
    classificationStatus: "classified",
  },
  {
    name: "T5",
    email: "temporal-test-5@example.com",
    phone: null,
    meetingDate: new Date("2026-04-19T12:00:00Z"),
    assignedSeller: "Bruno",
    closed: false,
    transcript: "fixture",
    industry: "Tecnología",
    companySize: "SMB",
    mainPainPoint: null,
    keyObjection: "Precio",
    leadSource: null,
    sentiment: null,
    classificationStatus: "classified",
  },
  {
    name: "T6",
    email: "temporal-test-6@example.com",
    phone: null,
    meetingDate: new Date("2026-04-20T12:00:00Z"),
    assignedSeller: "Bruno",
    closed: false,
    transcript: "fixture",
    industry: "Tecnología",
    companySize: "SMB",
    mainPainPoint: null,
    keyObjection: "Precio",
    leadSource: null,
    sentiment: null,
    classificationStatus: "classified",
  },
  {
    name: "T7",
    email: "temporal-test-7@example.com",
    phone: null,
    meetingDate: new Date("2026-04-21T12:00:00Z"),
    assignedSeller: "Bruno",
    closed: false,
    transcript: "fixture",
    industry: "Tecnología",
    companySize: "SMB",
    mainPainPoint: null,
    keyObjection: "Precio",
    leadSource: null,
    sentiment: null,
    classificationStatus: "classified",
  },
  {
    name: "T8",
    email: "temporal-test-8@example.com",
    phone: null,
    meetingDate: new Date("2026-03-20T12:00:00Z"),
    assignedSeller: "Ana",
    closed: true,
    transcript: "fixture",
    industry: "Tecnología",
    companySize: "SMB",
    mainPainPoint: null,
    keyObjection: "Ninguna",
    leadSource: null,
    sentiment: null,
    classificationStatus: "classified",
  },
  {
    name: "T9",
    email: "temporal-test-9@example.com",
    phone: null,
    meetingDate: new Date("2026-03-22T12:00:00Z"),
    assignedSeller: "Bruno",
    closed: false,
    transcript: "fixture",
    industry: "Retail",
    companySize: "SMB",
    mainPainPoint: null,
    keyObjection: "Precio",
    leadSource: null,
    sentiment: null,
    classificationStatus: "classified",
  },
  {
    name: "T10",
    email: "temporal-test-10@example.com",
    phone: null,
    meetingDate: new Date("2026-01-12T12:00:00Z"),
    assignedSeller: "Ana",
    closed: false,
    transcript: "fixture",
    industry: "Tecnología",
    companySize: "SMB",
    mainPainPoint: null,
    keyObjection: "Precio",
    leadSource: null,
    sentiment: null,
    classificationStatus: "classified",
  },
  {
    name: "T11",
    email: "temporal-test-11@example.com",
    phone: null,
    meetingDate: new Date("2025-05-18T12:00:00Z"),
    assignedSeller: "Ana",
    closed: true,
    transcript: "fixture",
    industry: "Tecnología",
    companySize: "SMB",
    mainPainPoint: null,
    keyObjection: "Ninguna",
    leadSource: null,
    sentiment: null,
    classificationStatus: "classified",
  },
  {
    name: "T12",
    email: "temporal-test-12@example.com",
    phone: null,
    meetingDate: new Date("2025-04-15T12:00:00Z"),
    assignedSeller: "Ana",
    closed: false,
    transcript: "fixture",
    industry: "Tecnología",
    companySize: "SMB",
    mainPainPoint: null,
    keyObjection: "Precio",
    leadSource: null,
    sentiment: null,
    classificationStatus: "classified",
  },
];

const FIXTURE_PREFIX = "temporal-test-%@example.com";

async function deleteFixture(rawDb: {
  execute: (query: ReturnType<typeof sql>) => Promise<unknown>;
}): Promise<void> {
  await rawDb.execute(
    sql`DELETE FROM ${clients} WHERE ${clients.email} LIKE ${FIXTURE_PREFIX}`,
  );
}

describe.skipIf(!hasDbUrl)("TemporalMetrics (integration)", () => {
  let temporal: TemporalMetrics;
  let rawDb: {
    execute: (query: ReturnType<typeof sql>) => Promise<unknown>;
    insert: (table: typeof clients) => {
      values: (rows: readonly NewClient[]) => Promise<unknown>;
    };
  };

  beforeAll(() => {
    const instance = createTemporalMetrics();
    temporal = instance;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    rawDb = (instance as any).db;
  });

  beforeEach(async () => {
    await deleteFixture(rawDb);
    await rawDb.insert(clients).values(FIXTURE);
  });

  afterAll(async () => {
    await deleteFixture(rawDb);
  });

  describe("clientsByMonth", () => {
    it("returns exactly 12 rows ordered ascending when data exists", async () => {
      const series = await temporal.clientsByMonth({ assignedSeller: "Ana" });
      expect(series).toHaveLength(12);
      const months = series.map((p) => p.yearMonth);
      const sorted = [...months].sort();
      expect(months).toEqual(sorted);
    });

    it("anchors the last bucket to MAX(meetingDate) = 2026-04 and oldest to 2025-05", async () => {
      const series = await temporal.clientsByMonth({ assignedSeller: "Ana" });
      expect(series[0]?.yearMonth).toBe("2025-05");
      expect(series[series.length - 1]?.yearMonth).toBe("2026-04");
    });

    it("fills gap months with { closed: 0, open: 0 }", async () => {
      const series = await temporal.clientsByMonth({ assignedSeller: "Ana" });
      const empty = series.filter(
        (p) =>
          p.yearMonth !== "2025-05" &&
          p.yearMonth !== "2026-01" &&
          p.yearMonth !== "2026-03" &&
          p.yearMonth !== "2026-04",
      );
      for (const p of empty) {
        expect(p.closed).toBe(0);
        expect(p.open).toBe(0);
      }
    });

    it("counts closed and open separately per month for a single seller", async () => {
      const series = await temporal.clientsByMonth({ assignedSeller: "Ana" });
      const byMonth = new Map(series.map((p) => [p.yearMonth, p]));
      expect(byMonth.get("2026-04")).toEqual({
        yearMonth: "2026-04",
        closed: 2,
        open: 1,
      });
      expect(byMonth.get("2026-03")).toEqual({
        yearMonth: "2026-03",
        closed: 1,
        open: 0,
      });
      expect(byMonth.get("2026-01")).toEqual({
        yearMonth: "2026-01",
        closed: 0,
        open: 1,
      });
      expect(byMonth.get("2025-05")).toEqual({
        yearMonth: "2025-05",
        closed: 1,
        open: 0,
      });
    });

    it("returns [] when the filtered dataset is empty (no MAX(meetingDate))", async () => {
      const series = await temporal.clientsByMonth({
        assignedSeller: "__NO_SUCH_SELLER__",
      });
      expect(series).toEqual([]);
    });

    it("ignores filters.closed — both series populated regardless", async () => {
      const filteredClosed = await temporal.clientsByMonth({
        assignedSeller: "Ana",
        closed: true,
      });
      const unfiltered = await temporal.clientsByMonth({
        assignedSeller: "Ana",
      });
      expect(filteredClosed).toEqual(unfiltered);
    });

    it("respects filters.industry (Retail narrows Ana to one open row in 2026-04)", async () => {
      const series = await temporal.clientsByMonth({
        assignedSeller: "Ana",
        industry: "Retail",
      });
      const byMonth = new Map(series.map((p) => [p.yearMonth, p]));
      expect(byMonth.get("2026-04")).toEqual({
        yearMonth: "2026-04",
        closed: 0,
        open: 1,
      });
      expect(byMonth.get("2026-03")).toEqual({
        yearMonth: "2026-03",
        closed: 0,
        open: 0,
      });
    });
  });

  describe("clientCountMoM", () => {
    it("returns positive delta percent when current > previous", async () => {
      const result = await temporal.clientCountMoM({ assignedSeller: "Ana" });
      expect(result.current).toBe(3);
      expect(result.previous).toBe(1);
      expect(result.deltaPct).toBe(200);
      expect(result.referenceYearMonth).toBe("2026-04");
    });

    it("rounds delta percent to one decimal", async () => {
      const result = await temporal.clientCountMoM({
        assignedSeller: "Bruno",
      });
      expect(result.deltaPct).toBe(300);
    });

    it("returns null deltaPct when previous is 0 and current > 0 (no base to divide)", async () => {
      const result = await temporal.clientCountMoM({
        assignedSeller: "Ana",
        industry: "Retail",
      });
      expect(result.current).toBe(1);
      expect(result.previous).toBe(0);
      expect(result.deltaPct).toBeNull();
      expect(result.referenceYearMonth).toBe("2026-04");
    });

    it("returns sentinel values for an empty filtered dataset", async () => {
      const result = await temporal.clientCountMoM({
        assignedSeller: "__NO_SUCH_SELLER__",
      });
      expect(result.current).toBe(0);
      expect(result.previous).toBe(0);
      expect(result.deltaPct).toBeNull();
      expect(result.referenceYearMonth).toBe("");
    });

    it("respects filters.closed (unlike clientsByMonth)", async () => {
      const result = await temporal.clientCountMoM({
        assignedSeller: "Ana",
        closed: true,
      });
      expect(result.current).toBe(2);
      expect(result.previous).toBe(1);
      expect(result.deltaPct).toBe(100);
    });

    it("respects filters.industry", async () => {
      const result = await temporal.clientCountMoM({
        assignedSeller: "Ana",
        industry: "Tecnología",
      });
      expect(result.current).toBe(2);
      expect(result.previous).toBe(1);
      expect(result.deltaPct).toBe(100);
    });

    it("returns 0 deltaPct when current and previous are both 0 but data exists earlier", async () => {
      const result = await temporal.clientCountMoM({
        assignedSeller: "Bruno",
        industry: "Retail",
      });
      expect(result.referenceYearMonth).toBe("2026-03");
      expect(result.current).toBe(1);
      expect(result.previous).toBe(0);
      expect(result.deltaPct).toBeNull();
    });
  });

  describe("topSellerByMonth", () => {
    it("returns the seller with most closed rows in the anchor month", async () => {
      const top = await temporal.topSellerByMonth();
      const scoped = await temporal.topSellerByMonth({});
      expect(scoped).not.toBeNull();
      const fixtureScoped = await temporal.topSellerByMonth({
        industry: "Tecnología",
      });
      expect(fixtureScoped?.name).toBe("Ana");
      expect(fixtureScoped?.closedInMonth).toBe(2);
      expect(fixtureScoped?.totalInMonth).toBe(2);
      expect(fixtureScoped?.closeRateInMonth).toBeCloseTo(1, 3);
      expect(fixtureScoped?.yearMonth).toBe("2026-04");
      expect(top).not.toBeUndefined();
    });

    it("breaks ties on closedInMonth by closeRateInMonth (desc)", async () => {
      const top = await temporal.topSellerByMonth({
        industry: "Tecnología",
        companySize: "SMB",
      });
      expect(top?.name).toBe("Ana");
    });

    it("returns null when the anchor month has no closed rows (HAVING filter)", async () => {
      const top = await temporal.topSellerByMonth({
        assignedSeller: "Ana",
        industry: "Retail",
      });
      expect(top).toBeNull();
    });

    it("returns null for an empty filtered dataset", async () => {
      const top = await temporal.topSellerByMonth({
        assignedSeller: "__NO_SUCH_SELLER__",
      });
      expect(top).toBeNull();
    });

    it("respects filters.industry", async () => {
      const top = await temporal.topSellerByMonth({ industry: "Tecnología" });
      expect(top?.name).toBe("Ana");
    });

    it("ignores filters.closed (passing closed:false does not erase the ranking)", async () => {
      const withFalse = await temporal.topSellerByMonth({ industry: "Tecnología", closed: false });
      const withoutFilter = await temporal.topSellerByMonth({ industry: "Tecnología" });
      expect(withFalse).toEqual(withoutFilter);
    });
  });
});
