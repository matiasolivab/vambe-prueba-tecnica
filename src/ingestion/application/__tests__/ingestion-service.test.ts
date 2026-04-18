import { describe, it, expect, beforeEach, vi } from "vitest";

import {
  IngestionService,
  type IngestionProgress,
  type ProgressCallback,
} from "../ingestion-service";
import type { CsvParser, ParseResult } from "@/ingestion/infrastructure/csv-parser";
import type {
  ClassificationResult,
  ClassificationTask,
  TranscriptClassifier,
} from "@/classification/application/classifier";
import type { Classification } from "@/classification/domain/schema";
import type { ClientRepository } from "@/clients/application/client-repository";
import type { Client, NewClient } from "@/clients/infrastructure/db/schema";
import {
  ClassificationFailedError,
  InvalidSchemaError,
  LLMTimeoutError,
  TokenLimitExceededError,
} from "@/classification/domain/errors";
import { CLASSIFIER_VERSION } from "@/classification/domain/version";
import { InvalidCsvFormatError } from "@/ingestion/domain/errors";
import { JsonLogger } from "@/shared/infrastructure/logger";
import { FixedClock } from "@/shared/infrastructure/clock";

const MODEL_VERSION = "gpt-4o-mini-2024-07-18";

function validClassification(
  overrides: Partial<Classification> = {},
): Classification {
  return {
    reasoning:
      "El cliente describe un equipo saturado y evalúa soluciones para los próximos meses.",
    industry: "Tecnología",
    companySize: "PYME",
    mainPainPoint: "Equipo Saturado",
    keyObjection: "Ninguna",
    leadSource: "No Mencionado",
    sentiment: "Neutro",
    needsSummary:
      "Necesita automatizar respuestas a clientes frecuentes y liberar tiempo del equipo de soporte para casos complejos.",
    nextSteps:
      "Enviar propuesta técnica y agendar demo con el equipo la próxima semana.",
    ...overrides,
  };
}

function validClassificationResult(
  overrides: Partial<ClassificationResult> = {},
): ClassificationResult {
  return {
    classification: validClassification(),
    modelVersion: MODEL_VERSION,
    promptVersion: CLASSIFIER_VERSION,
    truncated: false,
    warnings: [],
    ...overrides,
  };
}

function okRow(
  rowNumber: number,
  overrides: Partial<NewClient> = {},
): Extract<ParseResult, { ok: true }> {
  const row: NewClient = {
    name: "Juan Pérez",
    email: `user${rowNumber}@example.com`,
    phone: "+56911112222",
    meetingDate: new Date("2026-03-15T10:00:00.000Z"),
    assignedSeller: "Ana",
    closed: false,
    transcript: "transcripción real",
    classificationStatus: "pending",
    truncated: false,
    warnings: [],
    ...overrides,
  };
  return { ok: true, rowNumber, row };
}

function badRow(
  rowNumber: number,
  error = "email inválido",
): Extract<ParseResult, { ok: false }> {
  return { ok: false, rowNumber, error };
}

class FakeCsvParser {
  public readonly parse = vi.fn<CsvParser["parse"]>();
}

class FakeClassifier {
  public readonly classify = vi.fn<
    (task: ClassificationTask) => Promise<ClassificationResult>
  >();
}

class FakeRepository implements ClientRepository {
  public readonly upserts: NewClient[] = [];
  public readonly upsertByEmail = vi.fn(
    async (client: NewClient): Promise<Client> => {
      this.upserts.push(client);
      return {
        id: "fake-id",
        createdAt: new Date("2026-04-16T10:00:00.000Z"),
        updatedAt: new Date("2026-04-16T10:00:00.000Z"),
        industry: null,
        companySize: null,
        mainPainPoint: null,
        keyObjection: null,
        leadSource: null,
        sentiment: null,
        needsSummary: null,
        nextSteps: null,
        reasoning: null,
        promptVersion: null,
        modelVersion: null,
        errorMessage: null,
        phone: null,
        ...client,
      } as Client;
    },
  );
  public readonly findByEmail = vi.fn(async () => null);
  public readonly count = vi.fn(async () => 0);
  public readonly findAll = vi.fn(async (): Promise<readonly Client[]> => []);
  public readonly distinctSellers = vi.fn(
    async (): Promise<readonly string[]> => [],
  );
}

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

interface Harness {
  readonly service: IngestionService;
  readonly parser: FakeCsvParser;
  readonly classifier: FakeClassifier;
  readonly repo: FakeRepository;
  readonly captured: Captured;
}

function buildHarness(): Harness {
  const parser = new FakeCsvParser();
  const classifier = new FakeClassifier();
  const repo = new FakeRepository();
  const captured = captureLogger();
  const service = new IngestionService(
    parser as unknown as CsvParser,
    classifier as unknown as TranscriptClassifier,
    repo,
    captured.logger,
  );
  return { service, parser, classifier, repo, captured };
}

