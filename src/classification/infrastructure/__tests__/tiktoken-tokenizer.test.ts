import { describe, it, expect } from "vitest";
import { TiktokenTokenizer } from "../tiktoken-tokenizer";

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
