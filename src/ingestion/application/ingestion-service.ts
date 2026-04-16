import type {
  ClassificationResult,
  TranscriptClassifier,
} from "@/classification/application/classifier";
import { CLASSIFIER_VERSION } from "@/classification/domain/version";
import type { ClientRepository } from "@/clients/application/client-repository";
import type { NewClient } from "@/clients/infrastructure/db/schema";
import { DomainError } from "@/shared/domain/domain-error";
import type { Logger } from "@/shared/infrastructure/logger";

import type { CsvParser, ParseResult } from "../infrastructure/csv-parser";

/**
 * IngestionService — orchestrates the full upload pipeline: parse → classify →
 * persist, one row at a time, with per-row isolation.
 *
 * Responsibility (see `docs/ARCHITECTURE.md` §7 + §13 layer 8):
 *  - Reused by the SSE upload endpoint and by `scripts/seed.ts`.
 *  - Header-level failures (`InvalidCsvFormatError`) propagate — the entire
 *    batch is invalid and the caller (API route) must surface a 400.
 *  - Per-row failures NEVER crash the batch (PRD §RF1.4): parse errors land
 *    in `parseErrors`, classifier typed errors are caught and persisted with
 *    `classification_status: 'failed'` + `error_message` (PRD §RF2.5) so the
 *    UI can show them and offer retry.
 *  - Non-`DomainError` throws are bugs, not per-row noise — they bubble up.
 *  - Every successful row stamps `promptVersion` + `modelVersion` for
 *    auditability (PRD §RF2.8).
 *  - Progress is emitted after EACH processed row so the UI can render
 *    "N de T — last: email@x.com" (PRD §RF1.5).
 */

export interface IngestionProgress {
  readonly total: number;
  readonly processed: number;
  readonly succeeded: number;
  readonly failed: number;
  readonly lastEmail?: string;
  readonly lastError?: string;
}

export interface IngestionReport {
  readonly total: number;
  readonly succeeded: number;
  readonly failed: number;
  readonly parseErrors: readonly {
    readonly rowNumber: number;
    readonly error: string;
  }[];
  readonly classificationErrors: readonly {
    readonly email: string;
    readonly code: string;
    readonly message: string;
  }[];
}

export type ProgressCallback = (snapshot: IngestionProgress) => void;

interface MutableState {
  total: number;
  processed: number;
  succeeded: number;
  failed: number;
  lastEmail?: string;
  lastError?: string;
  parseErrors: { rowNumber: number; error: string }[];
  classificationErrors: { email: string; code: string; message: string }[];
}

export class IngestionService {
  public constructor(
    private readonly parser: CsvParser,
    private readonly classifier: TranscriptClassifier,
    private readonly repo: ClientRepository,
    private readonly logger: Logger,
  ) {}

  public async ingest(
    csv: string,
    onProgress?: ProgressCallback,
  ): Promise<IngestionReport> {
    const results = this.parser.parse(csv);
    const state = this.initState(results.length);
    for (const parsed of results) {
      if (parsed.ok) {
        await this.processValidRow(parsed, state, onProgress);
      } else {
        this.handleParseError(parsed, state, onProgress);
      }
    }
    this.logger.info("ingestion.batch_complete", {
      total: state.total,
      succeeded: state.succeeded,
      failed: state.failed,
    });
    return this.toReport(state);
  }

  private initState(total: number): MutableState {
    return {
      total,
      processed: 0,
      succeeded: 0,
      failed: 0,
      parseErrors: [],
      classificationErrors: [],
    };
  }

  private toReport(state: MutableState): IngestionReport {
    return {
      total: state.total,
      succeeded: state.succeeded,
      failed: state.failed,
      parseErrors: state.parseErrors,
      classificationErrors: state.classificationErrors,
    };
  }

  private handleParseError(
    parsed: Extract<ParseResult, { ok: false }>,
    state: MutableState,
    onProgress?: ProgressCallback,
  ): void {
    state.parseErrors.push({ rowNumber: parsed.rowNumber, error: parsed.error });
    state.processed += 1;
    state.failed += 1;
    state.lastError = parsed.error;
    this.emit(state, onProgress);
  }

  private async processValidRow(
    parsed: Extract<ParseResult, { ok: true }>,
    state: MutableState,
    onProgress?: ProgressCallback,
  ): Promise<void> {
    try {
      const result = await this.classifier.classify({
        email: parsed.row.email,
        transcript: parsed.row.transcript,
      });
      await this.persistSuccess(parsed, result);
      state.succeeded += 1;
    } catch (err) {
      if (!(err instanceof DomainError)) throw err;
      await this.handleRowFailure(parsed, err, state);
    } finally {
      state.processed += 1;
      state.lastEmail = parsed.row.email;
      this.emit(state, onProgress);
    }
  }

  private async handleRowFailure(
    parsed: Extract<ParseResult, { ok: true }>,
    err: DomainError,
    state: MutableState,
  ): Promise<void> {
    await this.persistFailure(parsed, err);
    state.classificationErrors.push({
      email: parsed.row.email,
      code: err.code,
      message: err.message,
    });
    state.failed += 1;
    state.lastError = err.message;
    this.logger.warn("ingestion.row_failed", {
      rowNumber: parsed.rowNumber,
      code: err.code,
      message: err.message,
    });
  }

  private async persistSuccess(
    parsed: Extract<ParseResult, { ok: true }>,
    result: ClassificationResult,
  ): Promise<void> {
    await this.repo.upsertByEmail(this.buildClassifiedClient(parsed, result));
  }

  private buildClassifiedClient(
    parsed: Extract<ParseResult, { ok: true }>,
    result: ClassificationResult,
  ): NewClient {
    return {
      ...parsed.row,
      ...result.classification,
      promptVersion: result.promptVersion,
      modelVersion: result.modelVersion,
      truncated: result.truncated,
      classificationStatus: "classified",
      errorMessage: null,
      warnings: result.warnings,
    };
  }

  private async persistFailure(
    parsed: Extract<ParseResult, { ok: true }>,
    error: DomainError,
  ): Promise<void> {
    const next: NewClient = {
      ...parsed.row,
      promptVersion: CLASSIFIER_VERSION,
      classificationStatus: "failed",
      errorMessage: `${error.name}: ${error.message}`,
    };
    await this.repo.upsertByEmail(next);
  }

  private emit(state: MutableState, onProgress?: ProgressCallback): void {
    if (!onProgress) return;
    onProgress({
      total: state.total,
      processed: state.processed,
      succeeded: state.succeeded,
      failed: state.failed,
      lastEmail: state.lastEmail,
      lastError: state.lastError,
    });
  }
}
