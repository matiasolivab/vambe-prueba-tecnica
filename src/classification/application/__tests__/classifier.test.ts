import { describe, it, expect, beforeEach, vi } from "vitest";

import {
  TranscriptClassifier,
  type ClassificationTask,
  type EmailHasher,
} from "../classifier";
import type { LLMClient, LLMResult } from "../llm-client";
import type { TokenBudgetService, TokenFit } from "../token-budget";
import type { ClassificationValidator, Warning } from "../validator";
import type { PromptBuilder } from "@/classification/infrastructure/prompt-builder";
import type { Classification } from "@/classification/domain/schema";
import {
  ClassificationFailedError,
  InvalidSchemaError,
  LLMTimeoutError,
  TokenLimitExceededError,
} from "@/classification/domain/errors";
import { CLASSIFIER_VERSION } from "@/classification/domain/version";
import { JsonLogger } from "@/shared/infrastructure/logger";
import { FixedClock } from "@/shared/infrastructure/clock";

const MODEL_VERSION = "gpt-4o-mini-2024-07-18";

function validClassification(
  overrides: Partial<Classification> = {},
): Classification {
  const base: Classification = {
    reasoning:
      "El cliente describe un equipo saturado y evalúa soluciones para los próximos meses.",
    industry: "Tecnología",
    companySize: "PYME",
    mainPainPoint: "Equipo Saturado",
    keyObjection: "Ninguna",
    leadSource: "No Mencionado",
    sentiment: "Neutro",
    needsSummary:
      "Necesita automatizar respuestas a clientes frecuentes y liberar tiempo del equipo de soporte.",
    nextSteps: "Enviar propuesta técnica y agendar demo la próxima semana.",
  };
  return { ...base, ...overrides };
}

class FakeLLMClient implements LLMClient {
  public readonly classify = vi.fn<LLMClient["classify"]>();
}

class FakeTokenBudget {
  public readonly fit = vi.fn<(text: string) => TokenFit>();
}

class FakePromptBuilder {
  public readonly buildSystemPrompt = vi.fn<() => string>();
  public readonly buildUserPrompt = vi.fn<(transcript: string) => string>();
}

class FakeValidator {
  public readonly validate = vi.fn<
    (c: Classification) => readonly Warning[]
  >();
}

const fakeHasher: EmailHasher = (email) => `H_${email.charAt(0)}`;

interface Captured {
  readonly lines: string[];
  readonly logger: JsonLogger;
}

function captureLogger(): Captured {
  const lines: string[] = [];
  const clock = new FixedClock(new Date("2026-04-16T10:00:00.000Z"));
  const logger = new JsonLogger(clock, (l) => lines.push(l));
  return { lines, logger };
}

interface BuildOptions {
  readonly fit?: TokenFit;
  readonly llm?: () => Promise<LLMResult> | LLMResult;
  readonly llmThrows?: unknown;
  readonly warnings?: readonly Warning[];
  readonly system?: string;
  readonly user?: (transcript: string) => string;
  readonly classifierVersion?: string;
}

interface Harness {
  readonly classifier: TranscriptClassifier;
  readonly llm: FakeLLMClient;
  readonly budget: FakeTokenBudget;
  readonly prompt: FakePromptBuilder;
  readonly validator: FakeValidator;
  readonly captured: Captured;
}

