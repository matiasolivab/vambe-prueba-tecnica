# Vambe — Análisis de ventas con IA

La aplicación recibe un CSV con transcripciones de llamadas de venta y genera métricas accionables: tasa de cierre por vendedor, pain points más frecuentes, objeciones recurrentes, industrias que convierten mejor y más. La clasificación la hace `gpt-4o-mini` en vivo, con respuestas estructuradas validadas.

Construida con **Next.js 16 (App Router, React 19), TypeScript, Tailwind 4, Drizzle ORM sobre Postgres (Neon), OpenAI, Vitest y Playwright**.

---

## Cómo correrlo en local

Necesitas Node 20+, `pnpm`, una base Postgres (el free tier de Neon alcanza de sobra) y una API key de OpenAI.

```bash
# 1. Instalar
pnpm install

# 2. Variables de entorno
cp .env.example .env.local
# Edita .env.local y completa DATABASE_URL + OPENAI_API_KEY

# 3. Crear las tablas
pnpm db:push

# 4. Seed: procesa data/vambe_clients.csv y clasifica los 60 clientes
pnpm seed

# 5. Arrancar
pnpm dev
# → http://localhost:3000
```

### Variables de entorno

| Variable | ¿Requerida? | Default | Qué hace |
|---|---|---|---|
| `DATABASE_URL` | sí | — | Cadena de conexión a Postgres (usa el endpoint pooled de Neon). |
| `OPENAI_API_KEY` | sí | — | Key de OpenAI con acceso a `gpt-4o-mini`. |
| `UPLOAD_PASSWORD` | no | `pruebavambe123` | Contraseña del upload de CSV, para evitar subidas ajenas que consuman créditos de OpenAI. |

### Scripts

| Comando | Qué hace |
|---|---|
| `pnpm dev` | Dev server con hot reload. |
| `pnpm build` / `pnpm start` | Build y arranque de producción. |
| `pnpm typecheck` | Chequeo de tipos. |
| `pnpm lint` | ESLint. |
| `pnpm test` | Corre toda la suite de unit + integration (Vitest). |
| `pnpm db:studio` | Drizzle Studio para explorar las tablas. |
| `pnpm seed` | Corre el pipeline de ingesta sobre el CSV de ejemplo. |

### Subir un CSV desde la UI

El botón de upload del dashboard está protegido por contraseña para evitar que terceros consuman créditos de OpenAI. La contraseña por default es:

```
pruebavambe123
```

Se puede sobrescribir con la variable de entorno `UPLOAD_PASSWORD`.

---

## Arquitectura — la idea en corto

**Una sola app Next.js.** Frontend, API routes, server components y lógica de negocio conviven en un único proyecto. No existe un backend separado porque el alcance no lo justifica: más piezas solo agregarían complejidad sin ganancia real. Si en el futuro hiciera falta separar, los dominios ya están aislados y se pueden extraer sin refactor masivo.

**Carpetas organizadas por dominio de negocio, no por tipo técnico (Screaming Architecture).** La estructura de `src/` refleja qué hace la aplicación — clientes, clasificación, ingesta, analytics — antes que qué framework usa. Cada dominio tiene sus propias capas:

```
src/<dominio>/
  domain/          # entidades, value objects, errores del dominio
  application/     # casos de uso (puros, sin I/O)
  infrastructure/  # adapters: DB, LLM, HTTP, parsers
  ui/              # componentes React del dominio
```

La dependencia apunta siempre hacia adentro: la UI usa aplicación, la aplicación usa dominio, y la infraestructura implementa interfaces que define aplicación (Dependency Inversion). Así la lógica de negocio se puede testear sin necesidad de levantar Next.js entero.

**Servicios como clases, componentes como funciones.** Los casos de uso y adapters son clases con métodos `public`/`private` explícitos e inyección por constructor. El contrato queda claro de un vistazo y cada clase es testeable reemplazando sus colaboradores, sin necesidad de frameworks de mocking. Los componentes React permanecen como funciones, que es el patrón idiomático.

**Postgres en Neon, con Drizzle.** Postgres estándar, sin lock-in. Se utiliza el endpoint pooled por compatibilidad con serverless. El upsert al subir CSV se hace por `email` como clave natural: re-subir el mismo archivo actualiza las filas existentes en lugar de duplicarlas.

**La IA se ejecuta cuando llega el CSV, no en batch offline.** El pipeline de clasificación corre en runtime. La UI recibe el progreso en vivo por Server-Sent Events (`/api/upload`) con eventos `progress` / `done` / `error`. El seed inicial usa exactamente el mismo camino, no hay dos pipelines en paralelo.

**Server Components como default.** El dashboard llega con datos cargados en el primer paint. Los Client Components quedan reservados para donde hace falta estado o interacción (tabla, modal, upload, filtros).

**Sin autenticación.** El alcance es una demo pública, por lo que implementar login y control de acceso quedó fuera del objetivo. Lo único protegido es el endpoint de upload mediante una contraseña, para evitar subidas ajenas que consuman créditos de OpenAI.

---

## Confiabilidad del LLM

La clasificación es el corazón del producto: todo el dashboard se alimenta de la salida del modelo, por lo que una alucinación temprana contamina todas las agregaciones. El pipeline combina varias capas de defensa que actúan en conjunto:

