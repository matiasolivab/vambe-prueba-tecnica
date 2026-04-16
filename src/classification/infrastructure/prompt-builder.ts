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
      "- IMPORTANTE: las reglas anti-alucinación son PRUDENCIA, no pesimismo. Si la transcripción deja señal implícita pero clara (p. ej. piloto acordado ⇒ timeline corto), aplicá las reglas por dimensión de más abajo; no caigas por defecto al escape hatch cuando la señal existe.",
    ].join("\n");
  }

  /**
   * Per-dimension discrimination rules. Drafted after measuring the baseline
   * prompt against the ground-truth fixture (task 4.2) — the rules below
   * target the specific error patterns diagnosed there (Mid-market
   * under-classification, Manager↔Fundador confusion, closure-vs-exploration
   * inversion on buyingSignal, symptom-vs-cause confusion on mainPainPoint,
   * positivity bias on sentiment, and over-triggering of `Indefinido` on
   * purchaseTimeline). See `docs/ARCHITECTURE.md` §13 rule 13: bump
   * `CLASSIFIER_VERSION` whenever this section changes.
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
      "purchaseTimeline (distinguí interés activo de interés exploratorio):",
      "- `Urgente (<2 sem)`: lenguaje de inmediatez (\"cuanto antes\", \"urgente\", \"ya mismo\", \"lo necesitamos esta semana\").",
      "- `Corto (2-8 sem)`: la reunión cierra con intención ACTIVA de implementar. Señales concretas: \"estamos interesados en\", \"nos interesa [la solución/implementar]\", \"nos interesa una solución que\", \"creemos que podría ser LA solución que necesitamos\", pedido explícito de demo/piloto/cotización, \"queremos implementar\". El interés se verbaliza como intención propia, no como descripción de la plataforma.",
      "- `Largo (2+ meses)`: mención explícita de trimestres, próximo año, proyectos largos, presupuestos anuales.",
      "- `Indefinido`: DEFAULT cuando la conversación es exploratoria/informativa. Aplica cuando el cliente describe la propuesta de valor de Vambe en tercera persona sin comprometerse (\"nos llamó la atención su capacidad para X\", \"consideramos fundamental Y\", \"nos interesa la idea de Z\") y NO hay pedido concreto de próximo paso. Cuando el cliente enumera virtudes de la plataforma sin decir \"nos interesa implementar\" / \"estamos interesados en\" ⇒ Indefinido.",
      "- Heurística discriminante: \"nos interesa [la solución/implementar/esta tecnología]\" = Corto. \"nos llamó la atención\" / \"nos interesa la idea\" / \"consideramos que podría\" = Indefinido.",
      "",
      "companySize:",
      "- `Startup`: menciona \"startup\" o equipo pequeño (<10) operando un producto único emergente.",
      "- `PYME`: operación local/regional, dueño presente en conversación, volumen moderado (<150 consultas/sem o <100/día en picos).",
      "- `Mid-market`: operación multi-país/multi-sede, cartera B2B internacional, O volumen ≥150 consultas/sem (o ≥200 diarias en picos, o ≥250/día en régimen). Expansión internacional reciente = Mid-market. \"cartera de clientes a nivel internacional\" con crecimiento ≥40% = Mid-market.",
      "- `Enterprise`: múltiples divisiones, operación continental/global, 1000+ interacciones/semana, mención de board corporativo.",
      "- Heurística práctica: si mencionan expansión internacional, operaciones internacionales, clientes en múltiples países, subí a Mid-market aunque el volumen base sea moderado.",
      "",
      "buyingSignal (usá la MISMA heurística que purchaseTimeline):",
      "- `Muy Interesado`: la conversación termina con intención ACTIVA. Señales: \"estamos interesados en\", \"nos interesa [la solución/implementar]\", \"valoramos mucho\", \"gracias por la reunión\", pedido explícito de demo/piloto/cotización, \"creemos que podría ser LA solución que necesitamos\", \"queremos implementar\". El cliente SE COMPROMETE con la propuesta.",
      "- `Evaluando`: el cliente DESCRIBE la propuesta de valor sin comprometerse (\"nos llamó la atención su capacidad para X\", \"consideramos fundamental Y\", \"nos interesa la idea\", \"nos pareció una opción interesante\", \"nos gustaría explorar cómo\"). Tono descriptivo/analítico. El interés se formula en tercera persona sobre la plataforma, no como intención propia.",
      "- `Tibio`: interés leve, dudas sin resolver, preguntas genéricas sin caso de uso definido.",
      "- `Frío`: desinterés explícito, abandono, objeción bloqueante no resuelta.",
      "- DISCRIMINADOR CLAVE: \"nos interesa [la solución/implementar/esta herramienta]\" = Muy Interesado. \"nos llamó la atención\" / \"nos interesa la idea\" / \"consideramos que podría\" / \"nos pareció interesante\" = Evaluando. La diferencia es sutil: compromiso propio vs descripción del valor.",
      "",
      "decisionMakerRole (el TIPO de empresa manda: en firmas profesionales boutique el dueño/partner es el default):",
      "- `CEO/Fundador`: aplica en TODOS estos casos:",
      "  (a) Verbos posesivos directos: \"dirijo\", \"mi empresa\", \"fundé\", \"soy dueño\".",
      "  (b) Startup o PYME con lenguaje de primera persona hablando de la empresa como un todo (\"nuestra clínica ha crecido\", \"nuestra tienda\", \"nuestra firma de consultoría\", \"nuestra empresa de bienes raíces\").",
      "  (c) Firmas profesionales boutique/medianas con voz institucional (consultoras, inmobiliarias, firmas de arquitectura, firmas de abogados, clínicas, estudios creativos) donde el interlocutor habla de \"nuestra firma/consultora/estudio\" como un todo ⇒ es partner/socio/director ⇒ CEO/Fundador. Esto aplica AUNQUE sea Mid-market por volumen si la estructura es de firma profesional.",
      "- `Manager de Área`: aplica SOLO cuando hay señales claras de mando intermedio en una corporación más grande:",
      "  (a) El interlocutor distingue \"mi área/equipo/departamento\" como un subconjunto dentro de una organización mayor.",
      "  (b) Menciona múltiples áreas o jerarquía corporativa explícita.",
      "  (c) Lenguaje de ejecución operativa dentro de Mid-market sin voz de dueño de la firma.",
      "  Ejemplo: \"nuestro equipo actual se enfrenta a... en el área de atención al cliente\" dentro de una empresa grande con operaciones internacionales ⇒ Manager.",
      "- `Comité`: decisión colectiva explícita (\"el comité\", \"vamos a presentar al board\", \"evaluaremos internamente entre varias áreas\").",
      "- `Analista/Coordinador`: rol operativo técnico de primera línea (\"me encargo del soporte\", \"en mi área de sistemas\", \"soy responsable de atención al cliente\"). También aplica a roles internos de coordinación en instituciones (educación, admisiones) donde el interlocutor menciona que el tema vino de una \"reunión interna\" entre pares.",
      "- REGLA DE ORO: si la empresa es una firma profesional boutique (consultora, inmobiliaria, arquitectura, abogados, clínica PYME) y el interlocutor habla en primera persona como representante de la firma, es CEO/Fundador por default. Solo bajalo a Manager si hay señal CORPORATIVA explícita (múltiples áreas, dirección separada, mando intermedio).",
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
      "sentiment (acompaña a buyingSignal):",
      "- `Neutro`: tono informativo/analítico/exploratorio. DEFAULT cuando el cliente DESCRIBE la propuesta de valor sin comprometerse (\"nos llamó la atención su capacidad para\", \"consideramos fundamental\", \"nos pareció interesante\", \"nos gustaría explorar\"). Incluso si el lenguaje enumera virtudes, mientras el compromiso propio no sea activo, es Neutro.",
      "- `Positivo`: cierre con valoración ACTIVA. El cliente usa primera persona con intención propia (\"estamos interesados en\", \"nos interesa [la solución/implementar]\", \"valoramos mucho\", \"gracias por la reunión\", \"creemos que es LA solución\"). Requiere compromiso propio, no solo enumeración de virtudes.",
      "- `Negativo`: frustración, resistencia, desacuerdo explícito, objeción bloqueante.",
      "- REGLA: sentiment debe ALINEARSE con buyingSignal. Muy Interesado ⇒ Positivo. Evaluando ⇒ Neutro. Nunca marques Positivo cuando el cliente solo describe virtudes sin intención activa de avanzar.",
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
