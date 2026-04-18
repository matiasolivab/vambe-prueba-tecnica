# PRD — Categorización Automática y Dashboard de Métricas de Clientes

> **Proyecto:** Prueba técnica Vambe AI
> **Autor:** Matías Oliva
> **Fecha:** 2026-04-16
> **Deadline:** 2 días
> **Estado:** Aprobado para implementación

---

## 1. Contexto y problema

El equipo de ventas de Vambe AI acumula transcripciones de reuniones con clientes potenciales en un CSV. Esa información **está pero no es accionable**: no hay categorías, no hay segmentación, no hay forma de responder preguntas como *"¿qué objeciones están matando más deals?"* o *"¿qué vendedor cierra mejor en qué industria?"*.

Hoy, extraer insights de esas transcripciones requiere leerlas una por una. **No escala.**

### Solución
Una aplicación web que:
1. Procesa el CSV de clientes (upload en runtime o seed inicial).
2. Usa un LLM para **categorizar automáticamente** cada transcripción en dimensiones de negocio predefinidas.
3. Muestra métricas accionables en un dashboard interactivo, con filtros y drill-down.

---

## 2. Objetivos

### De producto
- **O1.** Convertir 60+ transcripciones en un dataset estructurado y consultable en minutos.
- **O2.** Responder 4 preguntas estratégicas del equipo de ventas:
  1. ¿Cuál es nuestra tasa de cierre por vendedor?
  2. ¿Qué industrias / tamaños de empresa convierten mejor?
  3. ¿Qué objeciones están matando más deals?
  4. ¿Qué pain points son los que mejor convertimos?
- **O3.** Permitir cargar CSVs nuevos y ver los insights actualizados sin tocar código.

