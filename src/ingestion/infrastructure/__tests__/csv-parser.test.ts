import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it, expect } from "vitest";

import { InvalidCsvFormatError } from "@/ingestion/domain/errors";
import {
  CsvParser,
  EXPECTED_HEADERS,
  type ParseResult,
} from "../csv-parser";

/**
 * CsvParser — unit tests (pure, no DB, no network).
 *
 * Requirements covered:
 * - RF1.1: 7 exact column names (case + accent sensitive).
 * - RF1.2: missing or wrong column → clear error, batch aborts (throw).
 * - RF1.4: bad row is reported as { ok: false }, does NOT crash the batch.
 */

const HEADER_ROW = EXPECTED_HEADERS.join(",");

const validRow = (overrides: Record<string, string> = {}): string => {
  const base: Record<string, string> = {
    Nombre: "Carlos Perez",
    "Correo Electronico": "c.perez@example.com",
    "Numero de Telefono": "56912345678",
    "Fecha de la Reunion": "2024-03-15",
    "Vendedor asignado": "Toro",
    closed: "1",
    Transcripcion: '"Gracias por la reunion."',
  };
  const merged: Record<string, string> = { ...base, ...overrides };
  return EXPECTED_HEADERS.map((h) => merged[h] ?? "").join(",");
};

const okResults = (results: readonly ParseResult[]) =>
  results.filter((r): r is Extract<ParseResult, { ok: true }> => r.ok);

const errResults = (results: readonly ParseResult[]) =>
  results.filter((r): r is Extract<ParseResult, { ok: false }> => !r.ok);

describe("CsvParser — header validation", () => {
  it("throws InvalidCsvFormatError listing missing columns", () => {
    const parser = new CsvParser();
    const headerMissingClosed = EXPECTED_HEADERS.filter(
      (h) => h !== "closed",
    ).join(",");
    const csv = `${headerMissingClosed}\nCarlos,c@x.com,56912,2024-03-15,Toro,"t"`;
    try {
      parser.parse(csv);
      throw new Error("should have thrown");
    } catch (e) {
      expect(e).toBeInstanceOf(InvalidCsvFormatError);
      if (e instanceof InvalidCsvFormatError) {
        expect(e.missingColumns).toEqual(["closed"]);
        expect(e.unexpectedColumns).toEqual([]);
      }
    }
  });

  it("throws InvalidCsvFormatError listing unexpected columns", () => {
    const parser = new CsvParser();
    const csv = `${HEADER_ROW},Notas\n${validRow()},extra`;
    try {
      parser.parse(csv);
      throw new Error("should have thrown");
    } catch (e) {
      expect(e).toBeInstanceOf(InvalidCsvFormatError);
      if (e instanceof InvalidCsvFormatError) {
        expect(e.missingColumns).toEqual([]);
        expect(e.unexpectedColumns).toEqual(["Notas"]);
      }
    }
  });

  it("is case-sensitive: 'correo electronico' (lowercase) is NOT accepted", () => {
    const parser = new CsvParser();
    const header = EXPECTED_HEADERS.map((h) =>
      h === "Correo Electronico" ? "correo electronico" : h,
    ).join(",");
    const csv = `${header}\nCarlos,c@x.com,56912,2024-03-15,Toro,1,"t"`;
    try {
      parser.parse(csv);
      throw new Error("should have thrown");
    } catch (e) {
      expect(e).toBeInstanceOf(InvalidCsvFormatError);
      if (e instanceof InvalidCsvFormatError) {
        expect(e.missingColumns).toEqual(["Correo Electronico"]);
        expect(e.unexpectedColumns).toEqual(["correo electronico"]);
      }
    }
  });
});

