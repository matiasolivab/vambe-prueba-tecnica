import { DomainError } from "@/shared/domain/domain-error";

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
