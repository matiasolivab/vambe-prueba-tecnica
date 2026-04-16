# Arquitectura — Decisiones y Razones

> Registro vivo de decisiones arquitectónicas. Cada entrada: **decisión** + **por qué SÍ** + **por qué NO** las alternativas. Terso, sin relleno.

---

## 1. Stack: Next.js 16 full-stack (TypeScript + Tailwind 4 + pnpm)

**Decisión:** Todo el producto corre en un solo proyecto Next.js (App Router + Server Actions + API routes).

**Por qué SÍ:**
- Tipado end-to-end (compartir tipos entre servidor y cliente sin ceremonia).
- Un repo, un deploy, un pipeline → velocidad máxima para 1 semana.
- Next.js 16 + React 19 + Server Actions = menos boilerplate que cualquier alternativa.
- Vercel deploy en 30 segundos, free tier suficiente.

**Alternativas descartadas:**
- **Python (FastAPI / Streamlit)** → no hay ML real, solo llamadas REST al LLM. TS con Zod gana en tipado.
- **NestJS** → overkill para 1 semana. Burn time en boilerplate vs. producto.
- **SvelteKit / Remix / Astro** → ganancia marginal, riesgo innecesario.

---

## 2. Monolito Next.js, NO separar backend

**Decisión:** El backend vive dentro de Next.js (API routes + Server Actions). No hay servicio Node.js separado.

**Por qué SÍ:**
- Un arquitecto senior elige la solución más simple que resuelve el problema bien.
- Menos complejidad = menos superficie de bug = más tiempo en producto.
- Boundaries claros se expresan con interfaces internas — no hacen falta procesos separados.

**¿Qué justificaría separar backend? → NADA de esto aplica acá:**
- Múltiples clientes (web + mobile + API pública) → **no aplica**.
- Procesamiento distribuido / workers con colas → **60 filas no lo requieren**.
- Equipos distintos en front y back → **soy uno solo**.
- Escalar front y back independientemente → **irrelevante en demo**.

