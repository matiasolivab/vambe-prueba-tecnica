import { encoding_for_model, type Tiktoken } from "tiktoken";
import type { Tokenizer } from "@/classification/application/token-budget";

/**
 * Real `Tokenizer` adapter backed by tiktoken's `gpt-4o-mini` encoding
 * (`cl100k_base`-family). Wraps the WASM handle so call sites get a narrow
 * port surface and explicit lifecycle (`dispose` → `.free()`).
 *
 * Dependency direction: the port lives in `application/`; this infrastructure
 * adapter imports and implements it (inward-pointing).
 */
export class TiktokenTokenizer implements Tokenizer {
  private readonly encoder: Tiktoken;
  private readonly decoder: TextDecoder;

  public constructor() {
    this.encoder = encoding_for_model("gpt-4o-mini");
    this.decoder = new TextDecoder("utf-8");
  }

  public encode(text: string): Uint32Array {
    return this.encoder.encode(text);
  }

  public decode(tokens: Uint32Array): string {
    const bytes = this.encoder.decode(tokens);
    return this.decoder.decode(bytes);
  }

  public dispose(): void {
    this.encoder.free();
  }
}
