import type { ClientFilters } from "@/clients/application/client-repository";
import { ClientsTable } from "@/clients/ui/clients-table";
import { createDrizzleClientRepository } from "@/clients/infrastructure/drizzle-client-repository";
import {
  Card,
  CardDescription,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

/**
 * §8.5 — Clientes. Server Component: issues a single `findAll()` against
 * Neon and hands the full rows (including transcript + qualitative fields)
 * to the Client table so the drill-down modal never needs a second fetch.
 *
 * Accepts {@link ClientFilters} (RF3.2 + RF3.4 — the table also honors
 * `search` on name/email).
 */
export async function ClientsSection({
  filters,
}: {
  readonly filters?: ClientFilters;
} = {}) {
  const repo = createDrizzleClientRepository();
  const clients = await repo.findAll(filters);

  return (
    <Card className="bg-zinc-900 border-zinc-800">
      <CardHeader>
        <CardTitle className="text-zinc-100 text-lg">Clientes</CardTitle>
        <CardDescription className="text-zinc-400">
          Lista completa — haz clic en una fila para ver el detalle.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ClientsTable initialClients={clients} />
      </CardContent>
    </Card>
  );
}
