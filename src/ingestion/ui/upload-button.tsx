"use client";

import { Loader2Icon, UploadCloudIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import {
  useRef,
  useState,
  type ChangeEvent,
  type DragEvent,
  type FormEvent,
} from "react";

import type {
  IngestionProgress,
  IngestionReport,
} from "@/ingestion/application/ingestion-service";
import { parseSseEvents, type SseEvent } from "@/ingestion/ui/sse";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

/**
 * UploadButton (PRD §8.6) — top-right dashboard action that opens a modal
 * password gate first, then a dropzone, POSTs the CSV to `/api/upload`,
 * consumes the SSE stream, and refreshes the dashboard when ingestion
 * finishes.
 *
 * State machine: gate → idle → uploading → done | error. The gate is a
 * simple client-side check to avoid accidental uploads; the server also
 * validates the password on /api/upload so it's authoritative.
 */

const EXPECTED_PASSWORD = "pruebavambe123";

type UiState =
  | { kind: "idle" }
  | { kind: "uploading"; progress: IngestionProgress | null }
  | { kind: "done"; report: IngestionReport }
  | {
      kind: "error";
      code: string;
      message: string;
      missingColumns?: readonly string[];
      unexpectedColumns?: readonly string[];
    };

type ErrorPayload = {
  code: string;
  message: string;
  missingColumns?: string[];
  unexpectedColumns?: string[];
};

export default function UploadButton() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [authed, setAuthed] = useState(false);
  const [password, setPassword] = useState("");
  const [gateError, setGateError] = useState<string | null>(null);
  const [state, setState] = useState<UiState>({ kind: "idle" });
  const [isDragging, setIsDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  function resetAll() {
    setState({ kind: "idle" });
    setIsDragging(false);
    setAuthed(false);
    setPassword("");
    setGateError(null);
  }

  function onOpenChange(next: boolean) {
    setOpen(next);
    if (!next) resetAll();
  }

  function submitPassword() {
    if (password === EXPECTED_PASSWORD) {
      setAuthed(true);
      setGateError(null);
      return;
    }
    setGateError("Contraseña incorrecta");
  }

  async function handleUpload(file: File) {
    setState({ kind: "uploading", progress: null });
    try {
      const res = await fetch("/api/upload", {
        method: "POST",
        body: buildFormData(file, password),
      });
      if (!res.ok) {
        const payload = (await res
          .json()
          .catch(() => null)) as ErrorPayload | null;
        setState({
          kind: "error",
          code: payload?.code ?? "http",
          message: payload?.message ?? `HTTP ${res.status}`,
        });
        return;
      }
      if (!res.body) {
        setState({
          kind: "error",
          code: "http",
          message: `HTTP ${res.status}`,
        });
        return;
      }
      await consumeStream(res.body, handleEvent);
    } catch {
      setState({
        kind: "error",
        code: "network",
        message: "No se pudo conectar",
      });
    }
  }

  function handleEvent(ev: SseEvent) {
    if (ev.event === "progress") {
      const progress = JSON.parse(ev.data) as IngestionProgress;
      setState({ kind: "uploading", progress });
      return;
    }
    if (ev.event === "done") {
      const report = JSON.parse(ev.data) as IngestionReport;
      setState({ kind: "done", report });
      router.refresh();
      return;
    }
    if (ev.event === "error") {
      const err = JSON.parse(ev.data) as ErrorPayload;
      setState({
        kind: "error",
        code: err.code,
        message: err.message,
        missingColumns: err.missingColumns,
        unexpectedColumns: err.unexpectedColumns,
      });
    }
  }

  function onFileInput(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    void handleUpload(file);
  }

  function onDrop(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (!file) return;
    void handleUpload(file);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <Button
        onClick={() => setOpen(true)}
        className="rounded-full bg-primary text-primary-foreground hover:bg-primary/90"
      >
        <UploadCloudIcon />
        Subir CSV nuevo
      </Button>
      {open ? (
        <DialogContent
          className="sm:max-w-lg"
          showCloseButton={state.kind !== "uploading"}
        >
          <DialogHeader>
            <DialogTitle>
              {authed ? "Subir CSV de clientes" : "Acceso protegido"}
            </DialogTitle>
            <DialogDescription>
              {authed
                ? "El archivo se procesará y clasificará en vivo."
                : "Ingresa la contraseña para subir un CSV. Esto evita subidas ajenas a la prueba técnica."}
            </DialogDescription>
          </DialogHeader>
          {authed ? (
            <Body
              state={state}
              isDragging={isDragging}
              onPickFile={() => inputRef.current?.click()}
              onDragOver={(e) => e.preventDefault()}
              onDragEnter={() => setIsDragging(true)}
              onDragLeave={() => setIsDragging(false)}
              onDrop={onDrop}
              onCloseClick={() => onOpenChange(false)}
            />
          ) : (
            <GateBody
              password={password}
              error={gateError}
              onPasswordChange={(v) => {
                setPassword(v);
                if (gateError) setGateError(null);
              }}
              onSubmit={submitPassword}
            />
          )}
          <input
            ref={inputRef}
            data-testid="upload-input"
            type="file"
            accept=".csv,text/csv"
            className="hidden"
            onChange={onFileInput}
          />
        </DialogContent>
      ) : null}
    </Dialog>
  );
}

function buildFormData(file: File, password: string): FormData {
  const fd = new FormData();
  fd.append("csv", file);
  fd.append("password", password);
  return fd;
}

async function consumeStream(
  body: ReadableStream<Uint8Array>,
  onEvent: (ev: SseEvent) => void,
): Promise<void> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const { events, remainder } = parseSseEvents(buffer);
    buffer = remainder;
    for (const ev of events) onEvent(ev);
  }
}

