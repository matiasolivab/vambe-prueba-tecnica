import { encoding_for_model, type Tiktoken } from "tiktoken";
import type { Tokenizer } from "@/classification/application/token-budget";

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
