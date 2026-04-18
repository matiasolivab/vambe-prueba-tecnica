"use client";

import { useState } from "react";

import { ClientDetailModal } from "@/clients/ui/client-detail-modal";
import type { Client } from "@/clients/infrastructure/db/schema";
import { Badge } from "@/components/ui/badge";
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
}

/**
 * Clients list (§8.5). Pure Client Component — parent Server wrapper fetches
 * `findAll()` and hands the rows in via `initialClients`. Local state tracks
 * the selected row; clicking any cell opens the drill-down modal.
 *
 * Filters/search/sort are out of scope for 7.4 (see 7.6).
 */
export function ClientsTable({ initialClients }: ClientsTableProps) {
  const [selected, setSelected] = useState<Client | null>(null);

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
            {initialClients.map((c) => (
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

      <ClientDetailModal
        client={selected}
        onClose={() => setSelected(null)}
      />
    </>
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
