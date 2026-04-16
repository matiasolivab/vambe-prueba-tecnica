import { describe, it, expect } from "vitest";

import { DomainError } from "@/shared/domain/domain-error";
import { InvalidCsvFormatError } from "../errors";

describe("InvalidCsvFormatError", () => {
  it("is instance of Error and DomainError", () => {
    const err = new InvalidCsvFormatError(["closed"], []);
    expect(err).toBeInstanceOf(Error);
    expect(err).toBeInstanceOf(DomainError);
    expect(err).toBeInstanceOf(InvalidCsvFormatError);
  });

  it("exposes name and code", () => {
    const err = new InvalidCsvFormatError(["closed"], []);
    expect(err.name).toBe("InvalidCsvFormatError");
    expect(err.code).toBe("ingestion.invalid_csv_format");
  });

  it("carries missingColumns and unexpectedColumns as readonly public fields", () => {
    const err = new InvalidCsvFormatError(
      ["Correo Electronico"],
      ["correo electronico"],
    );
    expect(err.missingColumns).toEqual(["Correo Electronico"]);
    expect(err.unexpectedColumns).toEqual(["correo electronico"]);
  });

  it("composes message with only missing columns when unexpected is empty", () => {
    const err = new InvalidCsvFormatError(["closed", "Transcripcion"], []);
    expect(err.message).toBe(
      "CSV inválido — faltan columnas: closed, Transcripcion",
    );
  });

  it("composes message with only unexpected columns when missing is empty", () => {
    const err = new InvalidCsvFormatError([], ["Notas"]);
    expect(err.message).toBe("CSV inválido — columnas inesperadas: Notas");
  });

  it("composes message with both missing and unexpected separated by ' | '", () => {
    const err = new InvalidCsvFormatError(
      ["Correo Electronico"],
      ["correo electronico"],
    );
    expect(err.message).toBe(
      "CSV inválido — faltan columnas: Correo Electronico | columnas inesperadas: correo electronico",
    );
  });

  it("preserves an optional cause", () => {
    const root = new Error("underlying parse failure");
    const err = new InvalidCsvFormatError(["closed"], [], root);
    expect(err.cause).toBe(root);
  });

  it("is catchable via instanceof discriminator", () => {
    try {
      throw new InvalidCsvFormatError(["closed"], []);
    } catch (e) {
      if (e instanceof InvalidCsvFormatError) {
        expect(e.code).toBe("ingestion.invalid_csv_format");
      } else {
        throw new Error("should have matched InvalidCsvFormatError");
      }
    }
  });
});
