import { createHash } from "node:crypto";

import type { Classification } from "@/classification/domain/schema";
import { ClassificationFailedError } from "@/classification/domain/errors";
import { CLASSIFIER_VERSION } from "@/classification/domain/version";
import type { PromptBuilder } from "@/classification/infrastructure/prompt-builder";
import type { Logger } from "@/shared/infrastructure/logger";

import type { LLMClient, LLMResult } from "./llm-client";
import type { TokenBudgetService } from "./token-budget";
import type { ClassificationValidator, Warning } from "./validator";

/**
 * The orchestrating use-case. Assembles every Phase 3 defense layer into a
 * single high-level call: token budget → prompt build → LLM call → validate.
 *
 * Responsibility boundary (see `docs/ARCHITECTURE.md` §13):
 *  - Owns pipeline sequencing and result consolidation.
 *  - Stamps `promptVersion` from `CLASSIFIER_VERSION` (rule 13 — traceability).
 *  - Rewraps `ClassificationFailedError('', …)` emitted by the LLM adapter
 *    with the correct task email so the caller (IngestionService, task 5.3)
 *    can mark the failed row.
 *  - Never logs raw email (RNF4.2) — only a short sha256 prefix.
 *  - Does NOT decide persistence; throws typed errors, lets the caller persist
 *    `classification_status: 'failed'` (layer 8 — per-row isolation).
 *
 * The prompt builder is imported from `infrastructure/` because it formats
 * text for an external boundary (the LLM). No I/O happens in `PromptBuilder`;
 * it's a pure formatter. Inward dependency direction is preserved in spirit:
 * `application/` still has zero knowledge of OpenAI's SDK.
 */

export interface ClassificationTask {
  readonly email: string;
  readonly transcript: string;
}

export interface ClassificationResult {
  readonly classification: Classification;
  readonly modelVersion: string;
  readonly promptVersion: string;
  readonly truncated: boolean;
  readonly warnings: readonly Warning[];
}

export type EmailHasher = (email: string) => string;

const defaultHashEmail: EmailHasher = (email) =>
  createHash("sha256").update(email).digest("hex").slice(0, 12);

export class TranscriptClassifier {
  public constructor(
    private readonly llm: LLMClient,
    private readonly tokenBudget: TokenBudgetService,
    private readonly promptBuilder: PromptBuilder,
    private readonly validator: ClassificationValidator,
    private readonly logger: Logger,
    private readonly hashEmail: EmailHasher = defaultHashEmail,
    private readonly classifierVersion: string = CLASSIFIER_VERSION,
  ) {}

  public async classify(
    task: ClassificationTask,
  ): Promise<ClassificationResult> {
    const fit = this.tokenBudget.fit(task.transcript);
    const systemPrompt = this.promptBuilder.buildSystemPrompt();
    const userPrompt = this.promptBuilder.buildUserPrompt(fit.text);
    const llmResult = await this.callLLM(systemPrompt, userPrompt, task.email);
    const warnings = this.validator.validate(llmResult.classification);

    this.logger.info("classification.completed", {
      emailHash: this.hashEmail(task.email),
      modelVersion: llmResult.modelVersion,
      originalTokens: fit.originalTokens,
      finalTokens: fit.finalTokens,
      truncated: fit.truncated,
      warningCount: warnings.length,
    });

    return {
      classification: llmResult.classification,
      modelVersion: llmResult.modelVersion,
      promptVersion: this.classifierVersion,
      truncated: fit.truncated,
      warnings,
    };
  }

  private async callLLM(
    systemPrompt: string,
    userPrompt: string,
    email: string,
  ): Promise<LLMResult> {
    try {
      return await this.llm.classify(systemPrompt, userPrompt);
    } catch (err) {
      if (err instanceof ClassificationFailedError && err.email === "") {
        throw new ClassificationFailedError(email, err.message, err.cause);
      }
      throw err;
    }
  }
}
