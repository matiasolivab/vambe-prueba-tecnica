// @vitest-environment node
import { config as loadEnv } from "dotenv";
import { sql } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

loadEnv({ path: ".env.local", override: true });

import type { ClientRepository } from "@/clients/application/client-repository";
import { createDrizzleClientRepository } from "@/clients/infrastructure/drizzle-client-repository";
import { clients, type NewClient } from "@/clients/infrastructure/db/schema";

/**
 * Integration tests for the Drizzle-backed `ClientRepository`.
 *
 * These tests hit a REAL Neon Postgres so we exercise the actual SQL
 * semantics that make upsert interesting (UNIQUE constraint, ON CONFLICT,
 * RETURNING, jsonb round-trip). Mocks would miss those.
 *
 * Cleanup is surgical: every test row uses the `test-*@example.com` prefix
 * and we DELETE by that prefix in `beforeEach`. Seeded/prod rows stay put.
 *
 * Skips gracefully when `DATABASE_URL` is not set (e.g. CI without secrets)
 * via the outer `describe.skipIf`.
 */

const hasDbUrl = Boolean(process.env.DATABASE_URL);

function baseClient(overrides: Partial<NewClient> = {}): NewClient {
  return {
    name: "Test Client",
    email: "test-default@example.com",
    phone: "+56 9 0000 0000",
    meetingDate: new Date("2026-01-01T12:00:00Z"),
    assignedSeller: "Toro",
    closed: false,
    transcript: "hola, gracias por la reunion.",
    ...overrides,
  };
}