function GateBody({
  password,
  error,
  onPasswordChange,
  onSubmit,
}: {
  password: string;
  error: string | null;
  onPasswordChange: (value: string) => void;
  onSubmit: () => void;
}) {
  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    onSubmit();
  }
  const canSubmit = password.trim().length > 0;
  return (
    <form onSubmit={handleSubmit} className="space-y-3 py-2">
      <div className="space-y-1">
        <label
          htmlFor="upload-password"
          className="text-xs font-medium text-muted-foreground"
        >
          Contraseña
        </label>
        <input
          id="upload-password"
          data-testid="upload-password"
          type="password"
          autoComplete="off"
          autoFocus
          placeholder="Contraseña"
          value={password}
          onChange={(e) => onPasswordChange(e.target.value)}
          className={cn(
            "w-full rounded-md border bg-background px-3 py-2 text-sm outline-none focus:ring-2",
            error
              ? "border-red-500 focus:border-red-500 focus:ring-red-500/20"
              : "border-border focus:border-primary focus:ring-primary/20",
          )}
        />
        {error ? (
          <p className="text-xs text-red-600" role="alert">
            {error}
          </p>
        ) : null}
      </div>
      <div className="flex justify-end">
        <Button type="submit" disabled={!canSubmit}>
          Continuar
        </Button>
      </div>
    </form>
  );
}

interface BodyProps {
  readonly state: UiState;
  readonly isDragging: boolean;
  readonly onPickFile: () => void;
  readonly onDragOver: (e: DragEvent<HTMLDivElement>) => void;
  readonly onDragEnter: () => void;
  readonly onDragLeave: () => void;
  readonly onDrop: (e: DragEvent<HTMLDivElement>) => void;
  readonly onCloseClick: () => void;
}

function Body(props: BodyProps) {
  const { state } = props;
  if (state.kind === "idle") return <IdleBody {...props} />;
  if (state.kind === "uploading") return <UploadingBody progress={state.progress} />;
  if (state.kind === "done")
    return <DoneBody report={state.report} onCloseClick={props.onCloseClick} />;
  return <ErrorBody state={state} onCloseClick={props.onCloseClick} />;
}

function IdleBody({
  isDragging,
  onPickFile,
  onDragOver,
  onDragEnter,
  onDragLeave,
  onDrop,
}: BodyProps) {
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onPickFile}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onPickFile();
        }
      }}
      onDragOver={onDragOver}
      onDragEnter={onDragEnter}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
      className={cn(
        "rounded-xl border-2 border-dashed p-10 text-center cursor-pointer transition-colors",
        isDragging
          ? "border-primary bg-primary/5"
          : "border-border hover:border-muted-foreground/40 hover:bg-muted/40",
      )}
    >
      <UploadCloudIcon className="mx-auto mb-3 text-muted-foreground" />
      <p className="text-sm text-foreground">
        Arrastra un CSV o haz click para seleccionar
      </p>
      <p className="mt-1 text-xs text-muted-foreground">Formato .csv · UTF-8</p>
    </div>
  );
}

