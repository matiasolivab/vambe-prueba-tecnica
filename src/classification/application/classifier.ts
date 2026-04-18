import { createHash } from "node:crypto";

import type { Classification } from "@/classification/domain/schema";
import { ClassificationFailedError } from "@/classification/domain/errors";
import { CLASSIFIER_VERSION } from "@/classification/domain/version";
import type { PromptBuilder } from "@/classification/infrastructure/prompt-builder";
import type { Logger } from "@/shared/infrastructure/logger";

import type { LLMClient, LLMResult } from "./llm-client";
import type { TokenBudgetService } from "./token-budget";
import type { ClassificationValidator, Warning } from "./validator";

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
