// @vitest-environment node
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { config as loadDotenv } from "dotenv";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import {
  TranscriptClassifier,
  type ClassificationResult,
} from "@/classification/application/classifier";
import { TokenBudgetService } from "@/classification/application/token-budget";
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
import type { Logger } from "@/shared/infrastructure/logger";

loadDotenv({ path: resolve(process.cwd(), ".env.local"), override: false });

const RUN_GT = process.env.RUN_GT === "1";

interface GroundTruthExpected {
  readonly industry: string;
  readonly companySize: string;
  readonly mainPainPoint: string;
  readonly keyObjection: string;
  readonly leadSource: string;
  readonly sentiment: string;
  readonly needsSummary: string;
  readonly nextSteps: string;
}

interface GroundTruthSample {
  readonly email: string;
  readonly name: string;
  readonly transcript: string;
  readonly expected: GroundTruthExpected;
}

interface GroundTruthFile {
  readonly samples: readonly GroundTruthSample[];
}

interface FewShotFileEntry {
  readonly sourceEmail: string;
  readonly transcript: string;
  readonly classification: FewShotExample["classification"];
}

interface FewShotFile {
  readonly examples: readonly FewShotFileEntry[];
}

type CategoricalDimension =
  | "industry"
  | "companySize"
  | "mainPainPoint"
  | "keyObjection"
  | "leadSource"
  | "sentiment";

const CATEGORICAL_DIMENSIONS: readonly CategoricalDimension[] = [
  "industry",
  "companySize",
  "mainPainPoint",
  "keyObjection",
  "leadSource",
  "sentiment",
];

const ACCURACY_THRESHOLD = 0.8;

interface SampleRunResult {
  readonly email: string;
  readonly expected: GroundTruthExpected;
  readonly actual: Classification;
  readonly durationMs: number;
}

const noopLogger: Logger = {
  info: () => {},
  warn: () => {},
  error: () => {},
};

function loadGroundTruth(): readonly GroundTruthSample[] {
  const path = resolve(process.cwd(), "tests/fixtures/ground-truth.json");
  const raw = readFileSync(path, "utf-8");
  const parsed = JSON.parse(raw) as GroundTruthFile;
  return parsed.samples;
}

function loadFewShots(): readonly FewShotExample[] {
  const path = resolve(process.cwd(), "tests/fixtures/few-shots.json");
  const raw = readFileSync(path, "utf-8");
  const parsed = JSON.parse(raw) as FewShotFile;
  return parsed.examples.map((entry) => ({
    transcript: entry.transcript,
    classification: entry.classification,
  }));
}

function computeAccuracy(
  dimension: CategoricalDimension,
  runs: readonly SampleRunResult[],
): { readonly matches: number; readonly total: number; readonly rate: number } {
  const matches = runs.filter(
    (r) => r.actual[dimension] === r.expected[dimension],
  ).length;
  const total = runs.length;
  return { matches, total, rate: total === 0 ? 0 : matches / total };
}

function misses(
  dimension: CategoricalDimension,
  runs: readonly SampleRunResult[],
): readonly string[] {
  return runs
    .filter((r) => r.actual[dimension] !== r.expected[dimension])
    .map(
      (r) =>
        `${dimension}: ${r.email} (expected "${r.expected[dimension]}", got "${r.actual[dimension]}")`,
    );
}