function UploadingBody({ progress }: { progress: IngestionProgress | null }) {
  const total = progress?.total ?? 0;
  const processed = progress?.processed ?? 0;
  const percent = total > 0 ? Math.round((processed / total) * 100) : 0;
  return (
    <div className="space-y-3 py-4">
      <div className="flex items-center justify-center gap-2 text-foreground">
        <Loader2Icon className="animate-spin text-primary" />
        <span>Procesando…</span>
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
        <div
          className="h-full bg-primary transition-[width] duration-150"
          style={{ width: `${percent}%` }}
          data-testid="upload-progress-bar"
          aria-valuenow={percent}
          aria-valuemin={0}
          aria-valuemax={100}
          role="progressbar"
        />
      </div>
      <p className="text-center text-sm text-muted-foreground">
        {processed} de {total} filas
      </p>
      {progress?.lastEmail ? (
        <p className="truncate text-center text-xs text-muted-foreground">
          Procesando: {progress.lastEmail}
        </p>
      ) : null}
      <div className="mt-4 rounded-md border border-border/60 bg-muted/40 p-3 text-xs leading-relaxed text-muted-foreground">
        <p>
          <span className="font-medium text-foreground">
            ¿Esto tarda mucho, no?
          </span>{" "}
          Sí. Cada transcripción pasa por una llamada a la IA y eso es lento de
          por sí. Si seguimos escalando, esto se mejora moviéndolo a workers o
          una cola asíncrona para procesar en paralelo — ya está identificado
          como mejora.
        </p>
      </div>
    </div>
  );
}

function DoneBody({
  report,
  onCloseClick,
}: {
  report: IngestionReport;
  onCloseClick: () => void;
}) {
  return (
    <div className="space-y-4 py-2">
      <p className="text-sm text-cyan-700">
        Se clasificaron {report.succeeded} clientes, {report.failed} fallaron
      </p>
      {report.classificationErrors.length > 0 ? (
        <ul className="max-h-40 space-y-1 overflow-y-auto rounded border border-border p-2 text-xs text-muted-foreground">
          {report.classificationErrors.map((e) => (
            <li key={e.email}>
              <span className="text-muted-foreground">{e.email}</span> —{" "}
              {e.message}
            </li>
          ))}
        </ul>
      ) : null}
      <div className="flex justify-end">
        <DialogClose
          render={
            <Button variant="outline" onClick={onCloseClick}>
              Cerrar
            </Button>
          }
        />
      </div>
    </div>
  );
}

function ErrorBody({
  state,
  onCloseClick,
}: {
  state: Extract<UiState, { kind: "error" }>;
  onCloseClick: () => void;
}) {
  return (
    <div className="space-y-3 py-2">
      <p className="text-sm text-red-600">{state.message}</p>
      {state.missingColumns && state.missingColumns.length > 0 ? (
        <ColumnList label="Faltan columnas" items={state.missingColumns} />
      ) : null}
      {state.unexpectedColumns && state.unexpectedColumns.length > 0 ? (
        <ColumnList
          label="Columnas inesperadas"
          items={state.unexpectedColumns}
        />
      ) : null}
      <div className="flex justify-end">
        <DialogClose
          render={
            <Button variant="outline" onClick={onCloseClick}>
              Cerrar
            </Button>
          }
        />
      </div>
    </div>
  );
}

function ColumnList({
  label,
  items,
}: {
  label: string;
  items: readonly string[];
}) {
  return (
    <div className="text-xs text-muted-foreground">
      <p className="mb-1 text-muted-foreground">{label}:</p>
      <ul className="flex flex-wrap gap-1">
        {items.map((c) => (
          <li
            key={c}
            className="rounded border border-red-500/30 bg-red-500/10 px-1.5 py-0.5 text-red-700"
          >
            {c}
          </li>
        ))}
      </ul>
    </div>
  );
}