### Técnicos
- **T1.** Pipeline LLM con **confiabilidad de nivel producto**: sin alucinaciones, con manejo de errores y test harness de ground truth (detalle: [ARCHITECTURE.md §13](./ARCHITECTURE.md#13-confiabilidad-del-llm-anti-alucinación-anti-falla--crítico)).
- **T2.** Código limpio bajo **Screaming Architecture + Clean Code** (detalle: [ARCHITECTURE.md §3, §10](./ARCHITECTURE.md)).
- **T3.** Cobertura de tests pragmática: unit + integración + 1 e2e del golden path.
- **T4.** Deploy funcional en Vercel con link público, seedeado con los 60 clientes del CSV entregado.

---

## 3. Usuarios y casos de uso

### Persona primaria: **Sales Leader en Vambe**
Responsable de performance del equipo de ventas. Necesita entender qué funciona, qué no, y dónde intervenir.

### Casos de uso
| ID | Caso de uso | Usuario hace | Aplicación responde |
|----|-------------|--------------|---------------------|
| UC1 | Ver KPIs globales | Abre el dashboard | Muestra tasa de cierre, total clientes, top vendedor, top pain point |
| UC2 | Comparar vendedores | Va a sección "Vendedores" | Ranking por tasa de cierre + performance por segmento |
| UC3 | Investigar objeciones | Va a sección "Objeciones" | Top objeciones en no-cerrados vs superadas en cerrados |
| UC4 | Filtrar clientes | Usa filtros (industria, vendedor, closed) | Tabla actualizada en vivo |
| UC5 | Ver detalle de cliente | Click en fila de la tabla | Modal con needs_summary + next_steps + transcripción original |
| UC6 | Cargar data nueva | Click "Subir CSV" | Sube archivo → ve progreso de clasificación → dashboard se refresca con los nuevos datos |

---

## 4. Alcance

### In scope
- Procesamiento del CSV entregado (60 clientes) como seed inicial.
- Upload de CSVs nuevos en runtime con clasificación en vivo.
- Clasificación LLM con las **8 dimensiones** definidas (§7).
- Dashboard con las **6 secciones** definidas (§8).
- Merge por email al re-subir CSV.
- Deploy público en Vercel.
- README + documentación de arquitectura y decisiones.

### Out of scope (explícito)
- **Autenticación / usuarios.** Demo pública.
- **Re-clasificación manual.** Si el LLM se equivoca, no hay UI de corrección (se re-sube el CSV corregido).
- **Export de data.** No hay botón "descargar CSV".
- **Multi-idioma.** Solo español (la data está en español).
- **Mobile-first.** Dashboard optimizado para desktop (puede ser usable en tablet, pero no es objetivo).
- **Notificaciones / alertas.** No hay sistema de alertas sobre métricas.
- **Histórico / versionado.** Una sola snapshot de los datos; al re-subir, se hace upsert.

---

## 5. Requisitos funcionales

### RF1 — Ingesta de CSV
- **RF1.1** El sistema acepta CSVs con las columnas exactas: `Nombre`, `Correo Electronico`, `Numero de Telefono`, `Fecha de la Reunion`, `Vendedor asignado`, `closed`, `Transcripcion`.
- **RF1.2** Si una columna falta o tiene nombre distinto → error claro al usuario, NO se inicia el procesamiento.
- **RF1.3** El upsert se hace por `email` (clave natural). Re-subir el mismo CSV actualiza, no duplica.
- **RF1.4** Cada fila se procesa de forma **aislada**: una fila con error no corta el batch.
- **RF1.5** La UI muestra progreso en vivo (N de M filas procesadas) vía SSE o polling.

### RF2 — Clasificación LLM
- **RF2.1** Por cada transcripción, el sistema extrae **8 dimensiones** (§7) + un campo `reasoning` vía OpenAI `gpt-4o-mini` + Structured Outputs + Zod.
- **RF2.2** Las 6 dimensiones categóricas están limitadas por enums cerrados. El LLM no puede devolver valores fuera de la lista.
- **RF2.3** El Zod schema fuerza **Chain-of-Thought**: el campo `reasoning` es el PRIMER campo de la respuesta, antes de las dimensiones. El modelo razona antes de clasificar (mitiga degradación por format restriction).
- **RF2.4** Si la API falla (timeout, rate limit, 5xx) → retry 3x con exponential backoff.
- **RF2.5** Si falla definitivamente → fila queda con `classification_status = 'failed'` + `error_message`. Visible en la UI.
- **RF2.6** Reglas de consistencia post-LLM son **declarativas** (tabla de reglas, no checks ad-hoc). Inconsistencias se persisten como `warnings[]` en la fila.
- **RF2.7** Antes de enviar al LLM, se cuenta tokens con `tiktoken`. Si supera 8000 tokens → truncado inteligente (primeros 70% + últimos 30%) con marker y flag `truncated: true` persistido.
- **RF2.8** Cada clasificación guarda `prompt_version` (semver interno) y `model_version` (id exacto devuelto por OpenAI) para trazabilidad y re-clasificación selectiva.

### RF3 — Dashboard de métricas
- **RF3.1** 6 secciones obligatorias (detalle en §8). Render server-side para cargar con data desde el primer paint.
- **RF3.2** Filtros globales (vendedor, industria, tamaño, closed) aplican a todas las secciones simultáneamente.
- **RF3.3** Click en cualquier fila de la tabla abre modal con detalle del cliente (needs_summary + next_steps + transcripción).
- **RF3.4** Búsqueda por nombre o email en la tabla.

### RF4 — Seed inicial
- **RF4.1** Existe un script `pnpm seed` que carga `data/vambe_clients.csv` y lo procesa por el mismo pipeline que el upload.
- **RF4.2** Al deployar, el seed se corre una vez contra la DB de producción para tener la demo lista.

---

## 6. Requisitos no funcionales

### RNF1 — Performance
- **RNF1.1** Dashboard carga en < 2s con los 60 clientes seedeados.
- **RNF1.2** Upload de 60 filas termina en < 90s (≤ 1.5s por clasificación promedio).
- **RNF1.3** Filtros aplican en < 200ms (agregaciones en la DB, no en cliente).

### RNF2 — Confiabilidad LLM
- **RNF2.1** Accuracy ≥ 80% por dimensión categórica contra ground truth (5-10 transcripciones labeladas manualmente).
- **RNF2.2** 0 respuestas con JSON inválido (garantizado por Structured Outputs).
- **RNF2.3** 0 valores fuera de enum (garantizado por schema).

### RNF3 — Costos
- **RNF3.1** Costo LLM por seed completo (60 transcripciones) < $0.10 USD.
- **RNF3.2** Costo de operación mensual (demo pública, uso ocasional) < $1 USD.

### RNF4 — Privacidad
- **RNF4.1** Las transcripciones se almacenan en Neon Postgres con TLS en tránsito y encryption at rest (default de Neon).
- **RNF4.2** No se exponen emails ni teléfonos en URLs ni logs.
- **RNF4.3** La `OPENAI_API_KEY` vive solo en env vars del servidor, nunca llega al cliente.

### RNF5 — Mantenibilidad
- **RNF5.1** Todo service/use-case/repository es una **clase con visibilidad explícita** (ver [ARCHITECTURE.md §10](./ARCHITECTURE.md)).
- **RNF5.2** Métodos ≤ 20 líneas.
- **RNF5.3** Errores de dominio son clases tipadas (extienden `DomainError`). Cero `throw new Error("string")` en application/domain.
- **RNF5.4** Carpetas organizadas por dominio (Screaming Architecture), no por tipo técnico.

### RNF6 — Observabilidad
- **RNF6.1** Logs estructurados (JSON) en server-side con nivel info/warn/error.
- **RNF6.2** Cada clasificación loggea: client email (hash), duración, status, tokens usados.
- **RNF6.3** Fallas de clasificación se loggean con stack trace y contexto de la fila.

---

## 7. Dimensiones de categorización

**8 dimensiones que el LLM extrae de cada transcripción.** (Decididas tras análisis del CSV — ver `engram://vambe/llm-dimensions`).

### 7.1 Categóricas (6) — para filtros y gráficos

| # | Campo | Tipo | Valores posibles |
|---|-------|------|------------------|
| 1 | `industry` | `enum` | Servicios Financieros, E-commerce, Consultoría, Salud, Educación, Logística, Servicios Profesionales, Tecnología, Eventos, Real Estate, Medios/Artes, Hogar/Sostenibilidad, Otros |
| 2 | `company_size` | `enum` | Startup, PYME, Mid-market, Enterprise |
| 3 | `main_pain_point` | `enum` | Volumen Repetitivo, Equipo Saturado, Respuestas Lentas, Pérdida de Personalización, Integración Técnica, Consultas Especializadas, Variabilidad Estacional |
| 4 | `key_objection` | `enum` | Especificidad Técnica, Integración, Desconfianza Automatización, Timing Bajo, Compliance, Ninguna |
| 5 | `buying_signal` | `enum` | Muy Interesado, Evaluando, Tibio, Frío |
| 6 | `sentiment` | `enum` | Positivo, Neutro, Negativo |

### 7.2 Cualitativas (2) — texto libre extraído por LLM

| # | Campo | Tipo | Longitud |
|---|-------|------|----------|
| 7 | `needs_summary` | `string` | 50-100 palabras — resumen de necesidades específicas del cliente |
| 8 | `next_steps` | `string` | 25-75 palabras — próximos pasos acordados o sugeridos |

### 7.3 Meta-campo: `reasoning` (no es dimensión, es traza)

Además de las 8 dimensiones, el schema incluye un campo **`reasoning: string`** como PRIMER campo de la respuesta del LLM (antes de los categóricos).

- **Propósito:** Chain-of-Thought forzado. El modelo debe explicar su análisis ANTES de emitir los valores categóricos.
- **Beneficios:**
  1. Sube accuracy en transcripciones ambiguas (~10-15% según paper *"Let Me Speak Freely?"* 2024).
  2. Trazabilidad: cuando el clasificador se equivoca, el `reasoning` explica por qué — se pueden iterar las reglas del prompt con evidencia.
- **No se muestra en el dashboard principal.** Queda en DB como parte de la traza de auditoría, accesible desde el modal de detalle del cliente si se quiere investigar.

### 7.4 Justificación de las dimensiones
- **Basadas en data real.** El análisis de las 60 transcripciones reveló patrones consistentes para estos 8 campos. No son genéricos.
- **Sesgadas a accionabilidad.** Cada dimensión responde a una pregunta de negocio: "¿dónde invertir? ¿quién cierra más? ¿qué nos frena?".
- **Cierres semánticos** (`Otros`, `Ninguna`) **evitan alucinaciones.** El LLM tiene siempre una opción válida cuando la info no está.

---

## 8. Métricas del dashboard (6 secciones)

### 8.1 — KPIs principales (tiles arriba)
- Total de clientes.
- **Tasa de cierre global** (%).
- Mejor vendedor (por tasa de cierre).
- Pain point más común.

### 8.2 — Performance de vendedores
- Ranking por tasa de cierre (bar chart).
- Volumen de reuniones por vendedor.
- Mejor vendedor por segmento (tabla cruzada: vendedor × industria).

### 8.3 — Análisis de cierre (núcleo del valor)
- Tasa de cierre por industria (bar).
- Tasa de cierre por tamaño de empresa (bar).
- Tasa de cierre por sentiment (bar).
- Tasa de cierre por buying_signal (bar).

### 8.4 — Por qué perdemos deals (key_objection)
- Top 5 objeciones en **no-cerrados** (horizontal bar).
- Objeciones superadas en **cerrados** (para ver qué es salvable).
- Pain point vs tasa de cierre (scatter / bar).

### 8.5 — Tabla de clientes (drill-down)
- Tabla con todos los clientes.
- Filtros: vendedor, industria, tamaño, closed, sentiment.
- Búsqueda por nombre/email.
- Click en fila → modal con `needs_summary` + `next_steps` + transcripción original.

### 8.6 — Ingesta (upload runtime)
- Botón "Subir CSV nuevo".
- Validación previa de headers.
- Progress bar en vivo (fila N de M).
- Toast de éxito/error.
- Refresh automático del dashboard al terminar.

---

## 9. Flujos de usuario

### Flujo 1 — Primera visita (seed ya corrido)
1. Usuario abre el link público.
2. Dashboard carga con 60 clientes seedeados.
3. Ve KPIs globales al instante.
4. Scrollea o filtra para explorar.
5. Click en cliente → ve detalle y transcripción.

### Flujo 2 — Upload de CSV nuevo
1. Usuario click "Subir CSV".
2. Modal con dropzone; arrastra o selecciona archivo.
3. Sistema valida headers → si falla, muestra error claro.
4. Si pasa, inicia procesamiento.
5. Progress bar muestra avance en vivo (SSE).
6. Al terminar, toast de éxito + dashboard se refresca.
7. Filas con error quedan listadas con opción de reintentar.

### Flujo 3 — Drill-down de cliente
1. Usuario filtra tabla por "no cerrados + industria Tecnología".
2. Click en una fila → modal.
3. Ve needs_summary + next_steps + transcripción completa (scrollable).
4. Cierra modal, sigue explorando.

---

## 10. Arquitectura técnica (resumen)

> Documentación completa: **[docs/ARCHITECTURE.md](./ARCHITECTURE.md)** (13 decisiones documentadas).

### Stack
- **Frontend + Backend:** Next.js 16 (App Router + Server Actions + API routes), React 19, TypeScript.
- **UI:** Tailwind 4, shadcn/ui, Recharts, Lucide.
- **DB:** Postgres en Neon (free tier, us-east-1, pooled endpoint), Drizzle ORM.
- **LLM:** OpenAI `gpt-4o-mini` con Structured Outputs + Zod.
- **Deploy:** Vercel (free tier).
- **Package manager:** pnpm.

### Estructura (Screaming Architecture)
```
src/
├── clients/         # Cliente: entity, repo, types
├── transcripts/     # Transcripciones y su parsing
├── classification/  # Pipeline LLM (el componente CRÍTICO)
├── analytics/       # Métricas agregadas
├── ingestion/       # Upload + CSV parsing + orquestación
├── shared/          # Errores base, logger, clock
└── app/             # Next.js routes (thin layer)
```

Cada dominio internamente:
```
{domain}/
├── domain/          # Entidades, schemas Zod, errores tipados
├── application/     # Casos de uso (clases con public/private)
├── infrastructure/  # Adapters DB, LLM, HTTP
└── ui/              # Componentes React del dominio
```

### Convenciones Clean Code (obligatorias)
- Services/use-cases/repositories son **clases**, no funciones sueltas.
- **Visibilidad explícita:** cada método `public` o `private`.
- **Inyección de dependencias por constructor.**
- **≤ 20 líneas por método.**
- **Errores tipados** que extienden `DomainError`.

---

## 11. Criterios de aceptación

### Funcionalidad
- [ ] Al abrir el link público, el dashboard muestra los 60 clientes seedeados.
- [ ] Filtros combinables funcionan en vivo (cambian métricas y tabla).
- [ ] Click en cliente abre modal con detalle + transcripción completa.
- [ ] Upload de CSV nuevo procesa en vivo, muestra progreso, hace upsert por email.
- [ ] CSV inválido (headers mal) muestra error claro sin procesar.
- [ ] Fila que falla en LLM queda marcada, el resto del batch continúa.

### Calidad de código
- [ ] Carpetas de `src/` organizadas por dominio, no por tipo técnico.
- [ ] Todos los services son clases con `public`/`private` explícito.
- [ ] No hay métodos > 20 líneas.
- [ ] No hay `throw new Error("string")` en `domain/` o `application/`.
- [ ] Dependencias inyectadas por constructor en todos los services.

### Confiabilidad LLM
- [ ] Test harness contra ground truth pasa con ≥ 80% accuracy por dimensión.
- [ ] 0 valores fuera de enum en DB (test de invariante).
- [ ] Retry automático verificable en tests con mock de fallo transitorio.
- [ ] Todas las clasificaciones tienen `reasoning` no vacío + `prompt_version` + `model_version` persistidos.
- [ ] Transcripción > 8k tokens se truncó correctamente y la fila tiene `truncated: true`.
- [ ] Regla de inconsistencia (señal alta + sentiment negativo) genera `warning` en la fila sin bloquear persistencia.

### Tests
- [ ] Unit tests de `application/` services corren y pasan.
- [ ] 1 test de integración del pipeline completo (LLM mockeado) pasa.
- [ ] 1 e2e de Playwright del golden path (dashboard + filtro + drill-down) pasa.

### Entrega
- [ ] Repo en GitHub con README claro.
- [ ] Link funcional de la app deployada.
- [ ] `docs/PRD.md` + `docs/ARCHITECTURE.md` presentes y actualizados.

---

## 12. Plan de entrega (2 días)

### Día 1 — Pipeline e infraestructura

**Mañana (4h)**
- [ ] Task #2: Setup infraestructura (Neon + Drizzle + shadcn + Tailwind theme Vambe).
- [ ] Task #3: Definir dominio (entidades, Zod schemas, Drizzle schema).

**Tarde (4h)**
- [ ] Task #4: Implementar `TranscriptClassifier` (OpenAI + Structured Outputs + retry).
- [ ] Task #11: Crear ground truth test harness + primera pasada de calibración del prompt.

**Noche (2-3h)**
- [ ] Task #5: `IngestionService` (parse CSV + orquesta clasificación).
- [ ] Task #6 (parcial): `ClientRepository` básico.
- [ ] Task #7: Correr seed contra DB local con los 60 clientes.

**🎯 Estado al final del Día 1:** pipeline LLM funcionando, 60 clientes clasificados en DB local, test harness ≥ 80% accuracy.

---

### Día 2 — Dashboard, deploy, docs

**Mañana (4h)**
- [ ] Task #6 (completar): `MetricsCalculator` con agregaciones para las 6 secciones.
- [ ] Task #8: API routes (`/api/upload`, `/api/clients`, `/api/metrics`).
- [ ] Task #9 (parcial): Layout del dashboard + KPIs + tabla de clientes.

**Tarde (4h)**
- [ ] Task #9 (completar): Secciones restantes del dashboard (vendedores, cierre, objeciones).
- [ ] Task #10: Upload flow UI con progreso en vivo (SSE).
- [ ] Task #12: Tests unit + integración + 1 e2e del golden path.

**Noche (2-3h)**
- [ ] Task #13: README completo + `docs/PRD.md` final + polish de `docs/ARCHITECTURE.md`.
- [ ] Task #14: Deploy a Vercel, seedeo contra DB de prod, smoke test del flujo completo.

**🎯 Estado al final del Día 2:** app deployada, link funcional, seedeada con los 60 clientes, upload en vivo funcionando, tests en verde, docs completas.

---

### Riesgos y mitigaciones

| Riesgo | Probabilidad | Impacto | Mitigación |
|--------|--------------|---------|------------|
| Prompt del LLM no logra 80% accuracy en primera pasada | Media | Alto | Ground truth test harness se corre ANTES del seed completo; iteración del prompt es barata con solo 10 transcripciones de verdad. |
| Timeout de Vercel serverless al procesar batch grande | Baja (60 filas) | Medio | Procesamiento fila por fila con persistencia incremental. Cada fila es su propia transacción. |
| Costo inesperado de OpenAI | Muy baja | Bajo | Estimado < $0.10 para el seed. Límite de gasto en dashboard de OpenAI. |
| Inconsistencia entre dimensiones (ej: sentiment vs signal) | Media | Bajo | `ClassificationValidator` loggea warnings; datos se persisten igual para auditoría. |
| No alcanzar todas las secciones del dashboard | Baja | Medio | Priorización: KPIs + tabla drill-down + sección objeciones son MUST; el resto es SHOULD. Si hay crunch, se bajan las secciones menos críticas. |

---

## 13. Fuera de este documento (referencias)

- **Decisiones arquitectónicas detalladas:** [docs/ARCHITECTURE.md](./ARCHITECTURE.md)
- **Análisis del CSV (patrones, industrias, vendedores, insights):** memoria `engram://vambe/stack-architecture`
- **Dimensiones finales y su justificación:** memoria `engram://vambe/llm-dimensions`
- **Estrategia anti-alucinación LLM:** memoria `engram://vambe/llm-reliability`
- **CSV fuente:** `data/vambe_clients.csv` (60 clientes, 63% tasa de cierre).

---

> **Nota final:** este PRD es un documento vivo. Cualquier cambio de scope durante la implementación se refleja acá y en `docs/ARCHITECTURE.md` con justificación.
