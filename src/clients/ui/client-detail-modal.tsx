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
          className="max-w-3xl max-h-[85vh] overflow-hidden flex flex-col p-0 sm:max-w-3xl"
          showCloseButton={false}
        >
          <DialogHeader className="px-6 pt-6 pb-4 border-b border-border">
            <DialogTitle className="text-xl">{client.name}</DialogTitle>
            <DialogDescription>
              {client.email} · {client.assignedSeller}
              {client.industry ? ` · ${client.industry}` : ""} ·{" "}
              {formatDate(client.createdAt)}
            </DialogDescription>
            <MetadataBadges client={client} />
          </DialogHeader>

          <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6">
            <Section title="Resumen de necesidades">
              <p className="text-foreground leading-relaxed">
                {client.needsSummary ?? "—"}
              </p>
            </Section>

            <Section title="Próximos pasos">
              <p className="text-foreground leading-relaxed whitespace-pre-wrap">
                {client.nextSteps ?? "—"}
              </p>
            </Section>

            <Section title="Transcripción original">
              <pre className="whitespace-pre-wrap font-mono text-sm text-foreground bg-muted border border-border rounded-md p-4 max-h-80 overflow-y-auto">
                {client.transcript}
              </pre>
            </Section>
          </div>

          <DialogFooter className="px-6 py-4 bg-muted/40 border-t border-border rounded-b-xl">
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
      <h3 className="text-xs uppercase tracking-wide text-muted-foreground font-medium mb-2">
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
        <Badge className="bg-amber-500/10 text-amber-700 border border-amber-500/30">
          Truncado
        </Badge>
      ) : null}
      {warningsCount > 0 ? (
        <Badge className="bg-amber-500/10 text-amber-700 border border-amber-500/30">
          {warningsCount} advertencia{warningsCount === 1 ? "" : "s"}
        </Badge>
      ) : null}
      {client.promptVersion ? (
        <Badge className="bg-muted text-muted-foreground border border-border">
          prompt v{client.promptVersion}
        </Badge>
      ) : null}
      {client.classificationStatus === "failed" ? (
        <Badge className="bg-red-500/10 text-red-700 border border-red-500/30">
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
