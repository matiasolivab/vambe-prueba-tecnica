import { DomainError } from "@/shared/domain/domain-error";

/**
 * Typed ingestion errors — thrown at the boundary of the CSV parsing pipeline.
 *
 * Scope decision: these errors live in `ingestion/domain/` rather than
 * `shared/domain/` because the header contract is specific to this domain
 * (PRD §RF1.1). Other domains (classification, clients) must NOT depend on
 * CSV format details.
 *
 * `InvalidCsvFormatError` is thrown by `CsvParser.parse` when the uploaded
 * CSV fails strict header validation (missing or unexpected columns). Per
 * PRD §RF1.2, this aborts the whole batch — no row processing starts.
 * In contrast, per-row mapping failures are reported as `ParseResult`
 * entries with `ok: false` and do NOT throw (per-row isolation, PRD §RF1.4).
 */

export class InvalidCsvFormatError extends DomainError {
  public readonly missingColumns: readonly string[];
  public readonly unexpectedColumns: readonly string[];

  constructor(
    missingColumns: readonly string[],
    unexpectedColumns: readonly string[],
    cause?: unknown,
  ) {
    const parts: string[] = [];
    if (missingColumns.length > 0) {
      parts.push(`faltan columnas: ${missingColumns.join(", ")}`);
    }
    if (unexpectedColumns.length > 0) {
      parts.push(`columnas inesperadas: ${unexpectedColumns.join(", ")}`);
    }
    const message = `CSV inválido — ${parts.join(" | ")}`;
    super(
      "InvalidCsvFormatError",
      "ingestion.invalid_csv_format",
      message,
      cause,
    );
    this.missingColumns = missingColumns;
    this.unexpectedColumns = unexpectedColumns;
  }
}