**Regla:** Si mañana hace falta separar, los dominios ya están aislados por Screaming Architecture (ver #3). Se extrae sin dolor.

---

## 3. Screaming Architecture + Clean Code

**Decisión:** Carpetas organizadas por **dominio de negocio**, no por tipo técnico. Cada dominio con capas internas.

**Estructura del `src/`:**
```
src/
├── clients/         # Cliente y su data core
├── transcripts/     # Reuniones y transcripciones
├── classification/  # Pipeline LLM → dimensiones
├── analytics/       # Métricas y agregaciones
├── ingestion/       # Upload + parsing de CSV
├── shared/          # SOLO lo verdaderamente transversal
└── app/             # Next.js routes (thin — solo orquesta)
```

**Capas dentro de cada dominio:**
- `domain/` — entidades, value objects, tipos, errores de dominio
- `application/` — casos de uso (pure functions, sin I/O directo)
- `infrastructure/` — adapters: DB, LLM, parsers, HTTP
- `ui/` — componentes React específicos del dominio

**Por qué SÍ:**
- Al abrir `src/` se entiende QUÉ hace la app, no QUÉ framework usa.
- Dependencia apunta hacia adentro: `ui` → `application` → `domain`. `infrastructure` implementa interfaces de `application`.
- Testeable: `application` no conoce React ni Next.js.

**Por qué NO la estructura "por tipo" (components/, hooks/, utils/, lib/):**
- Grita "Next.js", no el negocio.
- Al crecer, `utils/` se vuelve basurero.
- Acopla todo por framework en vez de por responsabilidad.

---

## 4. Procesamiento LLM en runtime, NO batch offline

**Decisión:** La clasificación se ejecuta cuando el usuario sube el CSV, desde un endpoint del backend. No hay script Python offline.

**Por qué SÍ:**
- Demuestra capacidad de construir **un producto de AI end-to-end**, no solo un dashboard.
- La consigna dice "una aplicación", no "un script + un dashboard".
- Mostrar upload + clasificación + persistencia = propuesta de valor real.

**Por qué NO batch offline:**
- Un dashboard sobre data pre-procesada dice *"sé llamar a una API"*.
- Un pipeline en vivo dice *"sé construir productos de AI"*.
- En una empresa de AI, la segunda señal pesa muchísimo más.

**Mitigación del único punto técnico real (timeout serverless):**
- Procesamiento en chunks con progreso persistido en DB.
- SSE / streaming para progreso en la UI.
- Vercel Fluid Compute extiende timeouts si hiciera falta.

---

## 5. Base de datos: Postgres en Neon (free tier)

**Decisión:** Postgres serverless hosteado en Neon, accedido vía Drizzle ORM. Región `us-east-1` (misma que Vercel default). Uso del endpoint **pooled** (pgbouncer) para compatibilidad con Next.js serverless.

**Por qué SÍ:**
- Free tier cubre sobradamente la demo (0.5 GB + 191 hrs compute/mes; el proyecto usa ~0.01% del cupo).
- Postgres estándar: cero lock-in, cualquier ORM/driver funciona.
- Setup en 2 minutos, integración nativa con Vercel (env vars auto-inyectadas).
- Persistente entre deploys (vs. SQLite local en Vercel que es efímero).

**Por qué NO las alternativas:**
- **SQLite local** → filesystem efímero en Vercel serverless, se pierde data.
- **Turso (SQLite distribuido)** → viable pero menor ecosistema, Postgres gana en universalidad.
- **Supabase** → Postgres + auth + storage. Overkill: solo necesitamos DB.
- **Railway / Render Postgres** → pagos desde el día 1 o free tier más magro.

---

## 6. LLM: OpenAI GPT-4o-mini con Structured Outputs + Zod

**Decisión:** Clasificación y extracción de dimensiones vía OpenAI `gpt-4o-mini`, usando **Structured Outputs** con schema Zod. Una llamada por transcripción, respuesta tipada y validada end-to-end.

**Por qué SÍ:**
- Costo marginal: ~$0.15/1M tokens input. 60 transcripciones ≈ <$0.05 total.
- Structured Outputs nativo: el modelo NO puede devolver JSON inválido respecto al schema.
- Zod → TypeScript types automáticos. El mismo schema sirve para validar y tipar.
- Modelo sobrado para la tarea (classification + summarization en español).

**Por qué NO las alternativas:**
- **Groq (Llama 3.3)** → gratis y rápido, pero structured outputs menos maduro, latencia variable.
- **Gemini 2.0 Flash** → free tier generoso, pero ecosistema TS más débil.
- **Claude Haiku** → excelente calidad pero ~3x más caro sin ganancia real para classification.

---

## 7. Seed inicial: híbrido (data pre-procesada + upload en vivo)

**Decisión:** La app arranca con los 60 clientes del CSV ya clasificados (seed script al hacer setup). El botón "Subir CSV nuevo" sigue funcionando en runtime para demostrar la ingesta real.

**Por qué SÍ:**
- El evaluador abre el link → dashboard con data → **wow-factor inmediato**.
- Simultáneamente, puede subir otro CSV y ver el pipeline LLM funcionando en vivo.
- El seed NO es "batch offline" disfrazado: usa el mismo pipeline que el upload, solo que corre una vez en setup.

**Por qué NO las alternativas:**
- **App vacía hasta que suban CSV** → primera impresión vacía, el evaluador puede dudar si funciona.
- **Solo pre-seed sin upload runtime** → ya lo descartamos en decisión #4 (no muestra producto end-to-end).

---

## 8. Upload: merge por `email`

**Decisión:** Al subir un CSV, cada fila se **upsertea** usando `email` como clave natural. Si el email existe → actualiza (incluye re-clasificar si cambió la transcripción). Si no existe → inserta.

**Por qué SÍ:**
- Email es único por cliente y estable (vs teléfono que puede cambiar formato).
- Comportamiento predecible para el usuario: subir el mismo CSV dos veces no duplica.
- Permite iterar: corregir una transcripción en el CSV y re-subir.

**Por qué NO las alternativas:**
- **Reemplazo total (truncate + insert)** → destructivo, el usuario pierde data manual.
- **Append ciego** → duplica clientes, ensucia métricas.

---

## 9. Sin autenticación

**Decisión:** La app es una demo pública sin login ni control de acceso.

**Por qué SÍ:**
- Contexto: prueba técnica, no producto real en producción.
- Reduce scope en ~1 día de trabajo que no agrega señal al evaluador.
- El evaluador quiere ver AI + dashboard + arquitectura, no un flujo de login.

**Por qué NO meter auth:**
- Tiempo invertido en auth = tiempo NO invertido en el producto que sí se evalúa.
- Si mañana hace falta (producción real), se agrega limpio (Clerk / NextAuth) sin refactor.

---

## 10. Convenciones de Clean Code (obligatorias)

**Decisión:** Reglas estrictas aplicadas a TODO el código no-UI del proyecto. Las components de React quedan como funciones (idiomático), pero services/use-cases/repositories son CLASES.

**Reglas:**
- **Single Responsibility Principle.** Una clase / función hace UNA cosa. Si el nombre tiene "y" o "or" → se parte.
- **Funciones cortas.** Límite duro: 20 líneas por método. Si se pasa → extraer un método privado.
- **Nada de funciones sueltas para servicios.** Los dominios exponen CLASES (`TranscriptClassifier`, `ClientRepository`, `MetricsCalculator`) con métodos. No archivos sueltos de helpers.
- **Visibilidad explícita en cada método.** `public` / `private` declarado, sin excepciones. Hace el contrato legible de un vistazo.
- **Inyección de dependencias por constructor.** Los services reciben sus colaboradores (LLM client, repo, clock) como params del constructor. Cero `new` dentro de métodos.
- **Errores de dominio tipados.** Errores de negocio son clases que extienden `DomainError` (ej: `InvalidCsvFormatError`). Nunca `throw new Error("string")` en application/domain.

**Estructura esperada de un service:**
```ts
export class TranscriptClassifier {
  constructor(
    private readonly llm: LLMClient,
    private readonly schema: ClassificationSchema,
  ) {}

  public async classify(transcript: string): Promise<Classification> {
    const prompt = this.buildPrompt(transcript)
    const raw = await this.llm.generateStructured(prompt, this.schema)
    return this.toDomain(raw)
  }

  private buildPrompt(transcript: string): string { /* ... */ }
  private toDomain(raw: unknown): Classification { /* ... */ }
}
```

**Por qué SÍ:**
- Clases con métodos `public`/`private` hacen el contrato explícito — el lector sabe qué es API y qué es interno sin leer implementaciones.
- DI por constructor = testeable sin mocking frameworks pesados (reemplazás el colaborador en el test).
- Métodos cortos obligan a nombrar bien → código auto-documentado.
- Errores tipados permiten `catch` discriminado por tipo, no por string parsing.

**Qué NO aplica esta regla:**
- Componentes React (functional components son idiomáticos y recomendados).
- Schemas Zod (son declaraciones).
- Configuración / constantes.

---

## 11. Identidad visual: dark-first, alineado a Vambe

**Decisión:** UI dark-mode por defecto, tipografía moderna sans-serif, acento **cyan eléctrico** (primario) y **dorado** (highlights de métricas clave). Estética futurista-corporate inspirada en vambe.ai.

**Por qué SÍ:**
- Vambe usa deep blacks + cyan + gold → nuestro dashboard se siente "pensado para ellos".
- Dark-first es estándar para dashboards de datos (menos fatiga visual, contraste superior en métricas).
- Señal no verbal al evaluador: *"miré el producto antes de construir"*.

**Paleta (tokens en Tailwind 4 `@theme`):**
- `background`: zinc-950 (base) + zinc-900 (cards)
- `primary`: cyan-400 / cyan-500 (CTAs, KPIs activos)
- `accent`: amber-400 (métricas destacadas, wins)
- `muted`: zinc-700 (bordes, separadores)
- `text`: zinc-50 / zinc-300 / zinc-500 (jerarquía)

**Stack UI:**
- **shadcn/ui** → componentes base (cards, tables, dialogs, forms).
- **Recharts** → gráficos (bar, pie, area). Suficiente y lightweight.
- **Lucide icons** → iconografía consistente.

---

## 12. Scope y nivel de tests para deadline de 2 días

**Decisión:** Scope congelado en lo definido hasta acá (dimensiones + 6 secciones del dashboard + upload en vivo + seed). Tests "recomendados" se implementan en versión **pragmática**:

- **Unit tests en `application/`** (casos de uso puros) y en services (classifier, metrics calculator) — mockeando colaboradores.
- **1 test de integración** del pipeline end-to-end (upload → clasificación → persistencia) con LLM mockeado.
- **1 e2e con Playwright** del golden path: abrir dashboard → ver métricas → abrir detalle de cliente.
- Se descarta cobertura exhaustiva (no agrega señal en 2 días).

**Por qué SÍ:**
- 2 días exige priorizar lo que el evaluador VE + lo que demuestra arquitectura limpia.
- Un test por capa (unit, integration, e2e) > cobertura del 80% con tests débiles.
- El valor de testear `application/` es doble: valida lógica Y demuestra que Clean Architecture es testeable sin levantar toda la app.

**Riesgos asumidos:**
- Sin tests exhaustivos de UI (se valida manualmente en dev).
- Sin tests de infraestructura real (la DB se valida con integración mockeada).

---

## 13. Confiabilidad del LLM (anti-alucinación, anti-falla) — CRÍTICO

**Decisión:** El pipeline de clasificación implementa **9 capas de defensa** para garantizar que el LLM no alucine, no falle silenciosamente, y produzca respuestas correctas. Este es el componente más crítico del producto; su confiabilidad define la calidad de TODO el dashboard.

**Capas de defensa (todas obligatorias):**

**1. Structured Outputs (OpenAI) + Zod schema**
- `response_format: { type: "json_schema", json_schema: ... }` con `strict: true`.
- Garantía contractual: la respuesta ES JSON válido que matchea el schema. Si no puede generar uno válido, la API rechaza la respuesta. No hay JSON parsing manual.

**2. Enums cerrados en dimensiones categóricas**
- Los 8 campos categóricos son `z.enum([...])`. El modelo NO puede inventar valores nuevos.
- Categorías "escape hatch" explícitas: `"Otros"` en industry, `"Ninguna"` en objection, etc. Fuerzan al modelo a admitir "no sé" en vez de alucinar.

**3. Temperature = 0**
- Clasificación es determinística. Sin variabilidad creativa. Mismo input → mismo output (o cercano).

**4. System prompt con few-shot examples**
- Prompt incluye 2-3 transcripciones reales del CSV con su clasificación esperada.
- Ancla al modelo en el formato y criterios de la realidad del negocio.

**5. Reglas explícitas de "no sé" en el prompt**
- Instrucciones literales: *"Si la transcripción NO menciona explícitamente [X], devolvé [valor-Otros/Ninguna]. NO INVENTES."*
- Convierte la prudencia en obligación, no en opción.

**6. Validación de consistencia post-LLM en application/**
- Después de Zod, una `ClassificationValidator` (clase) chequea reglas de negocio: ej. si `buying_signal = "Muy Interesado"` y `sentiment = "Negativo"` → `inconsistencyWarning`.
- Los warnings se loggean pero no bloquean (permiten auditoría manual posterior).

**7. Retry con exponential backoff en el cliente LLM**
- `LLMClient` implementa retry 3x con delays 1s/2s/4s ante timeouts, rate limits (429), errores 5xx.
- El service `TranscriptClassifier` no se entera — ve solo éxito o fallo final.

**8. Aislamiento por fila (errores tipados, no tóxicos)**
- Si una fila falla después de todos los retries → se persiste con `classification_status: 'failed'` y el `error_message`.
- **El resto del batch continúa.** Una fila rota NUNCA tira abajo el pipeline completo.
- UI muestra las filas fallidas con opción de reintentar manualmente.

**9. Test harness con ground truth**
- 5-10 transcripciones del CSV clasificadas manualmente por mí como "verdad".
- Suite de tests compara la salida del `TranscriptClassifier` contra esas verdades.
- Métrica por dimensión: accuracy exacto en categóricas, similitud semántica en cualitativas.
- Umbral mínimo: **80% accuracy por dimensión**. Si no se alcanza → iterar el prompt antes de seedear los 60 clientes.

**Responsabilidad arquitectónica (Clean Architecture):**
- `classification/domain/` → Zod schemas, enums, errores tipados (`ClassificationFailedError`, `LLMTimeoutError`, `InvalidSchemaError`).
- `classification/application/` → `TranscriptClassifier` (caso de uso), `ClassificationValidator` (validación consistencia).
- `classification/infrastructure/` → `OpenAIClient` (adapter), `PromptBuilder` (construye el prompt con few-shots).

**Por qué SÍ este nivel de rigor:**
- El dashboard entero se alimenta de la salida del LLM. Una alucinación temprana corrompe toda la agregación.
- El evaluador de la prueba SABE reconocer un pipeline serio de uno improvisado.
- Convierte un componente probabilístico en uno predecible y auditable.

### Refuerzos adicionales (v2 del pipeline)

Tras revisión técnica externa, se añaden 4 capas/refinamientos críticos:

**10. Chain-of-Thought forzado antes del JSON (anti-degradación de razonamiento)**
- Basado en *"Let Me Speak Freely? A Study on the Impact of Format Restrictions on Performance of Large Language Models"* (2024) — obligar al LLM a ir directo a JSON estructurado degrada su razonamiento 10-15% en tareas ambiguas.
- Solución: el Zod schema incluye un campo **`reasoning: z.string()`** como **PRIMER campo** de la respuesta. El modelo debe explicar su análisis ANTES de emitir los valores categóricos.
- Beneficios: (a) sube la accuracy en transcripciones ambiguas, (b) trazabilidad gratis — cuando el classifier se equivoca, el `reasoning` explica el por qué.
- Costo marginal: ~100-200 tokens extra por clasificación (<$0.00003).

**11. Manejo de transcripciones largas (token budget)**
- Riesgo: un CSV subido en runtime puede traer transcripciones arbitrariamente largas. Con >8k tokens, `gpt-4o-mini` empieza a perder información del principio.
- Solución:
  - `TokenBudgetService` (clase) cuenta tokens con `tiktoken` antes de enviar.
  - Si `tokens > 8000` → truncado inteligente: primeros 70% + últimos 30%, con marker `[...TRUNCATED...]` en el medio + warning loggeado.
  - El warning queda persistido en DB (`truncated: boolean`) para auditoría.
- Se descarta pre-summarización con modelo secundario: complejidad no justificada para el scope actual; se deja como evolución futura si el patrón de uso lo amerita.

**12. Reglas de consistencia declarativas (no ad-hoc)**
- Las validaciones post-LLM (capa 6) se modelan como **tabla de reglas**, no como checks sueltos.
- Formato:
```ts
type InconsistencyRule = {
  readonly name: string
  readonly severity: 'warning' | 'error'
  readonly matches: (c: Classification) => boolean
  readonly message: (c: Classification) => string
}

const INCONSISTENCY_RULES: readonly InconsistencyRule[] = [
  {
    name: 'signal_vs_sentiment',
    severity: 'warning',
    matches: (c) => c.buying_signal === 'Muy Interesado' && c.sentiment === 'Negativo',
    message: (c) => `Señal de compra alta pero sentiment negativo — revisar manualmente.`,
  },
  // ...más reglas aquí
]
```
- Beneficio: cuando se agregue la dimensión 11, no se toca `ClassificationValidator` — solo se suma una fila a la tabla. **Open/Closed Principle aplicado.**

**13. Prompt & model versioning (trazabilidad auditable)**
- Cada fila clasificada guarda en DB las columnas:
  - `prompt_version` — semver controlado por nosotros (ej `1.0.0`, `1.1.0`). Se bumpea ante cualquier cambio del system prompt o schema.
  - `model_version` — el identificador exacto que devuelve OpenAI en la respuesta (ej `gpt-4o-mini-2024-07-18`). Crucial porque OpenAI actualiza modelos sin previo aviso.
- Beneficios:
  - Si mañana cambian las métricas del dashboard → se puede identificar si fue por data nueva, prompt nuevo, o cambio del modelo upstream.
  - Permite re-clasificar selectivamente: *"re-procesá todas las filas con prompt < 1.2.0"*.
  - Cero ambigüedad en audits.
- Constante `CLASSIFIER_VERSION` vive en `classification/domain/version.ts`. El `TranscriptClassifier` la lee y estampa cada resultado.

---