describe("CsvParser — happy path", () => {
  it("parses one valid row into NewClient with rowNumber=2", () => {
    const parser = new CsvParser();
    const csv = `${HEADER_ROW}\n${validRow()}`;
    const results = parser.parse(csv);

    expect(results).toHaveLength(1);
    const [first] = results;
    expect(first?.ok).toBe(true);
    if (first?.ok) {
      expect(first.rowNumber).toBe(2);
      expect(first.row.email).toBe("c.perez@example.com");
      expect(first.row.name).toBe("Carlos Perez");
      expect(first.row.phone).toBe("56912345678");
      expect(first.row.assignedSeller).toBe("Toro");
      expect(first.row.closed).toBe(true);
      expect(first.row.meetingDate).toBeInstanceOf(Date);
      expect(first.row.meetingDate.toISOString().slice(0, 10)).toBe(
        "2024-03-15",
      );
      expect(first.row.transcript).toBe("Gracias por la reunion.");
    }
  });

  it("parses multiple rows, numbering each from row 2 upward", () => {
    const parser = new CsvParser();
    const csv = [
      HEADER_ROW,
      validRow({ "Correo Electronico": "a@x.com" }),
      validRow({ "Correo Electronico": "b@x.com", closed: "0" }),
      validRow({ "Correo Electronico": "c@x.com" }),
    ].join("\n");

    const results = parser.parse(csv);
    expect(results).toHaveLength(3);
    expect(results.map((r) => r.rowNumber)).toEqual([2, 3, 4]);
    expect(results.every((r) => r.ok)).toBe(true);
    expect(okResults(results).map((r) => r.row.closed)).toEqual([
      true,
      false,
      true,
    ]);
  });

  it("returns row.phone === null when phone is empty", () => {
    const parser = new CsvParser();
    const csv = `${HEADER_ROW}\n${validRow({ "Numero de Telefono": "" })}`;
    const [first] = parser.parse(csv);
    expect(first?.ok).toBe(true);
    if (first?.ok) {
      expect(first.row.phone).toBeNull();
    }
  });

  it("applies defaults: classificationStatus='pending', truncated=false, warnings=[]", () => {
    const parser = new CsvParser();
    const csv = `${HEADER_ROW}\n${validRow()}`;
    const [first] = parser.parse(csv);
    expect(first?.ok).toBe(true);
    if (first?.ok) {
      expect(first.row.classificationStatus).toBe("pending");
      expect(first.row.truncated).toBe(false);
      expect(first.row.warnings).toEqual([]);
      expect(first.row.industry).toBeUndefined();
      expect(first.row.reasoning).toBeUndefined();
      expect(first.row.modelVersion).toBeUndefined();
    }
  });

  it("preserves quoted transcripts with embedded commas and newlines", () => {
    const parser = new CsvParser();
    const transcript =
      '"Gracias por la reunion, espero\nvernos pronto."';
    const csv = `${HEADER_ROW}\n${validRow({ Transcripcion: transcript })}`;
    const [first] = parser.parse(csv);
    expect(first?.ok).toBe(true);
    if (first?.ok) {
      expect(first.row.transcript).toBe(
        "Gracias por la reunion, espero\nvernos pronto.",
      );
    }
  });
});

describe("CsvParser — per-row isolation (RF1.4)", () => {
  it("marks row with empty email as error without throwing", () => {
    const parser = new CsvParser();
    const csv = `${HEADER_ROW}\n${validRow({ "Correo Electronico": "" })}`;
    const [first] = parser.parse(csv);
    expect(first?.ok).toBe(false);
    if (first && !first.ok) {
      expect(first.rowNumber).toBe(2);
      expect(first.error.toLowerCase()).toContain("email");
    }
  });

  it("marks row with invalid meetingDate as error", () => {
    const parser = new CsvParser();
    const csv = `${HEADER_ROW}\n${validRow({ "Fecha de la Reunion": "not-a-date" })}`;
    const [first] = parser.parse(csv);
    expect(first?.ok).toBe(false);
    if (first && !first.ok) {
      expect(first.error.toLowerCase()).toContain("fecha");
    }
  });

  it("marks row with closed='2' as error mentioning 0 or 1", () => {
    const parser = new CsvParser();
    const csv = `${HEADER_ROW}\n${validRow({ closed: "2" })}`;
    const [first] = parser.parse(csv);
    expect(first?.ok).toBe(false);
    if (first && !first.ok) {
      expect(first.error).toMatch(/0.*1|1.*0/);
    }
  });

  it("keeps valid rows when invalid rows are interleaved", () => {
    const parser = new CsvParser();
    const csv = [
      HEADER_ROW,
      validRow({ "Correo Electronico": "ok1@x.com" }),
      validRow({ "Correo Electronico": "bad@x.com", closed: "maybe" }),
      validRow({ "Correo Electronico": "ok2@x.com" }),
    ].join("\n");
    const results = parser.parse(csv);

    expect(results).toHaveLength(3);
    expect(results.map((r) => r.rowNumber)).toEqual([2, 3, 4]);
    expect(okResults(results).map((r) => r.row.email)).toEqual([
      "ok1@x.com",
      "ok2@x.com",
    ]);
    expect(errResults(results)).toHaveLength(1);
    expect(errResults(results)[0]?.rowNumber).toBe(3);
  });
});

describe("CsvParser — real fixture slice", () => {
  it("parses the first 3 data rows of data/vambe_clients.csv successfully", () => {
    const raw = readFileSync(
      resolve(process.cwd(), "data/vambe_clients.csv"),
      "utf-8",
    );
    const lines = raw.split(/\r?\n/);
    const slice = [lines[0], lines[1], lines[2], lines[3]]
      .filter((l): l is string => !!l)
      .join("\n");

    const parser = new CsvParser();
    const results = parser.parse(slice);

    expect(results).toHaveLength(3);
    expect(results.every((r) => r.ok)).toBe(true);
    const oks = okResults(results);
    expect(oks[0]?.row.email).toBe("c.perez@example.com");
    expect(oks[1]?.row.email).toBe("m.lopez@example.com");
    expect(oks[2]?.row.email).toBe("j.gonzalez@example.com");
    expect(oks[0]?.row.meetingDate.toISOString().slice(0, 10)).toBe(
      "2024-03-15",
    );
    expect(oks[0]?.row.transcript.length).toBeGreaterThan(50);
    expect(oks[0]?.row.transcript).toContain("Gracias por la reunion");
  });
});
