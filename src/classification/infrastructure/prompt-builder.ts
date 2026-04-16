import {
  INDUSTRIES,
  COMPANY_SIZES,
  MAIN_PAIN_POINTS,
  KEY_OBJECTIONS,
  PURCHASE_TIMELINES,
  BUYING_SIGNALS,
  DECISION_MAKER_ROLES,
  SENTIMENTS,
  type Classification,
} from "@/classification/domain/schema";

/**
 * A single few-shot example: a raw transcript and the canonical
 * classification the LLM is expected to emit for it.
 *
 * The examples are NOT sourced from the CSV inside this module — the caller
 * (classifier wiring) decides which curated examples to inject, keeping
 * `PromptBuilder` decoupled from ground-truth storage.
 */
export interface FewShotExample {
  readonly transcript: string;
  readonly classification: Classification;
}

/**
 * Builds the OpenAI `system` and `user` prompts for classification.
 *
 * Design (see `docs/ARCHITECTURE.md` §13 rules 4, 5, 10):
 *
 *  - **Rule 4 (few-shots):** the builder accepts 2–3 curated examples and
 *    renders them as `Transcripción / Clasificación esperada` pairs so the
 *    model sees realistic Spanish transcripts before classifying.
 *  - **Rule 5 (literal "no inventes"):** the anti-hallucination section is
 *    hard-coded with the exact escape-hatch wording for `Otros`, `Ninguna`,
 *    `Indefinido` — prudence becomes an obligation, not an option.
 *  - **Rule 10 (CoT):** the system prompt explicitly instructs the model to
 *    emit `reasoning` FIRST before any categorical value.
 *
 * Enum values are imported live from `domain/schema.ts`, so adding an
 * industry there automatically propagates to the prompt without a manual
 * edit (enforced by a test).
 *
 * Lives in `infrastructure/` because prompt text formats output for an
 * external boundary (the LLM). Domain direction points inward: this module
 * imports from `domain/`, never the reverse.
 */
export class PromptBuilder {
  public constructor(
    private readonly fewShots: readonly FewShotExample[] = [],
  ) {}

  public buildSystemPrompt(): string {
    const sections = [
      this.formatRole(),
      this.formatChainOfThought(),
      this.formatDimensions(),
      this.formatAntiHallucinationRules(),
      this.formatFewShots(),
      this.formatOutputReminder(),
    ];
    return sections.filter((s) => s.length > 0).join("\n\n");
  }

  public buildUserPrompt(transcript: string): string {
    return [
      "Clasificá la siguiente transcripción siguiendo las reglas del sistema:",
      "",
      "---",
      transcript,
      "---",
    ].join("\n");
  }

  private formatRole(): string {
    return [
      "Sos un clasificador experto de transcripciones de llamadas de ventas en español para Vambe AI.",
      "Tu tarea es extraer 10 dimensiones estructuradas por cada transcripción.",
    ].join(" ");
  }

  private formatChainOfThought(): string {
    return [
      "Chain-of-Thought (OBLIGATORIO):",
      "- Emitís el campo `reasoning` PRIMERO, antes de cualquier valor categórico.",
      "- En `reasoning` explicás tu análisis de la transcripción: qué señales encontraste para industria, tamaño, pain point, objeción, timeline, buying signal, rol de decisor y sentiment.",
      "- Recién después asignás los valores. Esto mejora la accuracy en transcripciones ambiguas (~10-15%).",
    ].join("\n");
  }

  private formatDimensions(): string {
    const categoricalLines = [
      `- industry: [${INDUSTRIES.join(", ")}]`,
      `- companySize: [${COMPANY_SIZES.join(", ")}]`,
      `- mainPainPoint: [${MAIN_PAIN_POINTS.join(", ")}]`,
      `- keyObjection: [${KEY_OBJECTIONS.join(", ")}]`,
      `- purchaseTimeline: [${PURCHASE_TIMELINES.join(", ")}]`,
      `- buyingSignal: [${BUYING_SIGNALS.join(", ")}]`,
      `- decisionMakerRole: [${DECISION_MAKER_ROLES.join(", ")}]`,
      `- sentiment: [${SENTIMENTS.join(", ")}]`,
    ];
    const qualitativeLines = [
      "- needsSummary: 100-200 palabras. Resumen de necesidades específicas del cliente.",
      "- nextSteps: 50-150 palabras. Próximos pasos acordados o sugeridos.",
    ];
    return [
      "Dimensiones a extraer (10 en total — 8 categóricas + 2 cualitativas):",
      ...categoricalLines,
      ...qualitativeLines,
    ].join("\n");
  }

  private formatAntiHallucinationRules(): string {
    return [
      "Reglas anti-alucinación (NO NEGOCIABLES):",
      "- Si la transcripción NO menciona explícitamente la industria del cliente, devolvé `Otros`. NO INVENTES.",
      "- Si no hay una objeción clara, devolvé `Ninguna`. NO INVENTES.",
      "- Si el plazo de compra no es explícito, devolvé `Indefinido`. NO INVENTES.",
      "- NUNCA inventes datos. Si la información no está en la transcripción, usá el valor 'escape hatch' correspondiente.",
    ].join("\n");
  }

  private formatFewShots(): string {
    if (this.fewShots.length === 0) {
      return "";
    }
    const separator = "---";
    const rendered = this.fewShots.map((example) =>
      [
        `Transcripción: ${example.transcript}`,
        `Clasificación esperada: ${JSON.stringify(example.classification, null, 2)}`,
      ].join("\n"),
    );
    return [
      "Ejemplos few-shot (estudialos antes de clasificar):",
      separator,
      rendered.join(`\n${separator}\n`),
      separator,
    ].join("\n");
  }

  private formatOutputReminder(): string {
    return [
      "Formato de salida:",
      "- Emitís un único objeto JSON que cumple el schema provisto por Structured Outputs.",
      "- `reasoning` va PRIMERO. Después, las 8 dimensiones categóricas con valores EXACTOS de las listas permitidas. Al final, `needsSummary` y `nextSteps` respetando el rango de palabras.",
    ].join("\n");
  }
}
