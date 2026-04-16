import { describe, it, expect } from "vitest";
import { TiktokenTokenizer } from "../tiktoken-tokenizer";

/**
 * Integration test for the real tiktoken adapter. Kept small on purpose:
 * we exercise encode, round-trip decode, and dispose. Everything else is
 * covered at the service level via a deterministic fake tokenizer.
 */
describe("TiktokenTokenizer", () => {
  it("encodes a non-empty string into a non-empty Uint32Array", () => {
    const tokenizer = new TiktokenTokenizer();
    try {
      const tokens = tokenizer.encode("Hola");
      expect(tokens).toBeInstanceOf(Uint32Array);
      expect(tokens.length).toBeGreaterThan(0);
    } finally {
      tokenizer.dispose();
    }
  });

  it("round-trips encode/decode for a realistic Spanish sentence", () => {
    const tokenizer = new TiktokenTokenizer();
    const text = "Hola, necesitamos automatizar respuestas.";
    try {
      const tokens = tokenizer.encode(text);
      const back = tokenizer.decode(tokens);
      expect(back).toBe(text);
    } finally {
      tokenizer.dispose();
    }
  });

  it("dispose() does not throw when called after use", () => {
    const tokenizer = new TiktokenTokenizer();
    tokenizer.encode("x");
    expect(() => tokenizer.dispose()).not.toThrow();
  });
});
