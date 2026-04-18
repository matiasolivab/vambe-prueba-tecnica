import { describe, it, expect } from "vitest";
import {
  PromptBuilder,
  type FewShotExample,
} from "../prompt-builder";
import {
  INDUSTRIES,
  COMPANY_SIZES,
  MAIN_PAIN_POINTS,
  KEY_OBJECTIONS,
  LEAD_SOURCES,
  SENTIMENTS,
  type Classification,
} from "@/classification/domain/schema";

/**
 * Fixture: 2 few-shot examples covering distinct enum values.
 *
 * The builder must serialize these as `Transcripción: ...` / `Clasificación
 * esperada: <JSON>` pairs. We keep the examples decoupled from the real CSV
 * — this service only cares about formatting, not data sourcing.
 */
const fewShot1: FewShotExample = {
  transcript:
    "Vendedor: Hola, soy de Vambe. Cliente: Necesitamos integrar su sistema con nuestra API.",
  classification: {
    reasoning:
      "El cliente menciona integración explícita con API; es una empresa tecnológica con necesidad técnica clara.",
    industry: "Tecnología",
    companySize: "PYME",
    mainPainPoint: "Integración Técnica",
    keyObjection: "Integración",
    leadSource: "No Mencionado",
    sentiment: "Neutro",
    needsSummary:
      "El cliente necesita integrar su sistema de backend con la plataforma de Vambe mediante API REST y desea mantener compatibilidad con su stack actual.",
    nextSteps:
      "Enviar documentación técnica de la API y agendar una llamada técnica con el equipo de ingeniería.",
  } satisfies Classification,
};

const fewShot2: FewShotExample = {
  transcript:
    "Cliente: Tengo un e-commerce y recibo 500 consultas repetitivas por día. Ya no damos abasto.",
  classification: {
    reasoning:
      "Alto volumen de consultas repetitivas y saturación del equipo son señales claras de e-commerce con dolor operativo agudo.",
    industry: "E-commerce",
    companySize: "Startup",
    mainPainPoint: "Volumen Repetitivo",
    keyObjection: "Ninguna",
    leadSource: "No Mencionado",
    sentiment: "Positivo",
    needsSummary:
      "El cliente opera un e-commerce con 500 consultas diarias repetitivas y requiere automatización inmediata para liberar al equipo de soporte.",
    nextSteps:
      "Agendar demo en los próximos cinco días hábiles y preparar propuesta comercial al volumen reportado.",
  } satisfies Classification,
};

