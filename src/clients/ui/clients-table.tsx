"use client";

import { useEffect, useMemo, useState } from "react";
import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react";

import { ClientDetailModal } from "@/clients/ui/client-detail-modal";
import type { Client } from "@/clients/infrastructure/db/schema";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";

export interface ClientsTableProps {
  readonly initialClients: readonly Client[];
  readonly pageSize?: number;
}

const DEFAULT_PAGE_SIZE = 20;

/**
 * Clients list (§8.5). Pure Client Component — parent Server wrapper fetches
 * `findAll()` and hands the rows in via `initialClients`. Local state tracks
 * the selected row; clicking any cell opens the drill-down modal.
 *
 * Pagination is client-side (server already loaded the whole page's worth of
 * data). Page size is configurable via prop — defaults to {@link DEFAULT_PAGE_SIZE}.
 */
export function ClientsTable({
  initialClients,
  pageSize = DEFAULT_PAGE_SIZE,
}: ClientsTableProps) {
  const [selected, setSelected] = useState<Client | null>(null);
  const [page, setPage] = useState(1);

  // Reset to page 1 whenever the upstream dataset changes (filters, upload).
  useEffect(() => {
    setPage(1);
  }, [initialClients]);

  const totalPages = Math.max(1, Math.ceil(initialClients.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const pageClients = useMemo(
    () =>
      initialClients.slice(
        (currentPage - 1) * pageSize,
        currentPage * pageSize,
      ),
    [initialClients, currentPage, pageSize],
  );

  if (initialClients.length === 0) {
    return (
      <p className="py-10 text-center text-muted-foreground">Sin clientes</p>
    );
  }

  return (
    <>
      <div className="rounded-xl bg-card ring-1 ring-border overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="border-border hover:bg-transparent">
              <TableHead className="text-muted-foreground uppercase text-xs tracking-wide">
                Cliente
              </TableHead>
              <TableHead className="text-muted-foreground uppercase text-xs tracking-wide">
                Vendedor
              </TableHead>
              <TableHead className="text-muted-foreground uppercase text-xs tracking-wide">
                Industria
              </TableHead>
              <TableHead className="text-muted-foreground uppercase text-xs tracking-wide">
                Tamaño
              </TableHead>
              <TableHead className="text-muted-foreground uppercase text-xs tracking-wide">
                Dolor
              </TableHead>
              <TableHead className="text-muted-foreground uppercase text-xs tracking-wide">
                Objeción
              </TableHead>
              <TableHead className="text-muted-foreground uppercase text-xs tracking-wide">
                Origen
              </TableHead>
              <TableHead className="text-muted-foreground uppercase text-xs tracking-wide">
                Estado
              </TableHead>
              <TableHead className="text-muted-foreground uppercase text-xs tracking-wide">
                Sentiment
              </TableHead>
              <TableHead className="text-muted-foreground uppercase text-xs tracking-wide">
                Status
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {pageClients.map((c) => (
              <TableRow
                key={c.id}
                role="button"
                tabIndex={0}
                onClick={() => setSelected(c)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    setSelected(c);
                  }
                }}
                className={cn(
                  "border-border cursor-pointer hover:bg-muted/50",
                  c.classificationStatus === "failed" &&
                    "text-muted-foreground",
                )}
              >
                <TableCell>
                  <div className="flex flex-col">
                    <span className="font-medium text-foreground">
                      {c.name}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {c.email}
                    </span>
                  </div>
                </TableCell>
                <TableCell>{c.assignedSeller}</TableCell>
                <TableCell>{c.industry ?? "—"}</TableCell>
                <TableCell>{c.companySize ?? "—"}</TableCell>
                <TableCell>{c.mainPainPoint ?? "—"}</TableCell>
                <TableCell>{c.keyObjection ?? "—"}</TableCell>
                <TableCell>{c.leadSource ?? "—"}</TableCell>
                <TableCell>
                  <ClosedBadge closed={c.closed} />
                </TableCell>
                <TableCell>{c.sentiment ?? "—"}</TableCell>
                <TableCell>
                  <StatusBadges client={c} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <PaginationControls
        page={currentPage}
        totalPages={totalPages}
        totalClients={initialClients.length}
        pageSize={pageSize}
        onPrev={() => setPage((p) => Math.max(1, p - 1))}
        onNext={() => setPage((p) => Math.min(totalPages, p + 1))}
      />

      <ClientDetailModal
        client={selected}
        onClose={() => setSelected(null)}
      />
    </>
  );
}

function PaginationControls({
  page,
  totalPages,
  totalClients,
  pageSize,
  onPrev,
  onNext,
}: {
  page: number;
  totalPages: number;
  totalClients: number;
  pageSize: number;
  onPrev: () => void;
  onNext: () => void;
}) {
  const from = (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, totalClients);
  return (
    <div
      className="mt-3 flex items-center justify-between gap-3 text-xs text-muted-foreground"
      data-testid="clients-pagination"
    >
      <span>
        Mostrando {from}–{to} de {totalClients}
      </span>
      <div className="flex items-center gap-2">
        <span>
          Página {page} de {totalPages}
        </span>
        <Button
          variant="outline"
          size="sm"
          onClick={onPrev}
          disabled={page <= 1}
          aria-label="Página anterior"
        >
          <ChevronLeftIcon className="size-4" />
          Anterior
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={onNext}
          disabled={page >= totalPages}
          aria-label="Página siguiente"
        >
          Siguiente
          <ChevronRightIcon className="size-4" />
        </Button>
      </div>
    </div>
  );
}

function ClosedBadge({ closed }: { closed: boolean }) {
  return closed ? (
    <Badge className="bg-cyan-500/10 text-cyan-700 border border-cyan-500/30">
      Cerrado
    </Badge>
  ) : (
    <Badge className="bg-muted text-muted-foreground border border-border">
      Abierto
    </Badge>
  );
}

function StatusBadges({ client }: { client: Client }) {
  return (
    <div className="flex flex-wrap gap-1">
      {client.classificationStatus === "failed" ? (
        <Badge className="bg-red-500/10 text-red-700 border border-red-500/30">
          Fallo
        </Badge>
      ) : null}
      {client.truncated ? (
        <Badge className="bg-amber-500/10 text-amber-700 border border-amber-500/30">
          Truncado
        </Badge>
      ) : null}
      {client.classificationStatus !== "failed" && !client.truncated ? (
        <span className="text-xs text-muted-foreground">OK</span>
      ) : null}
    </div>
  );
}
