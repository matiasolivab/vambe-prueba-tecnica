import { NextResponse, type NextRequest } from "next/server";

import { buildIngestionService } from "@/ingestion/application/ingestion-factory";
import { InvalidCsvFormatError } from "@/ingestion/domain/errors";
import type {
  IngestionProgress,
  IngestionReport,
} from "@/ingestion/application/ingestion-service";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 300;

const encoder = new TextEncoder();
const UPLOAD_PASSWORD = process.env.UPLOAD_PASSWORD ?? "pruebavambe123";

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

  const password = formData.get("password");
  if (typeof password !== "string" || password !== UPLOAD_PASSWORD) {
    return NextResponse.json(
      {
        error: "invalid_password",
        message: "Contraseña incorrecta.",
      },
      { status: 401 },
    );
  }

  const csv = await file.text();

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const { service, dispose } = buildIngestionService({
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
