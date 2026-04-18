import { parse as parseCsv } from "csv-parse/sync";

import type { NewClient } from "@/clients/infrastructure/db/schema";
import { InvalidCsvFormatError } from "@/ingestion/domain/errors";

export const EXPECTED_HEADERS = [
  "Nombre",
  "Correo Electronico",
  "Numero de Telefono",
  "Fecha de la Reunion",
  "Vendedor asignado",
  "closed",
  "Transcripcion",
] as const;

type ExpectedHeader = (typeof EXPECTED_HEADERS)[number];
type RawRow = Record<string, string>;

export type ParseResult =
  | { readonly ok: true; readonly rowNumber: number; readonly row: NewClient }
  | { readonly ok: false; readonly rowNumber: number; readonly error: string };

export class CsvParser {
  public parse(csv: string): readonly ParseResult[] {
    const records = parseCsv(csv, {
      columns: true,
      skip_empty_lines: true,
      trim: true,
      relax_quotes: true,
    }) as RawRow[];

    const actualHeaders = this.extractHeaders(records, csv);
    this.validateHeaders(actualHeaders);

    return records.map((raw, index) => this.mapRow(raw, index + 2));
  }

  private extractHeaders(records: RawRow[], csv: string): readonly string[] {
    if (records.length > 0) {
      const first = records[0];
      return first ? Object.keys(first) : [];
    }
    const firstLine = csv.split(/\r?\n/)[0] ?? "";
    return firstLine.split(",").map((h) => h.trim()).filter((h) => h.length > 0);
  }

  private validateHeaders(actual: readonly string[]): void {
    const expectedSet = new Set<string>(EXPECTED_HEADERS);
    const actualSet = new Set(actual);
    const missing = EXPECTED_HEADERS.filter((h) => !actualSet.has(h));
    const unexpected = actual.filter((h) => !expectedSet.has(h));
    if (missing.length > 0 || unexpected.length > 0) {
      throw new InvalidCsvFormatError(missing, unexpected);
    }
  }

  private mapRow(raw: RawRow, rowNumber: number): ParseResult {
    try {
      const row: NewClient = {
        name: this.requireNonEmpty(raw, "Nombre", "name"),
        email: this.parseEmail(raw),
        phone: this.parsePhone(raw),
        meetingDate: this.parseDate(raw),
        assignedSeller: this.requireNonEmpty(
          raw,
          "Vendedor asignado",
          "assignedSeller",
        ),
        closed: this.parseBoolean(raw),
        transcript: this.requireNonEmpty(raw, "Transcripcion", "transcript"),
        classificationStatus: "pending",
        truncated: false,
        warnings: [],
      };
      return { ok: true, rowNumber, row };
    } catch (e) {
      const error = e instanceof Error ? e.message : "error desconocido";
      return { ok: false, rowNumber, error };
    }
  }

  private requireNonEmpty(
    raw: RawRow,
    column: ExpectedHeader,
    fieldLabel: string,
  ): string {
    const value = (raw[column] ?? "").trim();
    if (value.length === 0) {
      throw new Error(`${fieldLabel} vacío`);
    }
    return value;
  }

  private parseEmail(raw: RawRow): string {
    const email = (raw["Correo Electronico"] ?? "").trim();
    if (email.length === 0) throw new Error("email vacío");
    const at = email.indexOf("@");
    if (at <= 0 || email.indexOf(".", at) === -1) {
      throw new Error("email inválido");
    }
    return email;
  }

  private parsePhone(raw: RawRow): string | null {
    const phone = (raw["Numero de Telefono"] ?? "").trim();
    return phone.length === 0 ? null : phone;
  }

  private parseDate(raw: RawRow): Date {
    const value = (raw["Fecha de la Reunion"] ?? "").trim();
    if (value.length === 0) throw new Error("fecha vacía");
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      throw new Error(`fecha inválida: ${value}`);
    }
    return date;
  }

  private parseBoolean(raw: RawRow): boolean {
    const value = (raw["closed"] ?? "").trim();
    if (value === "1") return true;
    if (value === "0") return false;
    throw new Error("closed debe ser 0 o 1");
  }
}