describe.skipIf(!RUN_GT)(
  "classifier accuracy vs ground truth",
  { timeout: 300_000 },
  () => {
    let tokenizer: TiktokenTokenizer;
    let classifier: TranscriptClassifier;
    const samples = loadGroundTruth();
    const runs: SampleRunResult[] = [];

    beforeAll(() => {
      const apiKey = process.env.OPENAI_API_KEY;
      if (!apiKey) {
        throw new Error(
          "OPENAI_API_KEY is not set. Ensure .env.local is present and readable by the test process.",
        );
      }

      tokenizer = new TiktokenTokenizer();
      const tokenBudget = new TokenBudgetService(tokenizer, noopLogger);
      const fewShots = loadFewShots();
      const promptBuilder = new PromptBuilder(fewShots);
      const validator = new ClassificationValidator();
      const llmClient = createOpenAIClient(apiKey, ClassificationSchema, {
        logger: noopLogger,
      });

      classifier = new TranscriptClassifier(
        llmClient,
        tokenBudget,
        promptBuilder,
        validator,
        noopLogger,
      );
    });

    afterAll(() => {
      tokenizer?.dispose();
      if (runs.length === 0) return;
      printReport(runs);
    });

    it("classifies every ground-truth sample end-to-end", async () => {
      for (const sample of samples) {
        const startedAt = Date.now();
        const result: ClassificationResult = await classifier.classify({
          email: sample.email,
          transcript: sample.transcript,
        });
        runs.push({
          email: sample.email,
          expected: sample.expected,
          actual: result.classification,
          durationMs: Date.now() - startedAt,
        });
      }
      expect(runs).toHaveLength(samples.length);
    });

    describe("per-dimension accuracy thresholds", () => {
      for (const dimension of CATEGORICAL_DIMENSIONS) {
        it(`${dimension} ≥ ${ACCURACY_THRESHOLD * 100}%`, () => {
          expect(runs.length).toBeGreaterThan(0);
          const { rate, matches, total } = computeAccuracy(dimension, runs);
          expect(
            rate,
            `accuracy=${(rate * 100).toFixed(1)}% (${matches}/${total}); misses: ${misses(dimension, runs).join(" | ") || "none"}`,
          ).toBeGreaterThanOrEqual(ACCURACY_THRESHOLD);
        });
      }
    });

    describe("qualitative structural checks (informational)", () => {
      it("needsSummary non-empty and ≥50 chars", () => {
        const offenders = runs.filter(
          (r) =>
            !r.actual.needsSummary || r.actual.needsSummary.length < 50,
        );
        expect(
          offenders,
          `needsSummary too short for: ${offenders.map((o) => o.email).join(", ")}`,
        ).toHaveLength(0);
      });

      it("nextSteps non-empty and ≥20 chars", () => {
        const offenders = runs.filter(
          (r) => !r.actual.nextSteps || r.actual.nextSteps.length < 20,
        );
        expect(
          offenders,
          `nextSteps too short for: ${offenders.map((o) => o.email).join(", ")}`,
        ).toHaveLength(0);
      });
    });
  },
);

function printReport(runs: readonly SampleRunResult[]): void {
  const lines: string[] = [];
  lines.push(`\n=== Classifier Accuracy (N=${runs.length}) ===`);

  for (const dimension of CATEGORICAL_DIMENSIONS) {
    const { matches, total, rate } = computeAccuracy(dimension, runs);
    const pct = (rate * 100).toFixed(0);
    const mark = rate >= ACCURACY_THRESHOLD ? "✓" : "✗ below threshold";
    lines.push(
      `${dimension.padEnd(22)} ${matches}/${total} (${pct}%) ${mark}`,
    );
  }

  const allMisses = CATEGORICAL_DIMENSIONS.flatMap((d) => misses(d, runs));
  if (allMisses.length > 0) {
    lines.push("\n=== Misses ===");
    for (const line of allMisses) lines.push(line);
  }

  const needsOk = runs.filter(
    (r) => r.actual.needsSummary && r.actual.needsSummary.length >= 50,
  ).length;
  const stepsOk = runs.filter(
    (r) => r.actual.nextSteps && r.actual.nextSteps.length >= 20,
  ).length;
  lines.push("\n=== Qualitative (structural) ===");
  lines.push(
    `needsSummary: ${needsOk}/${runs.length} non-empty, all ≥50 chars`,
  );
  lines.push(`nextSteps:    ${stepsOk}/${runs.length} non-empty, all ≥20 chars`);

  const totalMs = runs.reduce((acc, r) => acc + r.durationMs, 0);
  lines.push("\n=== Latency ===");
  lines.push(
    `total: ${(totalMs / 1000).toFixed(1)}s, avg: ${(totalMs / runs.length / 1000).toFixed(1)}s/sample`,
  );

  console.log(lines.join("\n"));
}
