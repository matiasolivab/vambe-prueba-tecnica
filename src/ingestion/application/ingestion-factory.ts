import { readFileSync } from "node:fs";
import { join } from "node:path";

import { TokenBudgetService } from "@/classification/application/token-budget";
import { TranscriptClassifier } from "@/classification/application/classifier";
import { ClassificationValidator } from "@/classification/application/validator";
import {
  ClassificationSchema,
  type Classification,
} from "@/classification/domain/schema";
import { createOpenAIClient } from "@/classification/infrastructure/openai-client";
import {
  PromptBuilder,
  type FewShotExample,
} from "@/classification/infrastructure/prompt-builder";
import { TiktokenTokenizer } from "@/classification/infrastructure/tiktoken-tokenizer";
import { createDrizzleClientRepository } from "@/clients/infrastructure/drizzle-client-repository";
import { CsvParser } from "@/ingestion/infrastructure/csv-parser";
import { SystemClock } from "@/shared/infrastructure/clock";
import { JsonLogger, type Logger } from "@/shared/infrastructure/logger";

import { IngestionService } from "./ingestion-service";

/**
 * Single source of truth for assembling the 13-layer classification +
 * ingestion pipeline (ARCHITECTURE §13). Used by BOTH `scripts/seed.ts` and
 * the POST /api/upload route so they can NEVER drift.
 *
 * Returns the service plus a `dispose` callback that releases the underlying
 * `tiktoken` WASM buffer. Callers MUST call `dispose()` when they are done
 * (otherwise the WASM memory leaks for the lifetime of the Node process —
 * an accumulating leak in the route handler).
 *
 * Env contract:
 *   - `OPENAI_API_KEY` — required (createOpenAIClient throws otherwise).
 *   - `DATABASE_URL` — required (createDrizzleClientRepository throws).
 *
 * The logger sink defaults to stdout line-by-line JSON; pass `{ loggerSink }`
 * to redirect (e.g. to a silent sink when tests only care about behaviour).
 */
export interface BuildIngestionOptions {
  readonly loggerSink?: (line: string) => void;
  readonly fewShotsPath?: string;
}

export interface BuiltIngestion {
  readonly service: IngestionService;
  readonly logger: Logger;
  readonly dispose: () => void;
}

export function buildIngestionService(
  options: BuildIngestionOptions = {},
): BuiltIngestion {
  requireEnv("OPENAI_API_KEY");
  requireEnv("DATABASE_URL");

  const sink = options.loggerSink ?? ((line) => process.stdout.write(`${line}\n`));
  const logger = new JsonLogger(new SystemClock(), sink);

  const tokenizer = new TiktokenTokenizer();
  const tokenBudget = new TokenBudgetService(tokenizer, logger);
  const fewShots = loadFewShots(options.fewShotsPath);
  const promptBuilder = new PromptBuilder(fewShots);
  const validator = new ClassificationValidator();
  const openai = createOpenAIClient(
    process.env.OPENAI_API_KEY!,
    ClassificationSchema,
    { logger },
  );
  const classifier = new TranscriptClassifier(
    openai,
    tokenBudget,
    promptBuilder,
    validator,
    logger,
  );
  const repo = createDrizzleClientRepository();
  const parser = new CsvParser();
  const service = new IngestionService(parser, classifier, repo, logger);

  return {
    service,
    logger,
    dispose: () => tokenizer.dispose(),
  };
}

function requireEnv(name: string): void {
  if (!process.env[name]) {
    throw new Error(
      `[ingestion] Missing required env var: ${name}. Populate .env.local.`,
    );
  }
}

interface FewShotFile {
  readonly examples: ReadonlyArray<{
    readonly transcript: string;
    readonly classification: Classification;
  }>;
}

function loadFewShots(pathOverride?: string): readonly FewShotExample[] {
  const path = pathOverride ?? join(process.cwd(), "tests/fixtures/few-shots.json");
  const raw = readFileSync(path, "utf8");
  const parsed = JSON.parse(raw) as FewShotFile;
  return parsed.examples.map((entry) => ({
    transcript: entry.transcript,
    classification: entry.classification,
  }));
}
