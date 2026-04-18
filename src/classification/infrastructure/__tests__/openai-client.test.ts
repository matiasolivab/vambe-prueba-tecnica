import { describe, it, expect, beforeEach, vi } from "vitest";
import OpenAI from "openai";

import { OpenAIClient, type Sleep } from "../openai-client";
import {
  ClassificationSchema,
  type Classification,
} from "@/classification/domain/schema";
import {
  ClassificationFailedError,
  InvalidSchemaError,
  LLMTimeoutError,
} from "@/classification/domain/errors";
import { JsonLogger } from "@/shared/infrastructure/logger";
import { FixedClock } from "@/shared/infrastructure/clock";

/**
 * Tests for the OpenAI adapter.
 *
 * We never reach out to OpenAI. The adapter's public surface is
 * `classify(system, user)`, which internally calls
 * `openai.chat.completions.parse({...})`. We fake that one method with
 * `vi.fn()` and script per-scenario behaviour via the `mockOpenAI` helper.
 *
 * Retry timing is exercised via an injected `Sleep` fake — nothing in these
 * tests actually waits. The assertion surface is the sequence of sleep
 * durations the adapter requested (1s, 2s, 4s by default).
 */

const MODEL_VERSION = "gpt-4o-mini-2024-07-18";

/** Canonical classification fixture — satisfies ClassificationSchema exactly. */
const goodClassification: Classification = {
  reasoning:
    "Cliente menciona e-commerce con 500 tickets diarios repetitivos; saturación evidente del equipo.",
  industry: "E-commerce",
  companySize: "Startup",
  mainPainPoint: "Volumen Repetitivo",
  keyObjection: "Ninguna",
  buyingSignal: "Muy Interesado",
  sentiment: "Positivo",
  needsSummary:
    "El cliente opera un e-commerce con 500 consultas diarias repetitivas y necesita automatizar respuestas para liberar al equipo de soporte.",
  nextSteps:
    "Agendar demo en los próximos cinco días hábiles y preparar propuesta comercial al volumen reportado.",
};

type Scenario =
  | "success"
  | "fail-then-success"
  | "always-429"
  | "always-timeout"
  | "auth-error"
  | "bad-request"
  | "refusal"
  | "bad-schema"
  | "rate-then-internal-then-success"
  | "always-500";

interface MockBundle {
  readonly client: OpenAI;
  readonly parse: ReturnType<typeof vi.fn>;
}

/** Build a minimal object shaped like `openai.chat.completions.parse`'s return. */
function successResponse(): unknown {
  return {
    choices: [
      {
        message: {
          parsed: goodClassification,
          refusal: null,
        },
      },
    ],
    model: MODEL_VERSION,
  };
}

function refusalResponse(): unknown {
  return {
    choices: [
      {
        message: {
          parsed: null,
          refusal: "cannot comply",
        },
      },
    ],
    model: MODEL_VERSION,
  };
}

function badSchemaResponse(): unknown {
  // `parsed` is object-shaped but the `industry` value is not in the enum AND
  // `needsSummary` is too short (<50). The belt-check Zod parse catches this.
  return {
    choices: [
      {
        message: {
          parsed: {
            ...goodClassification,
            industry: "No-Existe-En-El-Enum",
            needsSummary: "too short",
          },
          refusal: null,
        },
      },
    ],
    model: MODEL_VERSION,
  };
}

/**
 * Builds a fake OpenAI client plus the underlying parse mock, configured for
 * the requested behaviour. Returning the mock separately lets tests assert on
 * call count / arguments.
 */
function mockOpenAI(scenario: Scenario): MockBundle {
  const parse = vi.fn();

  switch (scenario) {
    case "success":
      parse.mockResolvedValue(successResponse());
      break;
    case "refusal":
      parse.mockResolvedValue(refusalResponse());
      break;
    case "bad-schema":
      parse.mockResolvedValue(badSchemaResponse());
      break;
    case "fail-then-success": {
      const err = new OpenAI.RateLimitError(
        429,
        { error: { message: "rate limit" } },
        "rate limit",
        new Headers(),
      );
      parse
        .mockRejectedValueOnce(err)
        .mockResolvedValueOnce(successResponse());
      break;
    }
    case "rate-then-internal-then-success": {
      const rate = new OpenAI.RateLimitError(
        429,
        { error: { message: "rate limit" } },
        "rate limit",
        new Headers(),
      );
      const internal = new OpenAI.InternalServerError(
        502,
        { error: { message: "bad gateway" } },
        "bad gateway",
        new Headers(),
      );
      parse
        .mockRejectedValueOnce(rate)
        .mockRejectedValueOnce(internal)
        .mockResolvedValueOnce(successResponse());
      break;
    }
    case "always-429": {
      const err = new OpenAI.RateLimitError(
        429,
        { error: { message: "rate limit" } },
        "rate limit",
        new Headers(),
      );
      parse.mockRejectedValue(err);
      break;
    }
    case "always-500": {
      const err = new OpenAI.InternalServerError(
        500,
        { error: { message: "server error" } },
        "server error",
        new Headers(),
      );
      parse.mockRejectedValue(err);
      break;
    }
    case "always-timeout": {
      const err = new OpenAI.APIConnectionTimeoutError({
        message: "request timed out",
      });
      parse.mockRejectedValue(err);
      break;
    }
    case "auth-error": {
      const err = new OpenAI.AuthenticationError(
        401,
        { error: { message: "invalid api key" } },
        "invalid api key",
        new Headers(),
      );
      parse.mockRejectedValue(err);
      break;
    }
    case "bad-request": {
      const err = new OpenAI.BadRequestError(
        400,
        { error: { message: "bad prompt" } },
        "bad prompt",
        new Headers(),
      );
      parse.mockRejectedValue(err);
      break;
    }
  }

  // Only the `.chat.completions.parse` surface is exercised.
  const client = {
    chat: { completions: { parse } },
  } as unknown as OpenAI;

  return { client, parse };
}

