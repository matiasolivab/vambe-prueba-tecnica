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
 *    hard-coded with the exact escape-hatch wording for `Otros`, `Ninguna`
 *    — prudence becomes an obligation, not an option.
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
      this.formatPerDimensionRules(),
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
      "Tu tarea es extraer 8 dimensiones estructuradas por cada transcripción.",
    ].join(" ");
  }

  private formatChainOfThought(): string {
    return [
      "Chain-of-Thought (OBLIGATORIO):",
      "- Emitís el campo `reasoning` PRIMERO, antes de cualquier valor categórico.",
      "- En `reasoning` explicás tu análisis de la transcripción: qué señales encontraste para industria, tamaño, pain point, objeción, origen del lead y sentiment.",
      "- Recién después asignás los valores. Esto mejora la accuracy en transcripciones ambiguas (~10-15%).",
    ].join("\n");
  }

  private formatDimensions(): string {
    const categoricalLines = [
      `- industry: [${INDUSTRIES.join(", ")}]`,
      `- companySize: [${COMPANY_SIZES.join(", ")}]`,
      `- mainPainPoint: [${MAIN_PAIN_POINTS.join(", ")}]`,
      `- keyObjection: [${KEY_OBJECTIONS.join(", ")}]`,
      `- leadSource: [${LEAD_SOURCES.join(", ")}]`,
      `- sentiment: [${SENTIMENTS.join(", ")}]`,
    ];
    const qualitativeLines = [
      "- needsSummary: 50-100 palabras. Resumen conciso de necesidades específicas del cliente.",
      "- nextSteps: 25-75 palabras. Próximos pasos acordados o sugeridos.",
    ];
    return [
      "Dimensiones a extraer (8 en total — 6 categóricas + 2 cualitativas):",
      ...categoricalLines,
      ...qualitativeLines,
    ].join("\n");
  }

  private formatAntiHallucinationRules(): string {
    return [
      "Reglas anti-alucinación (NO NEGOCIABLES):",
      "- Si la transcripción NO menciona explícitamente la industria del cliente, devolvé `Otros`. NO INVENTES.",
      "- Si no hay una objeción clara, devolvé `Ninguna`. NO INVENTES.",
      "- Si la transcripción NO menciona explícitamente cómo llegó a Vambe, usá `No Mencionado`. NUNCA inventes un canal.",
      "- NUNCA inventes datos. Si la información no está en la transcripción, usá el valor 'escape hatch' correspondiente.",
      "- IMPORTANTE: las reglas anti-alucinación son PRUDENCIA, no pesimismo. Si la transcripción deja señal implícita pero clara, aplicá las reglas por dimensión de más abajo; no caigas por defecto al escape hatch cuando la señal existe.",
    ].join("\n");
  }

  /**
   * Per-dimension discrimination rules. Drafted after measuring the baseline
   * prompt against the ground-truth fixture (task 4.2) — the rules below
   * target the specific error patterns diagnosed there (Mid-market
   * under-classification, symptom-vs-cause confusion on mainPainPoint, and
   * positivity bias on sentiment). See `docs/ARCHITECTURE.md` §13 rule 13:
   * bump `CLASSIFIER_VERSION` whenever this section changes.
   */
  private formatPerDimensionRules(): string {
    return [
      "Reglas por dimensión (usá estos criterios discriminadores):",
      "",
      "industry (mapeá el sector explícito a la taxonomía — NO caigas a `Otros` si hay señal clara):",
      "- \"tienda online\", \"e-commerce\", \"tienda en línea\" de productos de consumo → `E-commerce`.",
      "- \"clínica\", \"salud\", \"pacientes\", \"odontológica\", \"médica\" → `Salud`.",
      "- \"software\", \"plataforma SaaS\", \"empresa de tecnología\" que VENDE tecnología → `Tecnología`.",
      "- \"firma de consultoría\", \"asesoría financiera\", \"consultora\" → `Consultoría` o `Servicios Financieros` según el foco.",
      "- \"bienes raíces\", \"inmobiliaria\", \"propiedades\" → `Real Estate`.",
      "- \"energía renovable\", \"productos orgánicos\", \"sostenibilidad\", \"bienestar\" → `Hogar/Sostenibilidad`.",
      "- \"arquitectura\", \"estudio de diseño\", \"agencia creativa\", \"servicios profesionales\" (B2B no financiero) → `Servicios Profesionales`.",
      "- \"logística\", \"transporte\", \"envíos\" (como actividad principal, no complemento) → `Logística`.",
      "- \"educación\", \"universidad\", \"institución educativa\", \"becas\" → `Educación`.",
      "- Solo usá `Otros` si el sector NO encaja en ninguna categoría (p. ej. restaurantes, catering, turismo, ONG).",
      "",
      "companySize:",
      "- `Startup`: menciona \"startup\" o equipo pequeño (<10) operando un producto único emergente.",
      "- `PYME`: operación local/regional, dueño presente en conversación, volumen moderado (<150 consultas/sem o <100/día en picos).",
      "- `Mid-market`: operación multi-país/multi-sede, cartera B2B internacional, O volumen ≥150 consultas/sem (o ≥200 diarias en picos, o ≥250/día en régimen). Expansión internacional reciente = Mid-market. \"cartera de clientes a nivel internacional\" con crecimiento ≥40% = Mid-market.",
      "- `Enterprise`: múltiples divisiones, operación continental/global, 1000+ interacciones/semana, mención de board corporativo.",
      "- Heurística práctica: si mencionan expansión internacional, operaciones internacionales, clientes en múltiples países, subí a Mid-market aunque el volumen base sea moderado.",
      "",
      "leadSource (canal por el cual el cliente descubrió Vambe — inferí solo desde el texto):",
      "- `Búsqueda Online`: el cliente dice que buscó online / Google / artículo web / encontró buscando (\"buscaba en Google\", \"encontré un artículo\", \"estuve buscando una herramienta\").",
      "- `Recomendación`: recomendación personal explícita (\"un colega/compañero/amigo/partner me lo recomendó\", \"un cliente nuestro nos habló\", \"fulano mencionó Vambe\").",
      "- `Publicidad`: anuncio pagado EXPLÍCITO (\"vi un anuncio\", \"un ad\", \"sponsored\", \"en Google Ads\", \"en LinkedIn Ads\", \"publicidad\"). Requiere mención literal de publicidad/anuncio/ad.",
      "- `Outbound`: Vambe inició el contacto (\"me escribieron\", \"me llamaron\", \"recibí un email de ustedes\", \"tu SDR me contactó\", \"ustedes nos presentaron\").",
      "- `Otros`: canal MENCIONADO pero que no encaja en las 4 categorías anteriores (conferencias, ferias, seminarios, workshops, publicaciones orgánicas en LinkedIn/blogs sin mención de anuncio pagado).",
      "- `No Mencionado`: la transcripción NO dice cómo el cliente llegó a Vambe. Escape hatch para silencio absoluto.",
      "- DISCRIMINADOR CLAVE `Otros` vs `No Mencionado`: `Otros` = canal MENCIONADO-pero-no-encuadra. `No Mencionado` = canal SILENCIADO. Si dudas entre los dos, `No Mencionado` gana.",
      "- DISCRIMINADOR CLAVE `Publicidad` vs `Otros`: publicación orgánica en LinkedIn / post de fundador / artículo de blog = `Otros` (no es publicidad pagada). Solo `Publicidad` cuando hay palabra literal de anuncio/ad/sponsored.",
      "",
      "mainPainPoint (`Volumen Repetitivo` es el DEFAULT fuerte — solo desplazalo con señales INEQUÍVOCAS):",
      "- `Volumen Repetitivo`: el problema ES la repetición misma. Cubre TODOS estos casos: \"consultas repetitivas\", \"preguntas frecuentes\", \"mismas preguntas\", volumen alto con temas homogéneos. DEFAULT cuando hay volumen elevado sin las señales específicas de las otras causas. Ante duda entre Volumen Repetitivo y otra causa, gana Volumen Repetitivo.",
      "- `Variabilidad Estacional`: aplica SOLO cuando el régimen normal se absorbe Y hay mención EXPLÍCITA de picos diferenciados (\"normalmente X, pero en temporada/pico/promoción se duplica/triplica\", \"durante admisiones\", \"en temporada alta\"). Si el volumen ya es alto de forma CONTINUA, NO es este aunque haya promociones.",
      "- `Integración Técnica`: aplica SOLO cuando la integración con un sistema ESPECÍFICO (base de datos de propiedades, sistema de citas/reservas, API, CRM, plataforma de e-commerce propia, sistema de tickets interno) es el REQUISITO CENTRAL y recurrente del pedido, mencionado como crítico. Si la integración es solo un \"nice-to-have\" o un complemento, NO es este. Ejemplo fuerte: \"necesitamos que se integre con nuestra base de datos de propiedades\" (v.soto). Ejemplo débil (NO cuenta): \"valoramos que se integre con nuestros sistemas\" como comentario final.",
      "- `Consultas Especializadas`: el problema es la complejidad/especialización de la respuesta (regulaciones multi-país, legal, técnico profundo), no el volumen.",
      "- `Equipo Saturado`: equipo explícitamente pequeño vs crecimiento. Requiere mención de \"equipo pequeño\", \"no damos abasto\" O contexto de startup con crecimiento exponencial. El foco es el gap de headcount, no el volumen repetitivo.",
      "- `Respuestas Lentas`: cliente espera tiempo real/inmediatez (\"actualizaciones en tiempo real\", \"respuesta inmediata\") y el equipo no llega.",
      "- `Pérdida de Personalización`: miedo explícito a perder tono/voz de marca al automatizar; el dolor es anticipado, no actual.",
      "- Orden de precedencia (solo cuando la señal específica es INEQUÍVOCA): Variabilidad Estacional (picos explícitos) > Integración Técnica (sistema específico obligatorio) > Consultas Especializadas > Equipo Saturado (equipo pequeño explícito) > Respuestas Lentas > Pérdida de Personalización > Volumen Repetitivo. Ante duda, Volumen Repetitivo gana.",
      "",
      "sentiment (tono del cierre del cliente):",
      "- `Neutro`: tono informativo/analítico/exploratorio. DEFAULT cuando el cliente DESCRIBE la propuesta de valor sin comprometerse (\"nos llamó la atención su capacidad para\", \"consideramos fundamental\", \"nos pareció interesante\", \"nos gustaría explorar\"). Incluso si el lenguaje enumera virtudes, mientras el compromiso propio no sea activo, es Neutro.",
      "- `Positivo`: cierre con valoración ACTIVA. El cliente usa primera persona con intención propia (\"estamos interesados en\", \"nos interesa [la solución/implementar]\", \"valoramos mucho\", \"gracias por la reunión\", \"creemos que es LA solución\"). Requiere compromiso propio, no solo enumeración de virtudes.",
      "- `Negativo`: frustración, resistencia, desacuerdo explícito, objeción bloqueante.",
      "- REGLA: no marques `Positivo` cuando el cliente solo describe virtudes sin intención activa de avanzar. Compromiso propio explícito ⇒ Positivo; descripción analítica de la propuesta ⇒ Neutro.",
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
      "- `reasoning` va PRIMERO. Después, las 6 dimensiones categóricas con valores EXACTOS de las listas permitidas. Al final, `needsSummary` (50–100 palabras) y `nextSteps` (25–75 palabras).",
    ].join("\n");
  }
}