describe("IngestionService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("happy path — 2 valid rows both classify and upsert", async () => {
    const { service, parser, classifier, repo } = buildHarness();
    const r1 = okRow(2);
    const r2 = okRow(3);
    parser.parse.mockReturnValue([r1, r2]);
    classifier.classify.mockResolvedValue(validClassificationResult());

    const progress: IngestionProgress[] = [];
    const report = await service.ingest("csv-string", (snap) => {
      progress.push(snap);
    });

    expect(report.succeeded).toBe(2);
    expect(report.failed).toBe(0);
    expect(report.total).toBe(2);
    expect(report.parseErrors).toEqual([]);
    expect(report.classificationErrors).toEqual([]);
    expect(repo.upsertByEmail).toHaveBeenCalledTimes(2);
    expect(progress).toHaveLength(2);
    expect(progress[1]!.processed).toBe(2);
  });

  it("parse error mixed with valid rows — parse-failed row not persisted", async () => {
    const { service, parser, classifier, repo } = buildHarness();
    parser.parse.mockReturnValue([okRow(2), badRow(3, "email inválido"), okRow(4)]);
    classifier.classify.mockResolvedValue(validClassificationResult());

    const report = await service.ingest("csv");

    expect(report.total).toBe(3);
    expect(report.succeeded).toBe(2);
    expect(report.failed).toBe(1);
    expect(report.parseErrors).toHaveLength(1);
    expect(report.parseErrors[0]).toEqual({ rowNumber: 3, error: "email inválido" });
    expect(repo.upsertByEmail).toHaveBeenCalledTimes(2);
  });

  it("LLMTimeoutError on row 1, success on row 2 — both persist, one marked failed", async () => {
    const { service, parser, classifier, repo } = buildHarness();
    parser.parse.mockReturnValue([okRow(2), okRow(3)]);
    classifier.classify
      .mockRejectedValueOnce(new LLMTimeoutError(3, 12000))
      .mockResolvedValueOnce(validClassificationResult());

    const report = await service.ingest("csv");

    expect(report.succeeded).toBe(1);
    expect(report.failed).toBe(1);
    expect(report.classificationErrors).toHaveLength(1);
    expect(report.classificationErrors[0]!.code).toBe("llm.timeout");
    expect(repo.upsertByEmail).toHaveBeenCalledTimes(2);

    const failedUpsert = repo.upserts[0]!;
    expect(failedUpsert.classificationStatus).toBe("failed");
    expect(failedUpsert.errorMessage).toContain("LLMTimeoutError");
    expect(failedUpsert.promptVersion).toBe(CLASSIFIER_VERSION);

    const okUpsert = repo.upserts[1]!;
    expect(okUpsert.classificationStatus).toBe("classified");
    expect(okUpsert.errorMessage).toBeNull();
  });

  it("InvalidSchemaError is persisted as failed with wrapper message", async () => {
    const { service, parser, classifier, repo } = buildHarness();
    parser.parse.mockReturnValue([okRow(2)]);
    classifier.classify.mockRejectedValue(
      new InvalidSchemaError([{ path: ["industry"], message: "bad" }]),
    );

    const report = await service.ingest("csv");

    expect(report.failed).toBe(1);
    expect(repo.upserts[0]!.classificationStatus).toBe("failed");
    expect(repo.upserts[0]!.errorMessage).toContain("InvalidSchemaError");
  });

  it("TokenLimitExceededError is persisted as failed", async () => {
    const { service, parser, classifier, repo } = buildHarness();
    parser.parse.mockReturnValue([okRow(2)]);
    classifier.classify.mockRejectedValue(new TokenLimitExceededError(10000, 8000));

    const report = await service.ingest("csv");

    expect(report.failed).toBe(1);
    expect(repo.upserts[0]!.classificationStatus).toBe("failed");
    expect(repo.upserts[0]!.errorMessage).toContain("TokenLimitExceededError");
  });

  it("ClassificationFailedError (non-empty email) persisted with failed status", async () => {
    const { service, parser, classifier, repo } = buildHarness();
    parser.parse.mockReturnValue([okRow(2, { email: "alice@example.com" })]);
    classifier.classify.mockRejectedValue(
      new ClassificationFailedError("alice@example.com", "retries exhausted"),
    );

    const report = await service.ingest("csv");

    expect(report.failed).toBe(1);
    expect(repo.upserts[0]!.classificationStatus).toBe("failed");
    expect(repo.upserts[0]!.email).toBe("alice@example.com");
    expect(repo.upserts[0]!.errorMessage).toContain("ClassificationFailedError");
    expect(repo.upserts[0]!.errorMessage).toContain("retries exhausted");
  });

  it("InvalidCsvFormatError from parser propagates — no persist", async () => {
    const { service, parser, repo } = buildHarness();
    const err = new InvalidCsvFormatError(["Nombre"], []);
    parser.parse.mockImplementation(() => {
      throw err;
    });

    await expect(service.ingest("csv")).rejects.toBe(err);
    expect(repo.upsertByEmail).not.toHaveBeenCalled();
  });

  it("non-DomainError from classifier rethrows — batch stops mid-run", async () => {
    const { service, parser, classifier, repo } = buildHarness();
    parser.parse.mockReturnValue([okRow(2), okRow(3), okRow(4)]);
    const bug = new Error("unexpected");
    classifier.classify
      .mockResolvedValueOnce(validClassificationResult())
      .mockRejectedValueOnce(bug);

    await expect(service.ingest("csv")).rejects.toBe(bug);
    expect(repo.upsertByEmail).toHaveBeenCalledTimes(1);
  });

  it("progress callback fires exactly once per processed row with ascending counts", async () => {
    const { service, parser, classifier } = buildHarness();
    parser.parse.mockReturnValue([okRow(2), okRow(3), okRow(4)]);
    classifier.classify.mockResolvedValue(validClassificationResult());

    const cb: ProgressCallback = vi.fn();
    await service.ingest("csv", cb);

    expect(cb).toHaveBeenCalledTimes(3);
    const calls = (cb as ReturnType<typeof vi.fn>).mock.calls;
    expect((calls[0]![0] as IngestionProgress).processed).toBe(1);
    expect((calls[1]![0] as IngestionProgress).processed).toBe(2);
    expect((calls[2]![0] as IngestionProgress).processed).toBe(3);
  });

  it("logs ingestion.batch_complete with aggregate counts", async () => {
    const { service, parser, classifier, captured } = buildHarness();
    parser.parse.mockReturnValue([okRow(2), okRow(3)]);
    classifier.classify
      .mockResolvedValueOnce(validClassificationResult())
      .mockRejectedValueOnce(new LLMTimeoutError(3, 12000));

    await service.ingest("csv");

    const completeLines = captured.lines
      .map((l) => JSON.parse(l) as Record<string, unknown>)
      .filter((e) => e.event === "ingestion.batch_complete");
    expect(completeLines).toHaveLength(1);
    const entry = completeLines[0]!;
    expect(entry.level).toBe("info");
    expect(entry.total).toBe(2);
    expect(entry.succeeded).toBe(1);
    expect(entry.failed).toBe(1);
  });

  it("classifier receives { email, transcript } of each parsed row", async () => {
    const { service, parser, classifier } = buildHarness();
    const r1 = okRow(2, { email: "a@x.com", transcript: "t1" });
    const r2 = okRow(3, { email: "b@x.com", transcript: "t2" });
    parser.parse.mockReturnValue([r1, r2]);
    classifier.classify.mockResolvedValue(validClassificationResult());

    await service.ingest("csv");

    expect(classifier.classify).toHaveBeenNthCalledWith(1, {
      email: "a@x.com",
      transcript: "t1",
    });
    expect(classifier.classify).toHaveBeenNthCalledWith(2, {
      email: "b@x.com",
      transcript: "t2",
    });
  });

  it("persistSuccess maps classification fields + promptVersion + warnings onto NewClient", async () => {
    const { service, parser, classifier, repo } = buildHarness();
    parser.parse.mockReturnValue([okRow(2, { email: "c@x.com" })]);
    const classification = validClassification({
      industry: "Salud",
      sentiment: "Positivo",
    });
    classifier.classify.mockResolvedValue(
      validClassificationResult({
        classification,
        promptVersion: "9.9.9",
        truncated: true,
        warnings: [{ name: "r1", severity: "warning", message: "m" }],
      }),
    );

    await service.ingest("csv");

    const u = repo.upserts[0]!;
    expect(u.email).toBe("c@x.com");
    expect(u.industry).toBe("Salud");
    expect(u.sentiment).toBe("Positivo");
    expect(u.companySize).toBe(classification.companySize);
    expect(u.reasoning).toBe(classification.reasoning);
    expect(u.needsSummary).toBe(classification.needsSummary);
    expect(u.nextSteps).toBe(classification.nextSteps);
    expect(u.promptVersion).toBe("9.9.9");
    expect(u.modelVersion).toBe(MODEL_VERSION);
    expect(u.truncated).toBe(true);
    expect(u.classificationStatus).toBe("classified");
    expect(u.errorMessage).toBeNull();
    expect(u.warnings).toEqual([
      { name: "r1", severity: "warning", message: "m" },
    ]);
  });
});