interface Captured {
  readonly lines: string[];
  readonly logger: JsonLogger;
  readonly sleep: Sleep & ReturnType<typeof vi.fn>;
}

function captureLogger(): Captured {
  const lines: string[] = [];
  const clock = new FixedClock(new Date("2026-04-16T10:00:00.000Z"));
  const logger = new JsonLogger(clock, (l) => lines.push(l));
  const sleep = vi.fn<Sleep>().mockResolvedValue(undefined) as Sleep &
    ReturnType<typeof vi.fn>;
  return { lines, logger, sleep };
}

function buildClient(
  bundle: MockBundle,
  captured: Captured,
  overrides: {
    maxAttempts?: number;
    backoffBaseMs?: number;
  } = {},
): OpenAIClient {
  return new OpenAIClient(bundle.client, ClassificationSchema, {
    model: "gpt-4o-mini",
    temperature: 0,
    maxAttempts: overrides.maxAttempts ?? 3,
    backoffBaseMs: overrides.backoffBaseMs ?? 1000,
    sleep: captured.sleep,
    logger: captured.logger,
  });
}

describe("OpenAIClient", () => {
  let captured: Captured;

  beforeEach(() => {
    captured = captureLogger();
  });

  it("happy path — single call returns classification + modelVersion", async () => {
    const bundle = mockOpenAI("success");
    const client = buildClient(bundle, captured);

    const result = await client.classify("system", "user");

    expect(result.classification).toEqual(goodClassification);
    expect(result.modelVersion).toBe(MODEL_VERSION);
    expect(bundle.parse).toHaveBeenCalledTimes(1);
    expect(captured.sleep).not.toHaveBeenCalled();
    expect(captured.lines).toHaveLength(0);
  });

  it("passes model + temperature + response_format to parse()", async () => {
    const bundle = mockOpenAI("success");
    const client = buildClient(bundle, captured);

    await client.classify("system-prompt-text", "user-prompt-text");

    expect(bundle.parse).toHaveBeenCalledTimes(1);
    const callArg = bundle.parse.mock.calls[0]?.[0];
    expect(callArg).toMatchObject({
      model: "gpt-4o-mini",
      temperature: 0,
    });
    expect(callArg.messages).toEqual([
      { role: "system", content: "system-prompt-text" },
      { role: "user", content: "user-prompt-text" },
    ]);
    expect(callArg.response_format).toBeTypeOf("object");
  });

  it("retries on 429 then succeeds — sleep(1000) called exactly once", async () => {
    const bundle = mockOpenAI("fail-then-success");
    const client = buildClient(bundle, captured);

    const result = await client.classify("system", "user");

    expect(result.classification).toEqual(goodClassification);
    expect(bundle.parse).toHaveBeenCalledTimes(2);
    expect(captured.sleep).toHaveBeenCalledTimes(1);
    expect(captured.sleep).toHaveBeenNthCalledWith(1, 1000);
  });

  it("retries on 429 then 502 then succeeds — sleeps 1000 then 2000", async () => {
    const bundle = mockOpenAI("rate-then-internal-then-success");
    const client = buildClient(bundle, captured);

    const result = await client.classify("system", "user");

    expect(result.classification).toEqual(goodClassification);
    expect(bundle.parse).toHaveBeenCalledTimes(3);
    expect(captured.sleep).toHaveBeenCalledTimes(2);
    expect(captured.sleep).toHaveBeenNthCalledWith(1, 1000);
    expect(captured.sleep).toHaveBeenNthCalledWith(2, 2000);
  });

  it("all 3 attempts time out → throws LLMTimeoutError; sleep called 2 times", async () => {
    const bundle = mockOpenAI("always-timeout");
    const client = buildClient(bundle, captured);

    await expect(client.classify("s", "u")).rejects.toBeInstanceOf(
      LLMTimeoutError,
    );

    expect(bundle.parse).toHaveBeenCalledTimes(3);
    // Between attempts 1→2 and 2→3: 2 sleeps. None after the last attempt.
    expect(captured.sleep).toHaveBeenCalledTimes(2);
    expect(captured.sleep).toHaveBeenNthCalledWith(1, 1000);
    expect(captured.sleep).toHaveBeenNthCalledWith(2, 2000);

    try {
      await client.classify("s", "u");
    } catch (e) {
      if (!(e instanceof LLMTimeoutError)) throw e;
      expect(e.attempt).toBe(3);
      expect(e.durationMs).toBeGreaterThanOrEqual(0);
    }
  });

  it("non-retriable 401 auth error → throws ClassificationFailedError immediately", async () => {
    const bundle = mockOpenAI("auth-error");
    const client = buildClient(bundle, captured);

    await expect(client.classify("s", "u")).rejects.toBeInstanceOf(
      ClassificationFailedError,
    );
    expect(bundle.parse).toHaveBeenCalledTimes(1);
    expect(captured.sleep).not.toHaveBeenCalled();
  });

  it("non-retriable 400 bad request → throws ClassificationFailedError immediately", async () => {
    const bundle = mockOpenAI("bad-request");
    const client = buildClient(bundle, captured);

    await expect(client.classify("s", "u")).rejects.toBeInstanceOf(
      ClassificationFailedError,
    );
    expect(bundle.parse).toHaveBeenCalledTimes(1);
    expect(captured.sleep).not.toHaveBeenCalled();
  });

  it("refusal (parsed === null) → throws InvalidSchemaError with NO retry", async () => {
    const bundle = mockOpenAI("refusal");
    const client = buildClient(bundle, captured);

    await expect(client.classify("s", "u")).rejects.toBeInstanceOf(
      InvalidSchemaError,
    );
    expect(bundle.parse).toHaveBeenCalledTimes(1);
    expect(captured.sleep).not.toHaveBeenCalled();
  });

  it("belt-check Zod failure → throws InvalidSchemaError with populated issues", async () => {
    const bundle = mockOpenAI("bad-schema");
    const client = buildClient(bundle, captured);

    try {
      await client.classify("s", "u");
      throw new Error("should have thrown");
    } catch (e) {
      expect(e).toBeInstanceOf(InvalidSchemaError);
      if (!(e instanceof InvalidSchemaError)) throw e;
      expect(e.issues.length).toBeGreaterThan(0);
      expect(e.issues.some((i) => i.path.includes("industry"))).toBe(true);
    }
    // Schema failures are NOT retriable.
    expect(bundle.parse).toHaveBeenCalledTimes(1);
    expect(captured.sleep).not.toHaveBeenCalled();
  });

  it("exponential backoff ratio — backoffBaseMs 100, maxAttempts 4 → sleeps 100, 200, 400", async () => {
    const bundle = mockOpenAI("always-500");
    const client = buildClient(bundle, captured, {
      maxAttempts: 4,
      backoffBaseMs: 100,
    });

    await expect(client.classify("s", "u")).rejects.toBeInstanceOf(
      ClassificationFailedError,
    );

    expect(bundle.parse).toHaveBeenCalledTimes(4);
    expect(captured.sleep).toHaveBeenCalledTimes(3);
    expect(captured.sleep).toHaveBeenNthCalledWith(1, 100);
    expect(captured.sleep).toHaveBeenNthCalledWith(2, 200);
    expect(captured.sleep).toHaveBeenNthCalledWith(3, 400);
  });

  it("logger emits `llm.retry` warn on every retry attempt", async () => {
    const bundle = mockOpenAI("fail-then-success");
    const client = buildClient(bundle, captured);

    await client.classify("s", "u");

    expect(captured.lines).toHaveLength(1);
    const entry = JSON.parse(captured.lines[0]!);
    expect(entry.level).toBe("warn");
    expect(entry.event).toBe("llm.retry");
    expect(entry.attempt).toBe(1);
    expect(entry.nextDelayMs).toBe(1000);
    expect(typeof entry.reason).toBe("string");
  });

  it("modelVersion propagation — uses EXACT id from response.model", async () => {
    const bundle = mockOpenAI("success");
    // Override: return a different concrete model id.
    bundle.parse.mockResolvedValue({
      choices: [
        {
          message: { parsed: goodClassification, refusal: null },
        },
      ],
      model: "gpt-4o-mini-2024-07-18",
    });
    const client = buildClient(bundle, captured);

    const result = await client.classify("s", "u");

    expect(result.modelVersion).toBe("gpt-4o-mini-2024-07-18");
  });
});
