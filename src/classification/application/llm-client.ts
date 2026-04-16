import type { Classification } from "@/classification/domain/schema";

/**
 * Port: the minimum surface the classifier needs from an LLM provider.
 *
 * The concrete adapter for OpenAI lives in
 * `classification/infrastructure/openai-client.ts` and is injected into
 * `TranscriptClassifier` (application). Dependency direction points inward:
 * this port has zero knowledge of OpenAI's SDK, retry strategy, Structured
 * Outputs helpers, or error shapes.
 *
 * Tests can trivially replace it with a deterministic fake.
 */
export interface LLMClient {
  classify(systemPrompt: string, userPrompt: string): Promise<LLMResult>;
}

/**
 * Result of a single classification call.
 *
 * - `classification`: fully parsed + schema-validated domain object.
 * - `modelVersion`: the EXACT model id the provider echoed back
 *   (e.g. `gpt-4o-mini-2024-07-18`). Persisted on the client row for
 *   traceability (PRD §RF2.8, ARCHITECTURE §13 rule 13) so we can replay /
 *   audit classifications against the specific weights that produced them.
 */
export interface LLMResult {
  readonly classification: Classification;
  readonly modelVersion: string;
}