function buildHarness(opts: BuildOptions = {}): Harness {
  const llm = new FakeLLMClient();
  const budget = new FakeTokenBudget();
  const prompt = new FakePromptBuilder();
  const validator = new FakeValidator();
  const captured = captureLogger();

  const fit: TokenFit = opts.fit ?? {
    text: "FIT",
    originalTokens: 100,
    finalTokens: 100,
    truncated: false,
  };
  budget.fit.mockReturnValue(fit);

  prompt.buildSystemPrompt.mockReturnValue(opts.system ?? "SYS");
  prompt.buildUserPrompt.mockImplementation(
    opts.user ?? ((t) => `USER(${t})`),
  );

  if (opts.llmThrows !== undefined) {
    llm.classify.mockRejectedValue(opts.llmThrows);
  } else if (opts.llm) {
    llm.classify.mockImplementation(async () => opts.llm!());
  } else {
    llm.classify.mockResolvedValue({
      classification: validClassification(),
      modelVersion: MODEL_VERSION,
    });
  }

  validator.validate.mockReturnValue(opts.warnings ?? []);

  const classifier =
    opts.classifierVersion !== undefined
      ? new TranscriptClassifier(
          llm,
          budget as unknown as TokenBudgetService,
          prompt as unknown as PromptBuilder,
          validator as unknown as ClassificationValidator,
          captured.logger,
          fakeHasher,
          opts.classifierVersion,
        )
      : new TranscriptClassifier(
          llm,
          budget as unknown as TokenBudgetService,
          prompt as unknown as PromptBuilder,
          validator as unknown as ClassificationValidator,
          captured.logger,
          fakeHasher,
        );

  return { classifier, llm, budget, prompt, validator, captured };
}

function task(overrides: Partial<ClassificationTask> = {}): ClassificationTask {
  return {
    email: "juan@example.com",
    transcript: "transcripción original del cliente",
    ...overrides,
  };
}