describe("PromptBuilder", () => {
  describe("buildSystemPrompt", () => {
    it("includes the Spanish role statement mentioning Vambe and clasificador", () => {
      const builder = new PromptBuilder();

      const prompt = builder.buildSystemPrompt();

      expect(prompt.toLowerCase()).toContain("vambe");
      expect(prompt.toLowerCase()).toContain("clasificador");
    });

    it("forces Chain-of-Thought: mentions reasoning field and ordering", () => {
      const builder = new PromptBuilder();

      const prompt = builder.buildSystemPrompt();

      expect(prompt).toContain("reasoning");
      // Ordering cue: must literally tell the model reasoning comes first.
      const mentionsOrder =
        prompt.includes("PRIMERO") ||
        prompt.toLowerCase().includes("antes de") ||
        prompt.toLowerCase().includes("primero");
      expect(mentionsOrder).toBe(true);
    });

    it("lists all 8 dimension field names", () => {
      const builder = new PromptBuilder();

      const prompt = builder.buildSystemPrompt();

      const fields = [
        "industry",
        "companySize",
        "mainPainPoint",
        "keyObjection",
        "leadSource",
        "sentiment",
        "needsSummary",
        "nextSteps",
      ];
      for (const field of fields) {
        expect(prompt, `prompt is missing field name "${field}"`).toContain(
          field,
        );
      }

      // Removed dimensions must not appear
      expect(prompt).not.toContain("purchaseTimeline");
      expect(prompt).not.toContain("decisionMakerRole");
      expect(prompt).not.toContain("buyingSignal");
    });

    it("propagates every enum value from domain/schema.ts into the prompt", () => {
      const builder = new PromptBuilder();

      const prompt = builder.buildSystemPrompt();

      const groups: Array<{ label: string; values: readonly string[] }> = [
        { label: "INDUSTRIES", values: INDUSTRIES },
        { label: "COMPANY_SIZES", values: COMPANY_SIZES },
        { label: "MAIN_PAIN_POINTS", values: MAIN_PAIN_POINTS },
        { label: "KEY_OBJECTIONS", values: KEY_OBJECTIONS },
        { label: "LEAD_SOURCES", values: LEAD_SOURCES },
        { label: "SENTIMENTS", values: SENTIMENTS },
      ];

      for (const group of groups) {
        for (const value of group.values) {
          expect(
            prompt,
            `prompt is missing enum value "${value}" from ${group.label}`,
          ).toContain(value);
        }
      }
    });

    it("includes the literal anti-hallucination escape-hatch rules", () => {
      const builder = new PromptBuilder();

      const prompt = builder.buildSystemPrompt();

      expect(prompt).toContain("Otros");
      expect(prompt).toContain("Ninguna");
      expect(prompt).toContain("NO INVENTES");
      // purchaseTimeline Indefinido rule must be gone
      expect(prompt).not.toContain("Indefinido");
    });

    it("includes the verbatim leadSource anti-hallucination rule (AC-5)", () => {
      const builder = new PromptBuilder();

      const prompt = builder.buildSystemPrompt();

      expect(prompt).toContain(
        "Si la transcripción NO menciona explícitamente cómo llegó a Vambe, usá `No Mencionado`. NUNCA inventes un canal.",
      );
    });

    it("states updated word-count guidance for needsSummary (50-100) and nextSteps (25-75)", () => {
      const builder = new PromptBuilder();

      const prompt = builder.buildSystemPrompt();

      expect(prompt).toContain("50");
      expect(prompt).toContain("100");
      expect(prompt).toContain("25");
      expect(prompt).toContain("75");
    });

    it("prompt describes 8 total dimensions — 6 categorical + 2 qualitative", () => {
      const builder = new PromptBuilder();

      const prompt = builder.buildSystemPrompt();

      expect(prompt).toContain("8");
      expect(prompt).toContain("6");
    });

    it("omits the few-shot section when no examples are provided", () => {
      const builder = new PromptBuilder();

      const prompt = builder.buildSystemPrompt();

      expect(prompt).not.toContain("Transcripción:");
    });

    it("renders every few-shot example with transcript + expected JSON", () => {
      const builder = new PromptBuilder([fewShot1, fewShot2]);

      const prompt = builder.buildSystemPrompt();

      expect(prompt).toContain("Transcripción:");
      expect(prompt).toContain(fewShot1.transcript);
      expect(prompt).toContain(fewShot2.transcript);
      // JSON serialization preserves the exact enum value.
      expect(prompt).toContain('"Tecnología"');
      expect(prompt).toContain('"E-commerce"');
    });

    it("is deterministic — two calls return identical strings", () => {
      const builder = new PromptBuilder([fewShot1]);

      expect(builder.buildSystemPrompt()).toBe(builder.buildSystemPrompt());
    });
  });

  describe("buildUserPrompt", () => {
    it("wraps the transcript verbatim", () => {
      const builder = new PromptBuilder();
      const transcript =
        "Cliente: Estamos evaluando soluciones de automatización para Q2.";

      const prompt = builder.buildUserPrompt(transcript);

      expect(prompt).toContain(transcript);
    });

    it("does not leak system-level content (anti-hallucination rule or role)", () => {
      const builder = new PromptBuilder();

      const prompt = builder.buildUserPrompt("Cliente: hola.");

      expect(prompt).not.toContain("NO INVENTES");
      expect(prompt.toLowerCase()).not.toContain("clasificador experto");
    });
  });
});