describe.skipIf(!hasDbUrl)("DrizzleClientRepository (integration)", () => {
  let repo: ClientRepository;
  // The factory returns a concrete DrizzleClientRepository but we need the
  // raw `db` for the LIKE cleanup. Expose it via the factory-returned
  // instance's private field — safer than re-wiring neon() here and avoids
  // drifting from production config.
  let rawDb: {
    execute: (query: ReturnType<typeof sql>) => Promise<unknown>;
  };

  beforeAll(() => {
    const instance = createDrizzleClientRepository();
    repo = instance;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    rawDb = (instance as any).db;
  });

  beforeEach(async () => {
    await rawDb.execute(
      sql`DELETE FROM ${clients} WHERE ${clients.email} LIKE 'test-%@example.com'`,
    );
  });

  afterAll(async () => {
    // neon-http is stateless HTTP; no explicit close needed.
    await rawDb.execute(
      sql`DELETE FROM ${clients} WHERE ${clients.email} LIKE 'test-%@example.com'`,
    );
  });

  it("inserts a new client and returns the full row", async () => {
    const input = baseClient({ email: "test-new@example.com", name: "Ada" });

    const row = await repo.upsertByEmail(input);

    expect(row.id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
    );
    expect(row.email).toBe(input.email);
    expect(row.name).toBe("Ada");
    expect(row.assignedSeller).toBe("Toro");
    expect(row.closed).toBe(false);
    expect(row.transcript).toBe(input.transcript);
    // Defaults applied by the DB for an insert without classification data.
    expect(row.classificationStatus).toBe("pending");
    expect(row.truncated).toBe(false);
    expect(row.warnings).toEqual([]);
    expect(row.industry).toBeNull();
    expect(row.sentiment).toBeNull();
    expect(row.createdAt).toBeInstanceOf(Date);
    expect(row.updatedAt).toBeInstanceOf(Date);
  });

  it("updates an existing client on upsert and keeps row count at 1", async () => {
    const email = "test-upsert@example.com";
    await repo.upsertByEmail(baseClient({ email, name: "First Name" }));

    const updated = await repo.upsertByEmail(
      baseClient({
        email,
        name: "Second Name",
        transcript: "Updated transcript content.",
        industry: "Retail",
      }),
    );

    expect(updated.name).toBe("Second Name");
    expect(updated.transcript).toBe("Updated transcript content.");
    expect(updated.industry).toBe("Retail");

    // Only one row with that email should exist.
    const countAfter = await repo.count();
    const again = await repo.findByEmail(email);
    expect(again).not.toBeNull();
    // count() is a sanity check; surgical assertion below is the real guard.
    expect(countAfter).toBeGreaterThanOrEqual(1);

    const duplicates = await rawDb.execute(
      sql`SELECT count(*)::int AS c FROM ${clients} WHERE ${clients.email} = ${email}`,
    );
    // drizzle-orm returns a driver-native result object; neon-http shape is
    // { rows: [{ c: 1 }] }. Cast narrowly for the assertion only.
    const rows = (duplicates as { rows: Array<{ c: number }> }).rows;
    expect(rows[0]?.c).toBe(1);
  });

  it("findByEmail returns the inserted row", async () => {
    const email = "test-find@example.com";
    const inserted = await repo.upsertByEmail(
      baseClient({ email, name: "Findable" }),
    );

    const found = await repo.findByEmail(email);

    expect(found).not.toBeNull();
    expect(found?.id).toBe(inserted.id);
    expect(found?.name).toBe("Findable");
  });

  it("findByEmail returns null for a missing email", async () => {
    const found = await repo.findByEmail("test-nonexistent@example.com");
    expect(found).toBeNull();
  });

  it("count() returns a non-negative integer", async () => {
    const n = await repo.count();
    expect(Number.isInteger(n)).toBe(true);
    expect(n).toBeGreaterThanOrEqual(0);
  });

  it("upsert preserves id and createdAt on update, advances updatedAt", async () => {
    const email = "test-stable-id@example.com";
    const first = await repo.upsertByEmail(baseClient({ email }));

    // Small delay so updatedAt is measurably greater (now() resolution).
    await new Promise((resolve) => setTimeout(resolve, 50));

    const second = await repo.upsertByEmail(
      baseClient({ email, name: "Second Pass" }),
    );

    expect(second.id).toBe(first.id);
    expect(second.createdAt.getTime()).toBe(first.createdAt.getTime());
    expect(second.updatedAt.getTime()).toBeGreaterThan(
      first.updatedAt.getTime(),
    );
  });

  it("findAll() with no filters returns every test row ordered by createdAt DESC", async () => {
    // Insert 3 test fixtures with staggered createdAt via explicit ordering
    // (upsert order defines DB createdAt since we let the DB apply defaultNow()).
    await repo.upsertByEmail(baseClient({ email: "test-findall-a@example.com", name: "Alpha" }));
    // Small delay ensures timestamps are strictly ordered even when now() has
    // millisecond resolution collisions.
    await new Promise((resolve) => setTimeout(resolve, 50));
    await repo.upsertByEmail(baseClient({ email: "test-findall-b@example.com", name: "Bravo" }));
    await new Promise((resolve) => setTimeout(resolve, 50));
    await repo.upsertByEmail(baseClient({ email: "test-findall-c@example.com", name: "Charlie" }));
    const all = await repo.findAll();
    const mine = all.filter((r) => r.email.startsWith("test-findall-"));
    expect(mine.map((r) => r.email)).toEqual([
      "test-findall-c@example.com",
      "test-findall-b@example.com",
      "test-findall-a@example.com",
    ]);
  });

  it("findAll({ search }) matches substring on name OR email (case-insensitive)", async () => {
    await repo.upsertByEmail(
      baseClient({ email: "test-search-match@example.com", name: "Ada Lovelace" }),
    );
    await repo.upsertByEmail(
      baseClient({ email: "test-search-other@example.com", name: "Grace Hopper" }),
    );
    await repo.upsertByEmail(
      baseClient({ email: "test-search-ADA-2@example.com", name: "Unrelated" }),
    );
    // Matches via email substring (the third row) and via name substring (the
    // first row). Case-insensitive — lowercase query hits uppercase ADA.
    const rows = await repo.findAll({ search: "ada" });
    const emails = rows.map((r) => r.email);
    expect(emails).toContain("test-search-match@example.com");
    expect(emails).toContain("test-search-ADA-2@example.com");
    expect(emails).not.toContain("test-search-other@example.com");
  });

  it("findAll({ closed: true }) returns only closed rows", async () => {
    await repo.upsertByEmail(
      baseClient({ email: "test-closed-yes@example.com", closed: true }),
    );
    await repo.upsertByEmail(
      baseClient({ email: "test-closed-no@example.com", closed: false }),
    );
    const rows = await repo.findAll({ closed: true });
    const mine = rows.filter((r) => r.email.startsWith("test-closed-"));
    expect(mine.every((r) => r.closed === true)).toBe(true);
    expect(mine.map((r) => r.email)).toContain("test-closed-yes@example.com");
    expect(mine.map((r) => r.email)).not.toContain("test-closed-no@example.com");
  });

  it("findAll({ assignedSeller, industry, closed }) ANDs filters together", async () => {
    await repo.upsertByEmail(
      baseClient({
        email: "test-and-match@example.com",
        assignedSeller: "Vera",
        industry: "Retail",
        closed: true,
      }),
    );
    await repo.upsertByEmail(
      baseClient({
        email: "test-and-miss-seller@example.com",
        assignedSeller: "Otro",
        industry: "Retail",
        closed: true,
      }),
    );
    await repo.upsertByEmail(
      baseClient({
        email: "test-and-miss-industry@example.com",
        assignedSeller: "Vera",
        industry: "SaaS",
        closed: true,
      }),
    );
    await repo.upsertByEmail(
      baseClient({
        email: "test-and-miss-closed@example.com",
        assignedSeller: "Vera",
        industry: "Retail",
        closed: false,
      }),
    );
    const rows = await repo.findAll({
      assignedSeller: "Vera",
      industry: "Retail",
      closed: true,
    });
    const emails = rows.map((r) => r.email);
    expect(emails).toContain("test-and-match@example.com");
    expect(emails).not.toContain("test-and-miss-seller@example.com");
    expect(emails).not.toContain("test-and-miss-industry@example.com");
    expect(emails).not.toContain("test-and-miss-closed@example.com");
  });

  it("upsert persists a full classification payload with jsonb warnings", async () => {
    const email = "test-full@example.com";
    const full: NewClient = baseClient({
      email,
      name: "Full Payload",
      industry: "SaaS",
      companySize: "Mid-market",
      mainPainPoint: "Volumen Repetitivo",
      keyObjection: "Precio",
      purchaseTimeline: "Corto",
      buyingSignal: "Muy Interesado",
      decisionMakerRole: "CEO",
      sentiment: "Positivo",
      needsSummary: "Necesita automatizar respuestas de soporte.",
      nextSteps: "Enviar propuesta comercial el lunes.",
      reasoning: "Transcript explícito sobre urgencia y presupuesto.",
      promptVersion: "1.3.0",
      modelVersion: "gpt-4o-mini-2024-07-18",
      truncated: false,
      classificationStatus: "ok",
      errorMessage: null,
      warnings: [
        { name: "timeline-signal-mismatch", severity: "warning", message: "ok" },
      ],
    });

    const saved = await repo.upsertByEmail(full);

    expect(saved.industry).toBe("SaaS");
    expect(saved.purchaseTimeline).toBe("Corto");
    expect(saved.sentiment).toBe("Positivo");
    expect(saved.classificationStatus).toBe("ok");
    expect(saved.promptVersion).toBe("1.3.0");
    expect(saved.modelVersion).toBe("gpt-4o-mini-2024-07-18");
    expect(saved.warnings).toEqual([
      { name: "timeline-signal-mismatch", severity: "warning", message: "ok" },
    ]);

    const roundTrip = await repo.findByEmail(email);
    expect(roundTrip?.warnings).toEqual(saved.warnings);
  });

  it("upsert preserves special characters in warnings jsonb round-trip", async () => {
    const email = "test-unicode@example.com";
    const warnings = [
      {
        name: "quote-handling",
        severity: "warning",
        message: 'Timeline "urgente" vs objection — conflicto',
      },
    ];

    const saved = await repo.upsertByEmail(
      baseClient({ email, warnings }),
    );
    expect(saved.warnings).toEqual(warnings);

    const fetched = await repo.findByEmail(email);
    expect(fetched?.warnings).toEqual(warnings);
  });
});