describe("TranscriptClassifier", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("happy path — no truncation, no warnings, returns consolidated result", async () => {
    const classification = validClassification();
    const { classifier, captured } = buildHarness({
      llm: () => ({ classification, modelVersion: MODEL_VERSION }),
    });

    const result = await classifier.classify(task());

    expect(result).toEqual({
      classification,
      modelVersion: MODEL_VERSION,
      promptVersion: CLASSIFIER_VERSION,
      truncated: false,
      warnings: [],
    });

    expect(captured.lines).toHaveLength(1);
    const entry = JSON.parse(captured.lines[0]!) as Record<string, unknown>;
    expect(entry.level).toBe("info");
    expect(entry.event).toBe("classification.completed");
  });

  it("happy path — truncated transcript propagates truncated=true and logs it", async () => {
    const fit: TokenFit = {
      text: "SHORTENED",
      originalTokens: 10000,
      finalTokens: 1000,
      truncated: true,
    };
    const { classifier, captured } = buildHarness({ fit });

    const result = await classifier.classify(task());

    expect(result.truncated).toBe(true);
    const entry = JSON.parse(captured.lines[0]!) as Record<string, unknown>;
    expect(entry.truncated).toBe(true);
    expect(entry.originalTokens).toBe(10000);
    expect(entry.finalTokens).toBe(1000);
  });

  it("happy path — warnings populated propagate into the result and log meta", async () => {
    const warnings: readonly Warning[] = [
      { name: "x", severity: "warning", message: "m" },
    ];
    const { classifier, captured } = buildHarness({ warnings });

    const result = await classifier.classify(task());

    expect(result.warnings).toEqual(warnings);
    const entry = JSON.parse(captured.lines[0]!) as Record<string, unknown>;
    expect(entry.warningCount).toBe(1);
  });

  it("LLMTimeoutError propagates unchanged", async () => {
    const err = new LLMTimeoutError(3, 12000);
    const { classifier } = buildHarness({ llmThrows: err });

    try {
      await classifier.classify(task());
      throw new Error("should have thrown");
    } catch (e) {
      expect(e).toBe(err); // same instance — no wrap
    }
  });

  it("InvalidSchemaError propagates unchanged", async () => {
    const err = new InvalidSchemaError([
      { path: ["industry"], message: "bad" },
    ]);
    const { classifier } = buildHarness({ llmThrows: err });

    try {
      await classifier.classify(task());
      throw new Error("should have thrown");
    } catch (e) {
      expect(e).toBe(err);
    }
  });

  it("TokenLimitExceededError from TokenBudgetService propagates unchanged", async () => {
    const err = new TokenLimitExceededError(10000, 8000);
    const { classifier, budget, llm } = buildHarness();
    budget.fit.mockImplementation(() => {
      throw err;
    });

    try {
      await classifier.classify(task());
      throw new Error("should have thrown");
    } catch (e) {
      expect(e).toBe(err);
    }
    expect(llm.classify).not.toHaveBeenCalled();
  });

  it("ClassificationFailedError('', ...) is re-wrapped with task.email", async () => {
    const cause = new Error("network exploded");
    const thrown = new ClassificationFailedError("", "OpenAI failed", cause);
    const { classifier } = buildHarness({ llmThrows: thrown });

    try {
      await classifier.classify(task({ email: "alice@example.com" }));
      throw new Error("should have thrown");
    } catch (e) {
      expect(e).toBeInstanceOf(ClassificationFailedError);
      if (!(e instanceof ClassificationFailedError)) throw e;
      expect(e).not.toBe(thrown); // new instance, because re-wrapped
      expect(e.email).toBe("alice@example.com");
      expect(e.message).toBe("OpenAI failed");
      expect(e.cause).toBe(cause);
    }
  });

  it("ClassificationFailedError with non-empty email passes through unchanged", async () => {
    const thrown = new ClassificationFailedError(
      "other@x.com",
      "upstream failure",
    );
    const { classifier } = buildHarness({ llmThrows: thrown });

    try {
      await classifier.classify(task({ email: "juan@x.com" }));
      throw new Error("should have thrown");
    } catch (e) {
      expect(e).toBe(thrown);
    }
  });

  it("log uses hashed email — raw email never appears in any log line", async () => {
    const { classifier, captured } = buildHarness();

    await classifier.classify(task({ email: "juan@x.com" }));

    expect(captured.lines).toHaveLength(1);
    const entry = JSON.parse(captured.lines[0]!) as Record<string, unknown>;
    expect(entry.emailHash).toBe("H_j");
    for (const line of captured.lines) {
      expect(line).not.toContain("juan@x.com");
      expect(line).not.toContain("juan");
    }
  });

  it("prompt builder receives FIT text, not the original transcript", async () => {
    const fit: TokenFit = {
      text: "FIT",
      originalTokens: 100,
      finalTokens: 50,
      truncated: false,
    };
    const { classifier, prompt } = buildHarness({ fit });

    await classifier.classify(
      task({ transcript: "la transcripción ORIGINAL cruda" }),
    );

    expect(prompt.buildUserPrompt).toHaveBeenCalledTimes(1);
    expect(prompt.buildUserPrompt).toHaveBeenCalledWith("FIT");
  });

  it("promptVersion defaults to CLASSIFIER_VERSION when not injected", async () => {
    const { classifier } = buildHarness();

    const result = await classifier.classify(task());

    expect(result.promptVersion).toBe(CLASSIFIER_VERSION);
  });

  it("promptVersion honours injected classifierVersion", async () => {
    const { classifier } = buildHarness({ classifierVersion: "9.9.9" });

    const result = await classifier.classify(task());

    expect(result.promptVersion).toBe("9.9.9");
  });

  it("passes system + user prompts into LLMClient.classify", async () => {
    const { classifier, llm } = buildHarness({
      system: "SYSTEM-TEXT",
      user: (t) => `USER-TEXT(${t})`,
    });

    await classifier.classify(task());

    expect(llm.classify).toHaveBeenCalledTimes(1);
    expect(llm.classify).toHaveBeenCalledWith("SYSTEM-TEXT", "USER-TEXT(FIT)");
  });

  it("info log meta includes modelVersion for audit trail", async () => {
    const { classifier, captured } = buildHarness();

    await classifier.classify(task());

    const entry = JSON.parse(captured.lines[0]!) as Record<string, unknown>;
    expect(entry.modelVersion).toBe(MODEL_VERSION);
  });
});
