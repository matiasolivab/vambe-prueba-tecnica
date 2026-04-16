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
    purchaseTimeline: "Corto (2-8 sem)",
    buyingSignal: "Evaluando",
    decisionMakerRole: "Manager de Área",
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
      makeClassification({ buyingSignal: "Muy Interesado", sentiment: "Negativo" }),
    );

    expect(warnings).toEqual([]);
    expect(warnings2).toEqual([]);
  });

  it("returns [] for a consistent classification under default rules", () => {
    const validator = new ClassificationValidator();

    const warnings = validator.validate(makeClassification());

    expect(warnings).toEqual([]);
  });

  it("fires signal_vs_sentiment on Muy Interesado + Negativo", () => {
    const validator = new ClassificationValidator();

    const warnings = validator.validate(
      makeClassification({
        buyingSignal: "Muy Interesado",
        sentiment: "Negativo",
      }),
    );

    expect(warnings).toHaveLength(1);
    expect(warnings[0].name).toBe("signal_vs_sentiment");
    expect(warnings[0].severity).toBe("warning");
    expect(warnings[0].message).toMatch(/sentiment negativo/i);
  });

  it("does NOT fire signal_vs_sentiment on defensive inversions", () => {
    const validator = new ClassificationValidator();

    const positive = validator.validate(
      makeClassification({
        buyingSignal: "Muy Interesado",
        sentiment: "Positivo",
      }),
    );
    const tibio = validator.validate(
      makeClassification({
        buyingSignal: "Tibio",
        sentiment: "Negativo",
      }),
    );

    const names = [...positive, ...tibio].map((w) => w.name);
    expect(names).not.toContain("signal_vs_sentiment");
  });

  it("fires frio_signal_with_positive_sentiment on Frío + Positivo", () => {
    const validator = new ClassificationValidator();

    const warnings = validator.validate(
      makeClassification({ buyingSignal: "Frío", sentiment: "Positivo" }),
    );

    const names = warnings.map((w) => w.name);
    expect(names).toContain("frio_signal_with_positive_sentiment");
  });

  it("fires urgent_timeline_with_objection on Urgente + active objection", () => {
    const validator = new ClassificationValidator();

    const warnings = validator.validate(
      makeClassification({
        purchaseTimeline: "Urgente (<2 sem)",
        keyObjection: "Integración",
      }),
    );

    const w = warnings.find((x) => x.name === "urgent_timeline_with_objection");
    expect(w).toBeDefined();
    expect(w?.severity).toBe("warning");
    expect(w?.message).toContain("Integración");
  });

  it("does NOT fire urgent_timeline_with_objection when objection is Ninguna", () => {
    const validator = new ClassificationValidator();

    const warnings = validator.validate(
      makeClassification({
        purchaseTimeline: "Urgente (<2 sem)",
        keyObjection: "Ninguna",
      }),
    );

    const names = warnings.map((w) => w.name);
    expect(names).not.toContain("urgent_timeline_with_objection");
  });

  it("fires multiple rules simultaneously for overlapping inconsistencies", () => {
    const validator = new ClassificationValidator();

    const warnings = validator.validate(
      makeClassification({
        buyingSignal: "Muy Interesado",
        sentiment: "Negativo",
        purchaseTimeline: "Urgente (<2 sem)",
        keyObjection: "Compliance",
      }),
    );

    const names = warnings.map((w) => w.name).sort();
    expect(names).toHaveLength(2);
    expect(names).toContain("signal_vs_sentiment");
    expect(names).toContain("urgent_timeline_with_objection");
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
    // sanity: the required rule is present
    expect(names).toContain("signal_vs_sentiment");
  });
});
