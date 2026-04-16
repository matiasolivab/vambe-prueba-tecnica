import { describe, it, expect } from "vitest";

import { DomainError } from "@/shared/domain/domain-error";
import {
  ClassificationFailedError,
  InvalidSchemaError,
  LLMTimeoutError,
  TokenLimitExceededError,
} from "../errors";

describe("ClassificationFailedError", () => {
  it("is instance of Error and DomainError", () => {
    const err = new ClassificationFailedError("foo@bar.com", "boom");
    expect(err).toBeInstanceOf(Error);
    expect(err).toBeInstanceOf(DomainError);
    expect(err).toBeInstanceOf(ClassificationFailedError);
  });

  it("exposes name, code and pass-through message", () => {
    const err = new ClassificationFailedError("foo@bar.com", "all retries exhausted");
    expect(err.name).toBe("ClassificationFailedError");
    expect(err.code).toBe("classification.failed");
    expect(err.message).toBe("all retries exhausted");
  });

  it("carries email as readonly public field", () => {
    const err = new ClassificationFailedError("lead@vambe.ai", "boom");
    expect(err.email).toBe("lead@vambe.ai");
  });

  it("preserves an optional cause", () => {
    const root = new Error("network down");
    const err = new ClassificationFailedError("foo@bar.com", "boom", root);
    expect(err.cause).toBe(root);
  });

  it("is catchable via instanceof discriminator", () => {
    try {
      throw new ClassificationFailedError("foo@bar.com", "boom");
    } catch (e) {
      if (e instanceof ClassificationFailedError) {
        expect(e.code).toBe("classification.failed");
      } else {
        throw new Error("should have matched ClassificationFailedError");
      }
    }
  });
});

describe("LLMTimeoutError", () => {
  it("is instance of Error and DomainError", () => {
    const err = new LLMTimeoutError(2, 30_000);
    expect(err).toBeInstanceOf(Error);
    expect(err).toBeInstanceOf(DomainError);
    expect(err).toBeInstanceOf(LLMTimeoutError);
  });

  it("exposes name and code", () => {
    const err = new LLMTimeoutError(1, 15_000);
    expect(err.name).toBe("LLMTimeoutError");
    expect(err.code).toBe("llm.timeout");
  });

  it("auto-composes message with durationMs and attempt", () => {
    const err = new LLMTimeoutError(2, 30_000);
    expect(err.message).toBe("LLM timeout after 30000ms on attempt 2");
  });

  it("carries attempt and durationMs as readonly public fields", () => {
    const err = new LLMTimeoutError(3, 45_000);
    expect(err.attempt).toBe(3);
    expect(err.durationMs).toBe(45_000);
  });

  it("preserves an optional cause", () => {
    const root = new Error("aborted");
    const err = new LLMTimeoutError(1, 15_000, root);
    expect(err.cause).toBe(root);
  });
});

describe("InvalidSchemaError", () => {
  const issues = [
    { path: ["industry"], message: "Invalid enum" },
    { path: ["needsSummary"], message: "Too short" },
  ] as const;

  it("is instance of Error and DomainError", () => {
    const err = new InvalidSchemaError(issues);
    expect(err).toBeInstanceOf(Error);
    expect(err).toBeInstanceOf(DomainError);
    expect(err).toBeInstanceOf(InvalidSchemaError);
  });

  it("exposes name and code", () => {
    const err = new InvalidSchemaError(issues);
    expect(err.name).toBe("InvalidSchemaError");
    expect(err.code).toBe("classification.invalid_schema");
  });

  it("auto-composes message with issue count", () => {
    const err = new InvalidSchemaError(issues);
    expect(err.message).toBe(
      "Classification failed schema validation: 2 issue(s)",
    );
  });

  it("carries issues as readonly public field", () => {
    const err = new InvalidSchemaError(issues);
    expect(err.issues).toEqual(issues);
    expect(err.issues).toHaveLength(2);
    expect(err.issues[0]?.path).toEqual(["industry"]);
    expect(err.issues[0]?.message).toBe("Invalid enum");
  });

  it("preserves an optional cause", () => {
    const root = new Error("zod parse failed");
    const err = new InvalidSchemaError(issues, root);
    expect(err.cause).toBe(root);
  });
});

describe("TokenLimitExceededError", () => {
  it("is instance of Error and DomainError", () => {
    const err = new TokenLimitExceededError(9000, 8000);
    expect(err).toBeInstanceOf(Error);
    expect(err).toBeInstanceOf(DomainError);
    expect(err).toBeInstanceOf(TokenLimitExceededError);
  });

  it("exposes name and code", () => {
    const err = new TokenLimitExceededError(9000, 8000);
    expect(err.name).toBe("TokenLimitExceededError");
    expect(err.code).toBe("classification.token_limit_exceeded");
  });

  it("auto-composes message with tokens and limit", () => {
    const err = new TokenLimitExceededError(9000, 8000);
    expect(err.message).toBe(
      "Transcript 9000 tokens exceeds hard limit 8000 after truncation",
    );
  });

  it("carries tokens and limit as readonly public fields", () => {
    const err = new TokenLimitExceededError(9500, 8000);
    expect(err.tokens).toBe(9500);
    expect(err.limit).toBe(8000);
  });
});

describe("error discrimination", () => {
  it("each subclass is distinguishable via instanceof when sorted together", () => {
    const errors: DomainError[] = [
      new ClassificationFailedError("a@b.com", "boom"),
      new LLMTimeoutError(1, 15_000),
      new InvalidSchemaError([{ path: ["x"], message: "nope" }]),
      new TokenLimitExceededError(9000, 8000),
    ];

    expect(errors.filter((e) => e instanceof LLMTimeoutError)).toHaveLength(1);
    expect(
      errors.filter((e) => e instanceof ClassificationFailedError),
    ).toHaveLength(1);
    expect(errors.filter((e) => e instanceof InvalidSchemaError)).toHaveLength(
      1,
    );
    expect(
      errors.filter((e) => e instanceof TokenLimitExceededError),
    ).toHaveLength(1);
  });

  it("each error exposes a distinct code", () => {
    const codes = new Set([
      new ClassificationFailedError("a@b.com", "boom").code,
      new LLMTimeoutError(1, 15_000).code,
      new InvalidSchemaError([{ path: ["x"], message: "nope" }]).code,
      new TokenLimitExceededError(9000, 8000).code,
    ]);
    expect(codes.size).toBe(4);
  });
});
