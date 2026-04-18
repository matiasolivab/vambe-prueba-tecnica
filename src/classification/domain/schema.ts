import { z } from "zod";

/**
 * Classification domain schema — the CORE contract between the LLM
 * (`gpt-4o-mini` with Structured Outputs) and the rest of the system.
 *
 * Key invariants (see `docs/ARCHITECTURE.md` §13 rule 10 +
 * `docs/PRD.md` §7.1–7.3):
 *
 *  1. `reasoning` is declared FIRST so it appears FIRST in the generated
 *     JSON Schema. OpenAI Structured Outputs respects property order, so
 *     the model must emit `reasoning` BEFORE any categorical value. This
 *     forces Chain-of-Thought and lifts accuracy on ambiguous transcripts
 *     (~10-15% per "Let Me Speak Freely?" 2024). Reordering this schema
 *     silently breaks the CoT contract — there is a test guarding it.
 *
 *  2. All 6 categorical dimensions are CLOSED enums whose values are
 *     lifted from named `as const` arrays (below). Those arrays are the
 *     single source of truth — the PromptBuilder (task 3.2) and the
 *     ClassificationValidator (task 3.4) import from here too, so the
 *     prompt, the schema, and the post-validation never drift.
 *
 *  3. Each dimension that could "not apply" has an explicit escape hatch
 *     (`Otros`, `Ninguna`, `Indefinido`) so the model never needs to
 *     invent a value.
 *
 *  4. Word counts for the qualitative fields are instructed via prompt.
 *     A loose `.max()` is now enforced as a safety net (not a strict word
 *     count) to cap runaway outputs — the prompt still owns the fine-grained
 *     word target. The `min` acts as a sanity check only.
 *
 *  5. `.strict()` is applied to emit `additionalProperties: false` in the
 *     generated JSON Schema, which OpenAI Structured Outputs requires
 *     when `strict: true`.
 */

export const INDUSTRIES = [
  "Servicios Financieros",
  "E-commerce",
  "Consultoría",
  "Salud",
  "Educación",
  "Logística",
  "Servicios Profesionales",
  "Tecnología",
  "Eventos",
  "Real Estate",
  "Medios/Artes",
  "Hogar/Sostenibilidad",
  "Otros",
] as const;

export const COMPANY_SIZES = [
  "Startup",
  "PYME",
  "Mid-market",
  "Enterprise",
] as const;

export const MAIN_PAIN_POINTS = [
  "Volumen Repetitivo",
  "Equipo Saturado",
  "Respuestas Lentas",
  "Pérdida de Personalización",
  "Integración Técnica",
  "Consultas Especializadas",
  "Variabilidad Estacional",
] as const;

export const KEY_OBJECTIONS = [
  "Especificidad Técnica",
  "Integración",
  "Desconfianza Automatización",
  "Timing Bajo",
  "Compliance",
  "Ninguna",
] as const;

export const BUYING_SIGNALS = [
  "Muy Interesado",
  "Evaluando",
  "Tibio",
  "Frío",
] as const;

export const SENTIMENTS = ["Positivo", "Neutro", "Negativo"] as const;

export const ClassificationSchema = z
  .object({
    // 0. Chain-of-Thought — MUST be the first key.
    reasoning: z.string().min(1),

    // 1–6. Closed categorical dimensions (PRD §7.1).
    industry: z.enum(INDUSTRIES),
    companySize: z.enum(COMPANY_SIZES),
    mainPainPoint: z.enum(MAIN_PAIN_POINTS),
    keyObjection: z.enum(KEY_OBJECTIONS),
    buyingSignal: z.enum(BUYING_SIGNALS),
    sentiment: z.enum(SENTIMENTS),

    // 7–8. Qualitative free text (PRD §7.2). Word count is instructed in
    // the prompt; .max() caps runaway outputs — see invariant #4 above.
    needsSummary: z.string().min(20).max(600),
    nextSteps: z.string().min(10).max(450),
  })
  .strict();

export type Classification = z.infer<typeof ClassificationSchema>;
