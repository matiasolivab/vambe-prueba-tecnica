import type { Logger } from "@/shared/infrastructure/logger";
import { TokenLimitExceededError } from "@/classification/domain/errors";

export interface Tokenizer {
  encode(text: string): Uint32Array;
  decode(tokens: Uint32Array): string;
}

export interface TokenFit {
  readonly text: string;
  readonly originalTokens: number;
  readonly finalTokens: number;
  readonly truncated: boolean;
}

const DEFAULT_BUDGET = 8000;
const DEFAULT_MARKER = "\n\n[...TRUNCATED...]\n\n";
const HEAD_RATIO = 0.7;
const TAIL_RATIO = 0.3;

export class TokenBudgetService {
  public constructor(
    private readonly tokenizer: Tokenizer,
    private readonly logger: Logger,
    private readonly budget: number = DEFAULT_BUDGET,
    private readonly marker: string = DEFAULT_MARKER,
  ) {}

  public fit(text: string): TokenFit {
    const tokens = this.tokenizer.encode(text);
    const originalTokens = tokens.length;

    if (originalTokens <= this.budget) {
      return {
        text,
        originalTokens,
        finalTokens: originalTokens,
        truncated: false,
      };
    }

    return this.truncate(tokens, originalTokens);
  }

  private truncate(tokens: Uint32Array, originalTokens: number): TokenFit {
    const markerTokens = this.tokenizer.encode(this.marker).length;
    const usable = Math.max(0, this.budget - markerTokens);
    const headCount = Math.floor(HEAD_RATIO * usable);
    const tailCount = Math.floor(TAIL_RATIO * usable);

    const headText = this.tokenizer.decode(tokens.slice(0, headCount));
    const tailText = this.tokenizer.decode(
      tokens.slice(tokens.length - tailCount),
    );
    const combined = headText + this.marker + tailText;
    const finalTokens = this.tokenizer.encode(combined).length;

    if (finalTokens > this.budget) {
      throw new TokenLimitExceededError(finalTokens, this.budget);
    }

    this.logger.warn("token_budget.truncated", {
      originalTokens,
      finalTokens,
      budget: this.budget,
    });

    return {
      text: combined,
      originalTokens,
      finalTokens,
      truncated: true,
    };
  }
}
