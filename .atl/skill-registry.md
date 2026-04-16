# Skill Registry — Vambe

**Generated**: 2026-04-16
**Persistence**: engram (topic_key `skill-registry`)

## Project Conventions (auto-loaded)

| File | Role |
|------|------|
| `AGENTS.md` | Repo-level rules — Next.js 16 breaking changes warning, force re-reading of `node_modules/next/dist/docs/` before coding |
| `CLAUDE.md` | Alias of `AGENTS.md` (via `@AGENTS.md`) |
| `docs/PRD.md` | Product requirements + acceptance criteria (source of truth for scope) |
| `docs/ARCHITECTURE.md` | 13 architecture decisions (source of truth for implementation) |

## User Skills — Relevant to this project

Triggers match against code context (file extensions / paths touched) OR task context (what the sub-agent will do).

| Skill | Triggers | When to inject |
|-------|----------|----------------|
| `engram:memory` | ALWAYS ACTIVE | Always — persistence protocol is mandatory |
| `branch-pr` | Creating a PR, opening a PR, preparing changes for review | When closing a change or ending a task batch that merits a PR |
| `issue-creation` | Creating a GitHub issue, reporting a bug, requesting a feature | If the user wants a GitHub issue for tracking |
| `judgment-day` | Adversarial dual review | If user requests deep review of a critical component (e.g. `TranscriptClassifier`) |
| `simplify` | Review changed code for reuse, quality, efficiency | After large implementation batches — especially classification pipeline |
| `skill-creator` | User wants to create a new skill | Only if explicitly asked |
| `update-config` | `settings.json` changes, hooks, permissions | Only if explicitly asked |

### Skills NOT applicable to this project
- `go-testing` — project is TypeScript, not Go
- `claude-api` — project uses **OpenAI** API (`gpt-4o-mini`), not Anthropic SDK
- `keybindings-help` — unrelated to Vambe feature work

## Compact Rules — inject into sub-agent prompts

### Rule block: `project/clean-code`
**When to inject**: any task that writes or reviews code in `src/` outside of React components.

```
- Services/use-cases/repositories are CLASSES with explicit public/private visibility on every method.
- Constructor-based dependency injection. No `new` inside methods.
- Methods ≤ 20 lines. Extract a private method if a method grows beyond that.
- Domain errors are typed classes extending `DomainError`. NEVER `throw new Error("string")` in domain/ or application/.
- React components remain functional components — the class convention does NOT apply to UI components.
```

### Rule block: `project/screaming-architecture`
**When to inject**: any task that creates or moves files under `src/`.

```
- Folders organized by business domain, NOT by technical type.
- Top-level domains: clients/, transcripts/, classification/, analytics/, ingestion/, shared/, app/.
- Each domain contains: domain/, application/, infrastructure/, ui/ (only if the domain has UI).
- Dependency direction: ui → application → domain; infrastructure implements interfaces from application.
- `shared/` holds ONLY truly transversal code (logger, base errors, clock). NOT a util bucket.
```

### Rule block: `project/nextjs-16`
**When to inject**: any task that touches `app/` routes, Server Actions, API routes, or Next-specific APIs.

```
- This is Next.js 16 — APIs, conventions, and file structure MAY differ from training data.
- Before writing Next-specific code, read the relevant guide in `node_modules/next/dist/docs/`.
- Heed deprecation notices. Do NOT guess APIs from Next 13/14/15 memory.
- Pages, layouts, and route handlers live under `src/app/`.
```

### Rule block: `project/llm-reliability`
**When to inject**: any task that touches `classification/` domain.

```
- OpenAI `gpt-4o-mini` + Structured Outputs (`response_format: { type: "json_schema", strict: true }`).
- Zod schema MUST include `reasoning: z.string()` as the FIRST field (Chain-of-Thought forcing).
- All 8 categorical dimensions are closed `z.enum([...])` with explicit "escape hatch" values (Otros, Ninguna, Indefinido) so the model never invents.
- `temperature: 0` for determinism.
- Retry 3x with exponential backoff (1s/2s/4s) for timeouts, 429, 5xx.
- Per-row isolation: a failing row is persisted with `classification_status: 'failed'` + `error_message` — the batch continues.
- Token budget enforced with `tiktoken`: if > 8000 tokens, intelligent truncation (first 70% + last 30%) with `truncated: true` flag.
- Each classification persists `prompt_version` (semver) + `model_version` (OpenAI exact id) for traceability.
- Consistency rules are DECLARATIVE (a table of `InconsistencyRule` objects), not ad-hoc checks. Warnings persist as `warnings[]`, never block.
```

### Rule block: `project/commit-convention`
**When to inject**: any task that commits code.

```
- Conventional commits only (feat:, fix:, chore:, docs:, refactor:, test:, perf:).
- NEVER add Co-Authored-By or AI attribution footers.
- NEVER use --no-verify or skip hooks. If a hook fails, fix the root cause.
- Commit after each SDD task completion (per user preference).
```

### Rule block: `project/ui-theme`
**When to inject**: any task that writes UI components or updates theme tokens.

```
- Dark-first. Base: zinc-950 (bg) + zinc-900 (cards).
- Primary accent: cyan-400 / cyan-500.
- Highlight accent: amber-400 (wins, key metrics).
- Muted: zinc-700 (borders).
- Text hierarchy: zinc-50 / zinc-300 / zinc-500.
- Tokens live in Tailwind 4 `@theme` block in `src/app/globals.css`.
- Components: shadcn/ui + Recharts + Lucide icons.
```
