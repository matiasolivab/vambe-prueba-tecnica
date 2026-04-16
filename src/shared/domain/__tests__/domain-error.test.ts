import { describe, it, expect } from "vitest";
import { DomainError } from "../domain-error";

class SampleError extends DomainError {
  constructor(message: string, cause?: unknown) {
    super("SampleError", "sample.failed", message, cause);
  }
}

describe("DomainError", () => {
  it("is an instance of Error", () => {
    const err = new SampleError("boom");
    expect(err).toBeInstanceOf(Error);
    expect(err).toBeInstanceOf(DomainError);
  });

  it("preserves name, code and message", () => {
    const err = new SampleError("boom");
    expect(err.name).toBe("SampleError");
    expect(err.code).toBe("sample.failed");
    expect(err.message).toBe("boom");
  });

  it("carries an optional cause", () => {
    const root = new Error("network down");
    const err = new SampleError("boom", root);
    expect(err.cause).toBe(root);
  });

  it("has a stack trace", () => {
    const err = new SampleError("boom");
    expect(err.stack).toBeDefined();
    expect(err.stack).toContain("SampleError");
  });

  it("is catchable by specific subclass", () => {
    try {
      throw new SampleError("boom");
    } catch (e) {
      if (e instanceof SampleError) {
        expect(e.code).toBe("sample.failed");
      } else {
        throw new Error("should have matched SampleError");
      }
    }
  });
});
