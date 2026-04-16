import { NextResponse, type NextRequest } from "next/server";

import { buildIngestionService } from "@/ingestion/application/ingestion-factory";
import { InvalidCsvFormatError } from "@/ingestion/domain/errors";
import type {
  IngestionProgress,
  IngestionReport,
} from "@/ingestion/application/ingestion-service";

/**
 * POST /api/upload — CSV ingestion endpoint backed by Server-Sent Events
 * (PRD §RF1.5). The client uploads the file as `multipart/form-data` under
 * the `csv` field; the server streams progress back as SSE events so the
 * UI can render "N de T — last: email@x.com" in real time.
 *
 * SSE contract (per line terminated by `\n\n`):
 *   event: progress — data: IngestionProgress JSON
 *   event: done     — data: IngestionReport  JSON (terminal)
 *   event: error    — data: { code, message, missingColumns?, unexpectedColumns? } (terminal)
 *
 * Header-level errors (`InvalidCsvFormatError`) emit a structured SSE error
 * with the exact missing/unexpected columns so the UI can surface a precise
 * message (§RF1.2). Per-row failures do NOT stop the stream — they are
 * counted in the progress snapshots and summarised in the final report
 * (§RF1.4 + §RF2.5).
 *
 * Anti-buffering headers (`Cache-Control: no-cache, no-transform`,
 * `X-Accel-Buffering: no`) guarantee that intermediate proxies (Vercel
 * edge, nginx) flush each event immediately instead of batching them.
 *
 * Clean-code note: the handler is still thin — it parses the request,
 * delegates to {@link buildIngestionService} (shared with `scripts/seed.ts`),
 * and wraps the service callback in an SSE-serialiser. All classification
 * and persistence logic lives in the ingestion domain.
 */

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
// ~40-60 rows × ~7s each → 5 minutes covers the seeded dataset. Larger
// uploads would require batching (out of scope).
export const maxDuration = 300;

const encoder = new TextEncoder();

function sseEvent(event: string, data: unknown): Uint8Array {
  return encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
}

export async function POST(request: NextRequest): Promise<Response> {
  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json(
      { error: "invalid_multipart", message: "Se esperaba multipart/form-data." },
      { status: 400 },
    );
  }

  const file = formData.get("csv");
  if (!file || typeof file === "string") {
    return NextResponse.json(
      { error: "no_file", message: "Adjuntá un archivo en el campo 'csv'." },
      { status: 400 },
    );
  }

  const csv = await file.text();

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const { service, dispose } = buildIngestionService({
        // Silence logger sink: we stream our own progress via SSE.
        loggerSink: () => {},
      });
      try {
        const onProgress = (snapshot: IngestionProgress): void => {
          controller.enqueue(sseEvent("progress", snapshot));
        };
        const report: IngestionReport = await service.ingest(csv, onProgress);
        controller.enqueue(sseEvent("done", report));
      } catch (err) {
        controller.enqueue(sseEvent("error", toErrorPayload(err)));
      } finally {
        dispose();
        controller.close();
      }
    },
  });

  return new Response(stream, {
    status: 200,
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      // Disable buffering on nginx/Vercel intermediate proxies so each
      // event flushes immediately.
      "X-Accel-Buffering": "no",
    },
  });
}

function toErrorPayload(err: unknown): {
  code: string;
  message: string;
  missingColumns?: readonly string[];
  unexpectedColumns?: readonly string[];
} {
  if (err instanceof InvalidCsvFormatError) {
    return {
      code: err.code,
      message: err.message,
      missingColumns: err.missingColumns,
      unexpectedColumns: err.unexpectedColumns,
    };
  }
  const message = err instanceof Error ? err.message : "error desconocido";
  console.error("[POST /api/upload] error:", err);
  return { code: "internal", message };
}
