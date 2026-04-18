import { describe, it, expect } from "vitest";
import {
  ClassificationValidator,
  INCONSISTENCY_RULES,
  type InconsistencyRule,
  type Warning,
} from "../validator";
import type { Classification } from "@/classification/domain/schema";

/**
 * Builds a fully-valid baseline Classification fixture matching the Zod schema
 * (see `classification/domain/schema.ts`). Overrides are merged on top — lets
 * each test express only the fields relevant to the rule under exercise.
 *
 * Baseline is intentionally consistent (no rule fires) so overrides are the
 * ONLY trigger for any warning.
 */
function makeClassification(
  overrides: Partial<Classification> = {},
): Classification {
  const base: Classification = {
    reasoning:
      "El cliente menciona un problema claro y muestra interés en evaluar la solución durante los próximos meses.",
    industry: "Tecnología",
    companySize: "PYME",
    mainPainPoint: "Equipo Saturado",
    keyObjection: "Ninguna",
    leadSource: "No Mencionado",
    sentiment: "Neutro",
    needsSummary:
      "Necesita automatizar respuestas a clientes frecuentes y liberar tiempo del equipo de soporte para casos complejos.",
    nextSteps: "Enviar propuesta técnica y agendar demo la próxima semana.",
  };
  return { ...base, ...overrides };
}

describe("ClassificationValidator", () => {
  it("returns [] when the rules table is empty for any input", () => {
    const validator = new ClassificationValidator([]);

    const warnings = validator.validate(makeClassification());
    const warnings2 = validator.validate(
      makeClassification({ sentiment: "Negativo" }),
    );

    expect(warnings).toEqual([]);
    expect(warnings2).toEqual([]);
  });

  it("returns [] for a consistent classification under default rules (empty table)", () => {
    const validator = new ClassificationValidator();

    const warnings = validator.validate(makeClassification());

    expect(warnings).toEqual([]);
  });

  it("INCONSISTENCY_RULES is empty — no buyingSignal cross-dim rules in v3.0.0", () => {
    expect(INCONSISTENCY_RULES).toHaveLength(0);
  });

  it("fires multiple rules simultaneously for overlapping inconsistencies", () => {
    const validator = new ClassificationValidator();

    // Verify the multi-rule path with a custom injected pair so the test stays
    // self-contained (default rules table is empty in v3.0.0).
    const always1: InconsistencyRule = {
      name: "rule_a",
      severity: "warning",
      matches: () => true,
      message: () => "A",
    };
    const always2: InconsistencyRule = {
      name: "rule_b",
      severity: "warning",
      matches: () => true,
      message: () => "B",
    };
    const v2 = new ClassificationValidator([always1, always2]);

    const warnings = v2.validate(makeClassification());

    const names = warnings.map((w) => w.name).sort();
    expect(names).toHaveLength(2);
    expect(names).toContain("rule_a");
    expect(names).toContain("rule_b");
  });

  it("returns a readonly-typed array (compile-time check)", () => {
    const validator = new ClassificationValidator();

    const warnings: readonly Warning[] = validator.validate(makeClassification());

    expect(Array.isArray(warnings)).toBe(true);
  });

  it("uses injected custom rules exactly — one always-match rule yields one warning", () => {
    const alwaysMatch: InconsistencyRule = {
      name: "always",
      severity: "warning",
      matches: () => true,
      message: () => "always matches",
    };
    const validator = new ClassificationValidator([alwaysMatch]);

    const warnings = validator.validate(makeClassification());
    const warnings2 = validator.validate(
      makeClassification({ sentiment: "Negativo" }),
    );

    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toEqual({
      name: "always",
      severity: "warning",
      message: "always matches",
    });
    expect(warnings2).toHaveLength(1);
  });

  it("has stable, unique rule names in the default INCONSISTENCY_RULES table", () => {
    const names = INCONSISTENCY_RULES.map((r) => r.name);
    expect(new Set(names).size).toBe(names.length);
  });
});
