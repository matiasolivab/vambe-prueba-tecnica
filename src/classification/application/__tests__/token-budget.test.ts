import { describe, it, expect, beforeEach } from "vitest";
import {
  TokenBudgetService,
  type Tokenizer,
} from "../token-budget";
import { JsonLogger } from "@/shared/infrastructure/logger";
import { FixedClock } from "@/shared/infrastructure/clock";
import { TokenLimitExceededError } from "@/classification/domain/errors";

class FakeTokenizer implements Tokenizer {
  public encode(text: string): Uint32Array {
    const codes: number[] = [];
    for (const ch of text) {
      codes.push(ch.codePointAt(0) ?? 0);
    }
    return new Uint32Array(codes);
  }

  public decode(tokens: Uint32Array): string {
    return String.fromCodePoint(...tokens);
  }
}

const clock = new FixedClock(new Date("2026-04-16T10:00:00.000Z"));

describe("TokenBudgetService", () => {
  const DEFAULT_MARKER = "\n\n[...TRUNCATED...]\n\n";
  const MARKER_TOKENS = DEFAULT_MARKER.length; // 22 with FakeTokenizer

  let tokenizer: FakeTokenizer;
  let lines: string[];
  let logger: JsonLogger;

  beforeEach(() => {
    tokenizer = new FakeTokenizer();
    lines = [];
    logger = new JsonLogger(clock, (l) => lines.push(l));
  });

  it("passes short input through unchanged (below budget)", () => {
    const service = new TokenBudgetService(tokenizer, logger, 1000);

    const result = service.fit("hello");

    expect(result).toEqual({
      text: "hello",
      originalTokens: 5,
      finalTokens: 5,
      truncated: false,
    });
    expect(lines).toHaveLength(0);
  });

  it("passes input exactly at budget through unchanged", () => {
    const service = new TokenBudgetService(tokenizer, logger, 1000);
    const text = "a".repeat(1000);

    const result = service.fit(text);

    expect(result.truncated).toBe(false);
    expect(result.originalTokens).toBe(1000);
    expect(result.finalTokens).toBe(1000);
    expect(result.text).toBe(text);
    expect(lines).toHaveLength(0);
  });

  it("truncates when input exceeds budget and sets truncated=true", () => {
    const service = new TokenBudgetService(tokenizer, logger, 1000);
    const text = "a".repeat(5000);

    const result = service.fit(text);

    expect(result.truncated).toBe(true);
    expect(result.originalTokens).toBe(5000);
    expect(result.finalTokens).toBeLessThanOrEqual(1000);
    expect(result.text).toContain(DEFAULT_MARKER);
    expect(result.text.startsWith("a")).toBe(true);
    expect(result.text.endsWith("a")).toBe(true);
    expect(lines).toHaveLength(1);
  });

  it("splits truncated output into 70% head + marker + 30% tail", () => {
    const service = new TokenBudgetService(tokenizer, logger, 1000);
    const head = "H".repeat(4000);
    const tail = "T".repeat(4000);

    const result = service.fit(head + tail);

    const usable = 1000 - MARKER_TOKENS; // 978
    const headCount = Math.floor(0.7 * usable); // 684
    const tailCount = Math.floor(0.3 * usable); // 293

    const expected = "H".repeat(headCount) + DEFAULT_MARKER + "T".repeat(tailCount);

    expect(result.truncated).toBe(true);
    expect(result.text).toBe(expected);
    expect(result.finalTokens).toBe(expected.length);
    expect(result.finalTokens).toBeLessThanOrEqual(1000);
  });

  it("throws TokenLimitExceededError when post-truncation still exceeds budget", () => {
    const giantMarker = "X".repeat(100);
    const service = new TokenBudgetService(tokenizer, logger, 50, giantMarker);

    expect(() => service.fit("y".repeat(500))).toThrow(TokenLimitExceededError);

    try {
      service.fit("y".repeat(500));
    } catch (err) {
      expect(err).toBeInstanceOf(TokenLimitExceededError);
      const tle = err as TokenLimitExceededError;
      expect(tle.limit).toBe(50);
      expect(tle.tokens).toBeGreaterThan(50);
    }
  });

  it("honours a custom budget", () => {
    const service = new TokenBudgetService(tokenizer, logger, 50);
    const text = "z".repeat(200);

    const result = service.fit(text);

    expect(result.truncated).toBe(true);
    expect(result.originalTokens).toBe(200);
    expect(result.finalTokens).toBeLessThanOrEqual(50);
    expect(result.text).toContain(DEFAULT_MARKER);
  });

  it("emits exactly one warn event with audit metadata on truncation", () => {
    const service = new TokenBudgetService(tokenizer, logger, 1000);
    const text = "a".repeat(5000);

    const result = service.fit(text);

    expect(lines).toHaveLength(1);
    const entry = JSON.parse(lines[0]) as Record<string, unknown>;
    expect(entry.level).toBe("warn");
    expect(entry.event).toBe("token_budget.truncated");
    expect(entry.originalTokens).toBe(5000);
    expect(entry.finalTokens).toBe(result.finalTokens);
    expect(entry.budget).toBe(1000);
  });

  it("truncates multi-byte Unicode input without breaking encoding", () => {
    const service = new TokenBudgetService(tokenizer, logger, 1000);
    const text = "áéíóú".repeat(500); // 2500 code points

    const result = service.fit(text);

    expect(result.truncated).toBe(true);
    expect(result.originalTokens).toBe(2500);
    expect(result.finalTokens).toBeLessThanOrEqual(1000);
    expect(result.text).toContain(DEFAULT_MARKER);
    expect(tokenizer.encode(result.text).length).toBe(result.finalTokens);
  });
});
