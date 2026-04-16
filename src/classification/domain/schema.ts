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
 *  2. All 8 categorical dimensions are CLOSED enums whose values are
 *     lifted from named `as const` arrays (below). Those arrays are the
 *     single source of truth — the PromptBuilder (task 3.2) and the
 *     ClassificationValidator (task 3.4) import from here too, so the
 *     prompt, the schema, and the post-validation never drift.
 *
 *  3. Each dimension that could "not apply" has an explicit escape hatch
 *     (`Otros`, `Ninguna`, `Indefinido`) so the model never needs to
 *     invent a value.
 *
 *  4. Word counts for the qualitative fields are instructed via prompt,
 *     not enforced strictly in Zod: strict bounds in Zod would cause
 *     off-by-one rejections of otherwise-fine classifications. A loose
 *     character `min` acts as a sanity check only.
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

export const PURCHASE_TIMELINES = [
  "Urgente (<2 sem)",
  "Corto (2-8 sem)",
  "Largo (2+ meses)",
  "Indefinido",
] as const;

export const BUYING_SIGNALS = [
  "Muy Interesado",
  "Evaluando",
  "Tibio",
  "Frío",
] as const;

export const DECISION_MAKER_ROLES = [
  "CEO/Fundador",
  "Manager de Área",
  "Analista/Coordinador",
  "Comité",
] as const;

export const SENTIMENTS = ["Positivo", "Neutro", "Negativo"] as const;

export const ClassificationSchema = z
  .object({
    // 0. Chain-of-Thought — MUST be the first key.
    reasoning: z.string().min(1),

    // 1–8. Closed categorical dimensions (PRD §7.1).
    industry: z.enum(INDUSTRIES),
    companySize: z.enum(COMPANY_SIZES),
    mainPainPoint: z.enum(MAIN_PAIN_POINTS),
    keyObjection: z.enum(KEY_OBJECTIONS),
    purchaseTimeline: z.enum(PURCHASE_TIMELINES),
    buyingSignal: z.enum(BUYING_SIGNALS),
    decisionMakerRole: z.enum(DECISION_MAKER_ROLES),
    sentiment: z.enum(SENTIMENTS),

    // 9–10. Qualitative free text (PRD §7.2). Word count is instructed in
    // the prompt, not enforced here — see invariant #4 above.
    needsSummary: z.string().min(50),
    nextSteps: z.string().min(20),
  })
  .strict();

export type Classification = z.infer<typeof ClassificationSchema>;