- **Structured Outputs con schema estricto.** Se usa `response_format: json_schema` de OpenAI en modo `strict`, con un schema definido en Zod. El modelo no puede devolver un JSON que no cumpla el contrato; la API rechaza cualquier respuesta mal formada antes de que llegue al servidor. Zod además valida en runtime y provee los tipos de TypeScript a partir del mismo schema.
- **Enums cerrados con puerta de escape.** Las dimensiones categóricas están declaradas como listas cerradas (`z.enum([...])`), por lo que el modelo no puede inventar valores. Cada dimensión incluye un `"Otros"` o `"Ninguna"` explícito, de modo que cuando el modelo no tiene evidencia suficiente admita la ausencia en lugar de alucinar.
- **Chain-of-Thought forzado.** El primer campo del schema es `reasoning`, un string libre donde el modelo describe su análisis antes de emitir los valores categóricos. Esto mitiga la degradación que sufren los LLMs cuando se les obliga a ir directo a JSON estructurados, y además deja un log auditable del porqué de cada clasificación.
- **Temperature = 0.** La clasificación no requiere creatividad. Mismo input, mismo output.
- **Few-shot examples en el prompt.** El system prompt incluye 2-3 transcripciones reales con su clasificación esperada para anclar al modelo en el contexto del negocio.
- **Retry con backoff exponencial.** Ante 429, 5xx o timeout de OpenAI, el cliente reintenta 3 veces (1s / 2s / 4s). El caller solo ve éxito o fallo definitivo.
- **Aislamiento por fila.** Si una transcripción falla tras todos los reintentos, se persiste con `classificationStatus: 'failed'` y su mensaje de error, y el resto del batch continúa. La UI expone las fallidas junto con su motivo.
- **Token budget con `tiktoken`.** Antes de cada llamada se cuentan los tokens de la transcripción. Si supera los 8k, se aplica truncado inteligente dejando el 70% inicial y el 30% final, con un marker intermedio. La fila queda flaggeada con `truncated: true` para auditoría.
- **Reglas de consistencia declarativas.** Las validaciones post-LLM viven en una tabla de reglas (`INCONSISTENCY_RULES`), no en condicionales sueltos. Por ejemplo: si el sentiment es negativo pero la señal de compra es alta, se emite un warning. Agregar una regla nueva es sumar una fila a la tabla — Open/Closed Principle aplicado.
- **Prompt & model versioning.** Cada clasificación guarda `promptVersion` (semver interno) y `modelVersion` (el id exacto que devuelve OpenAI, por ejemplo `gpt-4o-mini-2024-07-18`). Esto permite re-clasificar selectivamente cuando cambia el prompt o el modelo upstream, y mantiene la trazabilidad de los audits.
- **Ground-truth harness.** Una suite (`pnpm test:gt`) compara la salida del classifier contra 5-10 transcripciones clasificadas manualmente. El umbral es 80% de accuracy por dimensión; si no se alcanza, el prompt se itera antes de seedear la DB.

---

## Cómo está organizado el repo

```
.
├── data/                   # CSV de ejemplo (60 clientes)
├── docs/                   # PRD
├── drizzle/                # migraciones generadas
├── scripts/                # seed + smoke checks de DB
├── src/
│   ├── analytics/          # KPIs, métricas temporales, gráficos
│   ├── app/                # rutas Next.js (pages + api/)
│   ├── classification/     # pipeline LLM (el núcleo)
│   ├── clients/            # dominio cliente + repo + tabla
│   ├── ingestion/          # parsing del CSV + servicio de upload
│   └── shared/             # lo verdaderamente transversal
└── tests/
    ├── integration/        # ground-truth + end-to-end con LLM mockeado
    └── fixtures/           # few-shots + ground-truth en JSON
```

---

## Trade-offs conocidos

Varias decisiones se tomaron conscientemente para mantener el alcance. Cada una tiene su camino de evolución si el producto crece:

- **Upload sincrónico.** Cada transcripción invoca al LLM y la request queda abierta mientras procesa. Con decenas o cientos de filas la latencia se hace notoria. La evolución natural es mover el pipeline a workers o una cola asíncrona (BullMQ, Inngest u otra) con el progreso persistido en DB, y que el frontend lo consuma por polling o WebSocket.
- **Paginación client-side.** La tabla de clientes trae todas las filas y las pagina en memoria (20 por página). Funciona bien hasta miles de filas; más allá corresponde mover `limit`/`offset` al repositorio y usar la URL como estado compartible.
- **Gate de contraseña en cliente solo cumple UX.** La protección real vive en el servidor: `/api/upload` valida `UPLOAD_PASSWORD` y devuelve 401 si no coincide. La constante del cliente actúa como filtro suave para evitar clicks accidentales.
- **Sin re-clasificación manual.** Si el modelo se equivocó en una fila, la corrección hoy consiste en editar el CSV y re-subirlo (el upsert por email actualiza la fila). Una UI dedicada a editar clasificaciones a mano quedó fuera del alcance.

---

## Deploy

El deploy está pensado para Vercel: basta con conectar el repositorio y cargar `DATABASE_URL` + `OPENAI_API_KEY` (opcionalmente `UPLOAD_PASSWORD`) como variables de entorno. Para poblar la DB de producción, se ejecuta `pnpm seed` una vez apuntando `DATABASE_URL` al endpoint de prod.
