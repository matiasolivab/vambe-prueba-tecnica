import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env.local", override: true });

import { readFileSync } from "node:fs";
import { join } from "node:path";

import { JsonLogger } from "@/shared/infrastructure/logger";
import { SystemClock } from "@/shared/infrastructure/clock";
import { TiktokenTokenizer } from "@/classification/infrastructure/tiktoken-tokenizer";
import { TokenBudgetService } from "@/classification/application/token-budget";
import {
  PromptBuilder,
  type FewShotExample,
} from "@/classification/infrastructure/prompt-builder";
import { ClassificationValidator } from "@/classification/application/validator";
import { createOpenAIClient } from "@/classification/infrastructure/openai-client";
import {
  ClassificationSchema,
  type Classification,
} from "@/classification/domain/schema";
import { TranscriptClassifier } from "@/classification/application/classifier";
import { CsvParser } from "@/ingestion/infrastructure/csv-parser";
import {
  IngestionService,
  type IngestionReport,
} from "@/ingestion/application/ingestion-service";
import { createDrizzleClientRepository } from "@/clients/infrastructure/drizzle-client-repository";

/**
 * End-to-end seed runner (PRD §RF4.1–4.2, ARCHITECTURE §7).
 *
 * Wires the EXACT same pipeline as the upload endpoint will:
 *   CsvParser → TranscriptClassifier (TokenBudget + Prompt + OpenAI + Validator)
 *             → DrizzleClientRepository.upsertByEmail
 *
 * Idempotent: `upsertByEmail` matches by email, so re-running updates existing
 * rows in place. Safe to re-run if the process is interrupted.
 */
async function main(): Promise<void> {
  requireEnv("OPENAI_API_KEY");
  requireEnv("DATABASE_URL");

  const logger = new JsonLogger(new SystemClock(), () => {
    /* silent — progress goes to stdout, errors go to console.error */
  });

  const tokenizer = new TiktokenTokenizer();
  try {
    const tokenBudget = new TokenBudgetService(tokenizer, logger);
    const fewShots = loadFewShots();
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

    const csv = readFileSync(
      join(process.cwd(), "data/vambe_clients.csv"),
      "utf8",
    );

    const startMs = Date.now();
    console.log(
      "[seed] starting — this calls OpenAI ~60 times, expect ~7-8 min sequential",
    );

    const report = await service.ingest(csv, (p) => {
      const last = p.lastEmail ? ` — ${p.lastEmail}` : "";
      process.stdout.write(
        `\r[seed] ${p.processed}/${p.total}${last}`.padEnd(80, " "),
      );
    });
    process.stdout.write("\n");

    const durationSec = ((Date.now() - startMs) / 1000).toFixed(1);
    printReport(report, durationSec);
  } finally {
    tokenizer.dispose();
  }
}

function requireEnv(name: string): void {
  if (!process.env[name]) {
    throw new Error(
      `[seed] Missing required env var: ${name}. Populate .env.local.`,
    );
  }
}

interface FewShotFile {
  readonly examples: ReadonlyArray<{
    readonly transcript: string;
    readonly classification: Classification;
  }>;
}

function loadFewShots(): readonly FewShotExample[] {
  const raw = readFileSync(
    join(process.cwd(), "tests/fixtures/few-shots.json"),
    "utf8",
  );
  const parsed = JSON.parse(raw) as FewShotFile;
  return parsed.examples.map((entry) => ({
    transcript: entry.transcript,
    classification: entry.classification,
  }));
}

function printReport(report: IngestionReport, durationSec: string): void {
  console.log("");
  console.log(
    `[seed] done in ${durationSec}s — ${report.succeeded} classified, ${report.failed} failed`,
  );
  if (report.parseErrors.length > 0) {
    console.log("[seed] parse errors:");
    for (const e of report.parseErrors) {
      console.log(`  row ${e.rowNumber}: ${e.error}`);
    }
  }
  if (report.classificationErrors.length > 0) {
    console.log("[seed] classification errors:");
    for (const e of report.classificationErrors) {
      console.log(`  ${e.email}: [${e.code}] ${e.message}`);
    }
  }
}

main().catch((err) => {
  console.error("[seed] fatal:", err instanceof Error ? err.stack : err);
  process.exit(1);
});
