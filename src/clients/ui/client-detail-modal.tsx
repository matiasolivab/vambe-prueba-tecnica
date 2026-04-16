"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { Client } from "@/clients/infrastructure/db/schema";

export interface ClientDetailModalProps {
  readonly client: Client | null;
  readonly onClose: () => void;
}

/**
 * Drill-down modal for a single classified client (PRD §8.5). Controlled by
 * the parent table via `client`/`onClose` — when `client === null` the modal
 * stays closed and Dialog unmounts its portal (no dialog role in DOM).
 *
 * Renders the three qualitative artifacts the PRD requires visible:
 *   1. needsSummary
 *   2. nextSteps
 *   3. original transcript (scrollable region)
 * Plus classification metadata (promptVersion, truncated, warnings count) so
 * a reviewer can audit the row at a glance.
 */
export function ClientDetailModal({ client, onClose }: ClientDetailModalProps) {
  const open = client !== null;

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
    >
      {client ? (
        <DialogContent
          className="max-w-3xl max-h-[85vh] overflow-hidden flex flex-col bg-zinc-900 text-zinc-100 ring-zinc-800 p-0"
          showCloseButton={false}
        >
          <DialogHeader className="px-6 pt-6 pb-4 border-b border-zinc-800">
            <DialogTitle className="text-xl text-zinc-50">
              {client.name}
            </DialogTitle>
            <DialogDescription className="text-zinc-400">
              {client.email} · {client.assignedSeller}
              {client.industry ? ` · ${client.industry}` : ""} ·{" "}
              {formatDate(client.createdAt)}
            </DialogDescription>
            <MetadataBadges client={client} />
          </DialogHeader>

          <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6">
            <Section title="Resumen de necesidades">
              <p className="text-zinc-200 leading-relaxed">
                {client.needsSummary ?? "—"}
              </p>
            </Section>

            <Section title="Próximos pasos">
              <p className="text-zinc-200 leading-relaxed whitespace-pre-wrap">
                {client.nextSteps ?? "—"}
              </p>
            </Section>

            <Section title="Transcripción original">
              <pre className="whitespace-pre-wrap font-mono text-sm text-zinc-300 bg-zinc-950 border border-zinc-800 rounded-md p-4 max-h-80 overflow-y-auto">
                {client.transcript}
              </pre>
            </Section>
          </div>

          <DialogFooter className="px-6 py-4 bg-zinc-950/40 border-t border-zinc-800 rounded-b-xl">
            <Button variant="outline" onClick={onClose} aria-label="Cerrar">
              Cerrar
            </Button>
          </DialogFooter>
        </DialogContent>
      ) : null}
    </Dialog>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section>
      <h3 className="text-xs uppercase tracking-wide text-zinc-400 font-medium mb-2">
        {title}
      </h3>
      {children}
    </section>
  );
}

function MetadataBadges({ client }: { client: Client }) {
  const warningsCount = Array.isArray(client.warnings)
    ? (client.warnings as unknown[]).length
    : 0;
  return (
    <div className="flex flex-wrap gap-2 pt-3">
      {client.truncated ? (
        <Badge className="bg-amber-400/10 text-amber-400 border border-amber-400/30">
          Truncado
        </Badge>
      ) : null}
      {warningsCount > 0 ? (
        <Badge className="bg-amber-400/10 text-amber-400 border border-amber-400/30">
          {warningsCount} advertencia{warningsCount === 1 ? "" : "s"}
        </Badge>
      ) : null}
      {client.promptVersion ? (
        <Badge className="bg-zinc-800 text-zinc-300 border border-zinc-700">
          prompt v{client.promptVersion}
        </Badge>
      ) : null}
      {client.classificationStatus === "failed" ? (
        <Badge className="bg-red-400/10 text-red-400 border border-red-400/30">
          Fallo
        </Badge>
      ) : null}
    </div>
  );
}

const DATE_FORMATTER = new Intl.DateTimeFormat("es-CL", {
  dateStyle: "medium",
});

function formatDate(d: Date): string {
  return DATE_FORMATTER.format(new Date(d));
}
