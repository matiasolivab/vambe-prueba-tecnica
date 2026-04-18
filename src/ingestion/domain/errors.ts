import { DomainError } from "@/shared/domain/domain-error";

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
