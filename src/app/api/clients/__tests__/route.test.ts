// @vitest-environment node
import { config as loadEnv } from "dotenv";
import { sql } from "drizzle-orm";
import { NextRequest } from "next/server";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

loadEnv({ path: ".env.local", override: true });

import { GET } from "@/app/api/clients/route";
import { createDrizzleClientRepository } from "@/clients/infrastructure/drizzle-client-repository";
import { clients, type NewClient } from "@/clients/infrastructure/db/schema";

const hasDbUrl = Boolean(process.env.DATABASE_URL);

function baseClient(overrides: Partial<NewClient> = {}): NewClient {
  return {
    name: "API Test Client",
    email: "api-clients-test-default@example.com",
    phone: "+56 9 0000 0000",
    meetingDate: new Date("2026-01-01T12:00:00Z"),
    assignedSeller: "Toro",
    closed: false,
    transcript: "fixture transcript",
    ...overrides,
  };
}

describe.skipIf(!hasDbUrl)("GET /api/clients (integration)", () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let rawDb: any;

  beforeAll(() => {
    const instance = createDrizzleClientRepository();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    rawDb = (instance as any).db;
  });

  beforeEach(async () => {
    await rawDb.execute(
      sql`DELETE FROM ${clients} WHERE ${clients.email} LIKE 'api-clients-test-%@example.com'`,
    );
  });

  afterAll(async () => {
    await rawDb.execute(
      sql`DELETE FROM ${clients} WHERE ${clients.email} LIKE 'api-clients-test-%@example.com'`,
    );
  });

  async function insert(input: Partial<NewClient>): Promise<void> {
    const repo = createDrizzleClientRepository();
    await repo.upsertByEmail(baseClient(input));
  }

  it("returns 200 and a { clients, total } payload with no filters", async () => {
    await insert({ email: "api-clients-test-any@example.com" });
    const req = new NextRequest("http://localhost/api/clients");

    const res = await GET(req);

    expect(res.status).toBe(200);
    const body = (await res.json()) as { clients: unknown[]; total: number };
    expect(Array.isArray(body.clients)).toBe(true);
    expect(typeof body.total).toBe("number");
    expect(body.total).toBe(body.clients.length);
    const emails = body.clients.map((c) => (c as { email: string }).email);
    expect(emails).toContain("api-clients-test-any@example.com");
  });

  it("filters by ?search substring (case-insensitive on name OR email)", async () => {
    await insert({
      email: "api-clients-test-search-hit@example.com",
      name: "Alice",
    });
    await insert({
      email: "api-clients-test-search-miss@example.com",
      name: "Bob",
    });

    const req = new NextRequest(
      "http://localhost/api/clients?search=api-clients-test-search-hit",
    );
    const res = await GET(req);

    expect(res.status).toBe(200);
    const body = (await res.json()) as { clients: Array<{ email: string }> };
    const emails = body.clients.map((c) => c.email);
    expect(emails).toContain("api-clients-test-search-hit@example.com");
    expect(emails).not.toContain("api-clients-test-search-miss@example.com");
  });

  it("filters by ?closed=true", async () => {
    await insert({
      email: "api-clients-test-closed-yes@example.com",
      closed: true,
    });
    await insert({
      email: "api-clients-test-closed-no@example.com",
      closed: false,
    });

    const req = new NextRequest("http://localhost/api/clients?closed=true");
    const res = await GET(req);

    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      clients: Array<{ email: string; closed: boolean }>;
    };
    const mine = body.clients.filter((c) =>
      c.email.startsWith("api-clients-test-closed-"),
    );
    expect(mine.every((c) => c.closed === true)).toBe(true);
    expect(mine.map((c) => c.email)).toContain(
      "api-clients-test-closed-yes@example.com",
    );
    expect(mine.map((c) => c.email)).not.toContain(
      "api-clients-test-closed-no@example.com",
    );
  });

  it("ignores malformed ?closed values (treats as unset)", async () => {
    await insert({
      email: "api-clients-test-malformed-1@example.com",
      closed: true,
    });
    await insert({
      email: "api-clients-test-malformed-2@example.com",
      closed: false,
    });

    const req = new NextRequest("http://localhost/api/clients?closed=not-a-bool");
    const res = await GET(req);

    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      clients: Array<{ email: string; closed: boolean }>;
    };
    const emails = body.clients.map((c) => c.email);
    expect(emails).toContain("api-clients-test-malformed-1@example.com");
    expect(emails).toContain("api-clients-test-malformed-2@example.com");
  });
});
