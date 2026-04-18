import { describe, it, expect, expectTypeOf } from "vitest";
import { ZodError } from "zod";

import {
  ClassificationSchema,
  INDUSTRIES,
  COMPANY_SIZES,
  MAIN_PAIN_POINTS,
  KEY_OBJECTIONS,
  BUYING_SIGNALS,
  SENTIMENTS,
  type Classification,
} from "../schema";

const validFixture: Classification = {
  reasoning:
    "El cliente opera en servicios financieros, equipo saturado por volumen repetitivo.",
  industry: "Servicios Financieros",
  companySize: "PYME",
  mainPainPoint: "Volumen Repetitivo",
  keyObjection: "Ninguna",
  buyingSignal: "Muy Interesado",
  sentiment: "Positivo",
  needsSummary:
    "El cliente necesita automatizar la atencion de consultas repetitivas en horarios pico, integrar el chatbot con su CRM actual y mantener un tono humano para preservar la marca.",
  nextSteps:
    "Agendar demo tecnica con el equipo de integraciones la proxima semana y enviar propuesta comercial.",
};

describe("ClassificationSchema (Zod)", () => {
  it("parses a valid classification fixture", () => {
    const parsed = ClassificationSchema.parse(validFixture);
    expect(parsed).toEqual(validFixture);
  });

  it("rejects an invalid enum value (industry)", () => {
    const bad = { ...validFixture, industry: "FooBar" };
    expect(() => ClassificationSchema.parse(bad)).toThrow(ZodError);
  });

  it("rejects a missing reasoning field", () => {
    const withoutReasoning: Record<string, unknown> = { ...validFixture };
    delete withoutReasoning.reasoning;
    expect(() => ClassificationSchema.parse(withoutReasoning)).toThrow(
      ZodError,
    );
  });

  it("rejects an empty reasoning (min 1)", () => {
    const bad = { ...validFixture, reasoning: "" };
    expect(() => ClassificationSchema.parse(bad)).toThrow(ZodError);
  });

  it("forces reasoning as the FIRST field of the schema (CoT contract)", () => {
    const keys = Object.keys(ClassificationSchema.shape);
    expect(keys[0]).toBe("reasoning");
  });

  it("is strict — rejects unknown extra fields (additionalProperties: false)", () => {
    const bad = { ...validFixture, extra: "nope" };
    expect(() => ClassificationSchema.parse(bad)).toThrow(ZodError);
  });

  it("rejects needsSummary shorter than 20 characters", () => {
    const bad = { ...validFixture, needsSummary: "demasiado corto" };
    expect(() => ClassificationSchema.parse(bad)).toThrow(ZodError);
  });

  it("rejects nextSteps shorter than 10 characters", () => {
    const bad = { ...validFixture, nextSteps: "corto" };
    expect(() => ClassificationSchema.parse(bad)).toThrow(ZodError);
  });

  it("rejects needsSummary longer than 600 characters", () => {
    const bad = { ...validFixture, needsSummary: "a".repeat(701) };
    expect(() => ClassificationSchema.parse(bad)).toThrow(ZodError);
  });

  it("rejects nextSteps longer than 450 characters", () => {
    const bad = { ...validFixture, nextSteps: "a".repeat(501) };
    expect(() => ClassificationSchema.parse(bad)).toThrow(ZodError);
  });

  describe("categorical arrays are the single source of truth", () => {
    it("industry enum options equal INDUSTRIES", () => {
      expect(ClassificationSchema.shape.industry.options).toEqual([
        ...INDUSTRIES,
      ]);
    });

    it("companySize enum options equal COMPANY_SIZES", () => {
      expect(ClassificationSchema.shape.companySize.options).toEqual([
        ...COMPANY_SIZES,
      ]);
    });

    it("mainPainPoint enum options equal MAIN_PAIN_POINTS", () => {
      expect(ClassificationSchema.shape.mainPainPoint.options).toEqual([
        ...MAIN_PAIN_POINTS,
      ]);
    });

    it("keyObjection enum options equal KEY_OBJECTIONS", () => {
      expect(ClassificationSchema.shape.keyObjection.options).toEqual([
        ...KEY_OBJECTIONS,
      ]);
    });

    it("buyingSignal enum options equal BUYING_SIGNALS", () => {
      expect(ClassificationSchema.shape.buyingSignal.options).toEqual([
        ...BUYING_SIGNALS,
      ]);
    });

    it("sentiment enum options equal SENTIMENTS", () => {
      expect(ClassificationSchema.shape.sentiment.options).toEqual([
        ...SENTIMENTS,
      ]);
    });
  });

  describe("escape hatches (anti-hallucination)", () => {
    it("industry includes 'Otros'", () => {
      expect(INDUSTRIES).toContain("Otros");
    });
    it("keyObjection includes 'Ninguna'", () => {
      expect(KEY_OBJECTIONS).toContain("Ninguna");
    });
  });

  it("infers a Classification type that matches the fixture shape", () => {
    expectTypeOf(validFixture).toMatchTypeOf<Classification>();
  });
});
