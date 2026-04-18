import type { Classification } from "@/classification/domain/schema";

export interface LLMClient {
  classify(systemPrompt: string, userPrompt: string): Promise<LLMResult>;
}

export interface LLMResult {
  readonly classification: Classification;
  readonly modelVersion: string;
}
