import { describe, it, expect, expectTypeOf } from "vitest";
import { getTableColumns } from "drizzle-orm";
import { getTableConfig } from "drizzle-orm/pg-core";

import { clients, type Client, type NewClient } from "../schema";

describe("clients Drizzle schema", () => {
  it("is named 'clients'", () => {
    expect(getTableConfig(clients).name).toBe("clients");
  });

  it("exposes every PRD §7 column plus traceability + timestamps", () => {
    const cols = getTableColumns(clients);
    const expected = [
      // identity / CSV
      "id",
      "name",
      "email",
      "phone",
      "meetingDate",
      "assignedSeller",
      "closed",
      "transcript",
      // LLM categorical dimensions (§7.1)
      "industry",
      "companySize",
      "mainPainPoint",
      "keyObjection",
      "buyingSignal",
      "sentiment",
      // LLM qualitative (§7.2)
      "needsSummary",
      "nextSteps",
      // LLM traceability (§7.3)
      "reasoning",
      "promptVersion",
      "modelVersion",
      "truncated",
      "classificationStatus",
      "errorMessage",
      "warnings",
      // timestamps
      "createdAt",
      "updatedAt",
    ] as const;

    for (const name of expected) {
      expect(cols, `missing column: ${name}`).toHaveProperty(name);
    }
    // 8 identity/CSV + 6 categorical + 2 qualitative + 7 traceability + 2 timestamps = 25
    expect(Object.keys(cols)).toHaveLength(expected.length);
  });

  it("marks email UNIQUE (natural upsert key per ARCHITECTURE §8)", () => {
    const cols = getTableColumns(clients);
    const cfg = getTableConfig(clients);
    const emailUnique =
      cols.email.isUnique ||
      cfg.uniqueConstraints.some((u) =>
        u.columns.some((c) => c.name === "email")
      );
    expect(emailUnique).toBe(true);
  });

  it("marks required columns NOT NULL", () => {
    const cols = getTableColumns(clients);
    const required = [
      "id",
      "name",
      "email",
      "meetingDate",
      "assignedSeller",
      "closed",
      "transcript",
      "truncated",
      "classificationStatus",
      "warnings",
      "createdAt",
      "updatedAt",
    ] as const;
    for (const key of required) {
      expect(cols[key].notNull, `${key} must be NOT NULL`).toBe(true);
    }
  });

  it("leaves pre-classification + optional columns NULLABLE", () => {
    const cols = getTableColumns(clients);
    const nullable = [
      "phone",
      "industry",
      "companySize",
      "mainPainPoint",
      "keyObjection",
      "buyingSignal",
      "sentiment",
      "needsSummary",
      "nextSteps",
      "reasoning",
      "promptVersion",
      "modelVersion",
      "errorMessage",
    ] as const;
    for (const key of nullable) {
      expect(cols[key].notNull, `${key} must be NULLABLE`).toBe(false);
    }
  });

  it("sets defaults on id, truncated, classificationStatus, warnings, timestamps", () => {
    const cols = getTableColumns(clients);
    for (const key of [
      "id",
      "truncated",
      "classificationStatus",
      "warnings",
      "createdAt",
      "updatedAt",
    ] as const) {
      expect(cols[key].hasDefault, `${key} must have a default`).toBe(true);
    }
  });

  it("uses jsonb for warnings", () => {
    const cols = getTableColumns(clients);
    expect(cols.warnings.columnType).toBe("PgJsonb");
  });

  it("infers a Select type with string email and nullable LLM dimensions", () => {
    expectTypeOf<Client["email"]>().toEqualTypeOf<string>();
    expectTypeOf<Client["industry"]>().toEqualTypeOf<string | null>();
    expectTypeOf<Client["reasoning"]>().toEqualTypeOf<string | null>();
    expectTypeOf<Client["truncated"]>().toEqualTypeOf<boolean>();
    expectTypeOf<Client["meetingDate"]>().toEqualTypeOf<Date>();
  });

  it("infers an Insert type that keeps defaults optional", () => {
    // id / truncated / classificationStatus / warnings / timestamps all have defaults
    // so they must be optional in NewClient.
    const draft: NewClient = {
      name: "Ada Lovelace",
      email: "ada@example.com",
      meetingDate: new Date("2026-04-16T10:00:00Z"),
      assignedSeller: "Grace Hopper",
      closed: false,
      transcript: "...",
    };
    expect(draft.email).toBe("ada@example.com");
  });
});
