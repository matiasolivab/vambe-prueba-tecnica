import { SellersSection } from "@/analytics/ui/sellers-section";
import {
  resolveDashboardFilters,
  type DashboardSearchParams,
} from "@/shared/filters/resolve-dashboard-filters";

import { getDashboardSellers } from "../data";
import { SectionHeader } from "../ui/section-header";

export const dynamic = "force-dynamic";

export default async function DashboardSellersPage({
  searchParams,
}: {
  searchParams: DashboardSearchParams;
}) {
  const { metricFilters } = await resolveDashboardFilters(searchParams);
  const sellers = await getDashboardSellers();

  return (
    <>
      <SectionHeader
        badge="Performance"
        title="Vendedores"
        description="Ranking por tasa de cierre y cobertura por industria."
        sellers={sellers}
      />
      <SellersSection filters={metricFilters} />
    </>
  );
}
