import type { ClientFilters } from "@/clients/application/client-repository";
import { ClientsTable } from "@/clients/ui/clients-table";
import { createDrizzleClientRepository } from "@/clients/infrastructure/drizzle-client-repository";
import { Card, CardContent } from "@/components/ui/card";

/**
 * §8.5 — Clientes. Server Component: issues a single `findAll()` against
 * Neon and hands the full rows (including transcript + qualitative fields)
 * to the Client table so the drill-down modal never needs a second fetch.
 *
 * Accepts {@link ClientFilters} (RF3.2 + RF3.4 — the table also honors
 * `search` on name/email). Title and description live in the owning
 * page's `SectionHeader`.
 */
export async function ClientsSection({
  filters,
}: {
  readonly filters?: ClientFilters;
} = {}) {
  const repo = createDrizzleClientRepository();
  const clients = await repo.findAll(filters);

  return (
    <Card className="rounded-2xl ring-border shadow-[0_10px_40px_-15px_rgba(0,0,0,0.12)]">
      <CardContent>
        <ClientsTable initialClients={clients} />
      </CardContent>
    </Card>
  );
}
