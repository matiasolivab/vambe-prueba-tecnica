import type { ClientFilters } from "@/clients/application/client-repository";
import { ClientsTable } from "@/clients/ui/clients-table";
import { createDrizzleClientRepository } from "@/clients/infrastructure/drizzle-client-repository";
import { Card, CardContent } from "@/components/ui/card";

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
