import { ClientsSection } from "@/clients/ui/clients-section";
import {
  resolveDashboardFilters,
  type DashboardSearchParams,
} from "@/shared/filters/resolve-dashboard-filters";

import { getDashboardSellers } from "../data";
import { SectionHeader } from "../ui/section-header";

export const dynamic = "force-dynamic";

export default async function DashboardClientsPage({
  searchParams,
}: {
  searchParams: DashboardSearchParams;
}) {
  const { filters } = await resolveDashboardFilters(searchParams);
  const sellers = await getDashboardSellers();

  return (
    <>
      <SectionHeader
        badge="Listado"
        title="Clientes"
        description="Lista completa — haz clic en una fila para ver el detalle."
        sellers={sellers}
      />
      <ClientsSection filters={filters} />
    </>
  );
}
