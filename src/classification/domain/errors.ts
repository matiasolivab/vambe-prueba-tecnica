import { DomainError } from "@/shared/domain/domain-error";

/**
 * Typed classification errors — the domain contracts that `application/`
 * (classifier, validator) and `infrastructure/` (openai-client) throw and
 * catch.
 *
 * Design notes (see `docs/ARCHITECTURE.md` §13 rules 7, 8, 11):
 *
 *  - `ClassificationFailedError` persists per-row when retries are
 *    exhausted (capa 8: per-row isolation). Carries `email` so the
 *    IngestionService can mark the failed client row.
 *  - `LLMTimeoutError` is thrown by the OpenAI client when a single
 *    attempt times out; the retry wrapper catches this, backs off
 *    exponentially, and rethrows as `ClassificationFailedError` when all
 *    3 attempts fail (capa 7: retry).
 *  - `InvalidSchemaError` is the final belt against capa 1 (Structured
 *    Outputs). Should be practically unreachable when `strict: true`, but
 *    we still tolerate it so a bad prompt deploy doesn't crash the batch.
 *  - `TokenLimitExceededError` fires when, even after truncation, a
 *    transcript still exceeds the hard budget (capa 11). It is terminal
 *    for that row — no retry possible.
 */

export class ClassificationFailedError extends DomainError {
  public readonly email: string;

  constructor(email: string, message: string, cause?: unknown) {
    super("ClassificationFailedError", "classification.failed", message, cause);
    this.email = email;
  }
}

export class LLMTimeoutError extends DomainError {
  public readonly attempt: number;
  public readonly durationMs: number;

  constructor(attempt: number, durationMs: number, cause?: unknown) {
    super(
      "LLMTimeoutError",
      "llm.timeout",
      `LLM timeout after ${durationMs}ms on attempt ${attempt}`,
      cause,
    );
    this.attempt = attempt;
    this.durationMs = durationMs;
  }
}

export type SchemaIssue = {
  readonly path: readonly (string | number)[];
  readonly message: string;
};

export class InvalidSchemaError extends DomainError {
  public readonly issues: readonly SchemaIssue[];

  constructor(issues: readonly SchemaIssue[], cause?: unknown) {
    super(
      "InvalidSchemaError",
      "classification.invalid_schema",
      `Classification failed schema validation: ${issues.length} issue(s)`,
      cause,
    );
    this.issues = issues;
  }
}

export class TokenLimitExceededError extends DomainError {
  public readonly tokens: number;
  public readonly limit: number;

  constructor(tokens: number, limit: number) {
    super(
      "TokenLimitExceededError",
      "classification.token_limit_exceeded",
      `Transcript ${tokens} tokens exceeds hard limit ${limit} after truncation`,
    );
    this.tokens = tokens;
    this.limit = limit;
  }
}
