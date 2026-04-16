import OpenAI from "openai";
import { zodResponseFormat } from "openai/helpers/zod";
import type { ZodType } from "zod";
import { ZodError } from "zod";

import type {
  LLMClient,
  LLMResult,
} from "@/classification/application/llm-client";
import type { Classification } from "@/classification/domain/schema";
import {
  ClassificationFailedError,
  InvalidSchemaError,
  LLMTimeoutError,
  type SchemaIssue,
} from "@/classification/domain/errors";
import type { Logger } from "@/shared/infrastructure/logger";

/**
 * OpenAI adapter for the `LLMClient` port.
 *
 * Responsibilities (ARCHITECTURE §13):
 *  - Rule 1 : Structured Outputs via `zodResponseFormat(ClassificationSchema)`
 *             + `chat.completions.parse` — the JSON Schema contract is
 *             enforced server-side; `.parsed` is typed.
 *  - Rule 3 : temperature 0 — deterministic-ish output.
 *  - Rule 7 : retry ladder — 1s / 2s / 4s (base `backoffBaseMs * 2^(i-1)`),
 *             maxAttempts 3 by default. Retries ONLY 429, ≥500, connection
 *             timeouts and connection errors.
 *  - Rule 13: persists the EXACT `model` id the API echoes back
 *             (e.g. `gpt-4o-mini-2024-07-18`) so the caller can store it in
 *             the client row for audit / replay.
 *
 * The class stays intentionally DI-pure: every collaborator (OpenAI SDK,
 * schema, sleep, logger) is injected. The `createOpenAIClient` factory below
 * assembles a production instance from an API key.
 */

/** Sleep primitive — injectable so tests don't actually wait. */
export type Sleep = (ms: number) => Promise<void>;

const DEFAULT_MODEL = "gpt-4o-mini";
const DEFAULT_TEMPERATURE = 0;
const DEFAULT_MAX_ATTEMPTS = 3;
const DEFAULT_BACKOFF_BASE_MS = 1000;
const SCHEMA_NAME = "classification";

const realSleep: Sleep = (ms) =>
  new Promise((resolve) => setTimeout(resolve, ms));

const noopLogger: Logger = {
  info: () => {},
  warn: () => {},
  error: () => {},
};

export interface OpenAIClientOptions {
  readonly model?: string;
  readonly temperature?: number;
  readonly maxAttempts?: number;
  readonly backoffBaseMs?: number;
  readonly sleep?: Sleep;
  readonly logger?: Logger;
}

type ResolvedOptions = Required<OpenAIClientOptions>;

export class OpenAIClient implements LLMClient {
  private readonly options: ResolvedOptions;

  public constructor(
    private readonly openai: OpenAI,
    private readonly schema: ZodType<Classification>,
    options: OpenAIClientOptions = {},
  ) {
    this.options = {
      model: options.model ?? DEFAULT_MODEL,
      temperature: options.temperature ?? DEFAULT_TEMPERATURE,
      maxAttempts: options.maxAttempts ?? DEFAULT_MAX_ATTEMPTS,
      backoffBaseMs: options.backoffBaseMs ?? DEFAULT_BACKOFF_BASE_MS,
      sleep: options.sleep ?? realSleep,
      logger: options.logger ?? noopLogger,
    };
  }

  public async classify(
    systemPrompt: string,
    userPrompt: string,
  ): Promise<LLMResult> {
    const { maxAttempts } = this.options;
    const startedAt = Date.now();

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        return await this.attempt(systemPrompt, userPrompt);
      } catch (err) {
        const isLast = attempt >= maxAttempts;
        if (this.shouldStop(err, isLast)) {
          throw this.mapTerminalError(err, attempt, startedAt);
        }
        await this.backoff(attempt, err);
      }
    }

    // Defensive — unreachable under normal control flow.
    throw this.mapTerminalError(undefined, maxAttempts, startedAt);
  }

  private shouldStop(err: unknown, isLast: boolean): boolean {
    if (err instanceof InvalidSchemaError) return true;
    if (err instanceof ZodError) return true;
    if (isLast) return true;
    return !this.isRetriable(err);
  }

  private async attempt(
    systemPrompt: string,
    userPrompt: string,
  ): Promise<LLMResult> {
    const response = await this.openai.chat.completions.parse({
      model: this.options.model,
      temperature: this.options.temperature,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      response_format: zodResponseFormat(this.schema, SCHEMA_NAME),
    });

    const message = response.choices[0]?.message;
    if (!message || message.parsed == null) {
      const reason = message?.refusal ?? "LLM returned no parsed content";
      throw new InvalidSchemaError([{ path: [], message: reason }]);
    }

    // Belt check: re-validate with Zod in case the SDK surfaces any surprise.
    const classification = this.schema.parse(message.parsed);
    const modelVersion = response.model ?? this.options.model;

    return { classification, modelVersion };
  }

  private isRetriable(err: unknown): boolean {
    if (err instanceof OpenAI.APIConnectionError) return true;
    if (err instanceof OpenAI.APIError) {
      const status = err.status;
      if (status === 429) return true;
      if (typeof status === "number" && status >= 500) return true;
    }
    return false;
  }

  private async backoff(attempt: number, err: unknown): Promise<void> {
    const delay = this.options.backoffBaseMs * 2 ** (attempt - 1);
    this.options.logger.warn("llm.retry", {
      attempt,
      nextDelayMs: delay,
      reason: this.describeError(err),
    });
    await this.options.sleep(delay);
  }

  private describeError(err: unknown): string {
    if (err instanceof OpenAI.APIConnectionTimeoutError) return "timeout";
    if (err instanceof OpenAI.APIConnectionError) return "connection";
    if (err instanceof OpenAI.APIError) {
      return typeof err.status === "number" ? `status_${err.status}` : "api";
    }
    return "unknown";
  }

  private mapTerminalError(
    err: unknown,
    attempt: number,
    startedAt: number,
  ): Error {
    const durationMs = Date.now() - startedAt;

    if (err instanceof LLMTimeoutError) return err;
    if (err instanceof InvalidSchemaError) return err;
    if (err instanceof ClassificationFailedError) return err;

    if (err instanceof OpenAI.APIConnectionTimeoutError) {
      return new LLMTimeoutError(attempt, durationMs, err);
    }
    if (err instanceof ZodError) {
      return new InvalidSchemaError(this.mapZodIssues(err), err);
    }

    return new ClassificationFailedError("", "OpenAI call failed", err);
  }

  private mapZodIssues(err: ZodError): SchemaIssue[] {
    return err.issues.map((issue) => ({
      path: issue.path.map((segment) =>
        typeof segment === "symbol" ? segment.toString() : segment,
      ),
      message: issue.message,
    }));
  }
}

/**
 * Factory: one-line construction for production wiring.
 * Tests prefer the class constructor with hand-crafted mocks.
 */
export function createOpenAIClient(
  apiKey: string,
  schema: ZodType<Classification>,
  options: OpenAIClientOptions = {},
): OpenAIClient {
  return new OpenAIClient(new OpenAI({ apiKey }), schema, options);
}
