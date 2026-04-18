import {
  createMetricsCalculator,
  type MetricFilters,
  type SellerByIndustryCell,
  type SellerRanking,
} from "@/analytics/application/metrics-calculator";
import { SellersBarChart } from "@/analytics/ui/sellers-bar-chart";
import { SellersIndustryTable } from "@/analytics/ui/sellers-industry-table";
import { Card, CardContent } from "@/components/ui/card";

/**
 * §8.2 — Performance de vendedores. Server Component: issues two parallel
 * reads against Neon, then hands plain JSON to the Client chart while the
 * crosstab table renders inline (no `"use client"` needed).
 *
 * Accepts global {@link MetricFilters} (RF3.2) — when present, every
 * aggregation is scoped to the filtered subset. The section title and
 * description live in the owning page's `SectionHeader`; this component
 * composes two internal subsections (ranking + coverage) separated by a
 * divider, with a legend footer explaining the visual encoding.
 */
export async function SellersSection({
  filters,
}: {
  readonly filters?: MetricFilters;
} = {}) {
  const calc = createMetricsCalculator();
  const [ranking, byIndustry] = await Promise.all([
    calc.sellerRanking(filters),
    calc.sellerByIndustry(filters),
  ]);

  return (
    <Card className="rounded-2xl ring-border shadow-[0_10px_40px_-15px_rgba(0,0,0,0.12)]">
      <CardContent className="flex flex-col gap-8">
        <Subsection
          title="Ranking general"
          caption={rankingCaption(ranking)}
        >
          <SellersBarChart data={ranking} />
        </Subsection>

        <Divider />

        <Subsection
          title="Cobertura por industria"
          caption={coverageCaption(byIndustry)}
        >
          <SellersIndustryTable data={byIndustry} />
        </Subsection>

        <LegendFooter />
      </CardContent>
    </Card>
  );
}

// --- internal composition -------------------------------------------------

function Subsection({
  title,
  caption,
  children,
}: {
  readonly title: string;
  readonly caption: string;
  readonly children: React.ReactNode;
}) {
  return (
    <section className="flex flex-col gap-3">
      <header className="flex items-baseline justify-between gap-4">
        <h3 className="text-sm font-semibold tracking-tight text-foreground">
          {title}
        </h3>
        <span className="text-xs text-muted-foreground">{caption}</span>
      </header>
      {children}
    </section>
  );
}

function Divider() {
  return (
    <div
      aria-hidden
      className="h-px w-full bg-gradient-to-r from-transparent via-border to-transparent"
    />
  );
}

function LegendFooter() {
  return (
    <footer
      aria-label="Leyenda del gráfico"
      className="flex flex-wrap items-center gap-x-5 gap-y-1.5 border-t border-border/70 pt-3 text-[11px] text-muted-foreground"
    >
      <LegendSwatch label="Top del ranking" kind="accent" />
      <LegendSwatch label="Resto del ranking" kind="primary" />
      <span className="inline-flex items-center gap-1.5">
        <span
          aria-hidden
          className="inline-block h-3 w-6 rounded-sm ring-1 ring-inset ring-primary/40"
          style={{
            backgroundColor:
              "color-mix(in oklch, var(--primary) 80%, transparent)",
          }}
        />
        Celda ≥ 75% destacada
      </span>
      <span className="ml-auto text-muted-foreground/80">
        Intensidad de celda = tasa de cierre
      </span>
    </footer>
  );
}

function LegendSwatch({
  label,
  kind,
}: {
  readonly label: string;
  readonly kind: "primary" | "accent";
}) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span
        aria-hidden
        className="inline-block h-2.5 w-2.5 rounded-full"
        style={{
          backgroundColor: kind === "accent" ? "var(--accent)" : "var(--primary)",
        }}
      />
      {label}
    </span>
  );
}

// --- captions -------------------------------------------------------------

function rankingCaption(ranking: readonly SellerRanking[]): string {
  const shown = Math.min(10, ranking.length);
  if (ranking.length === 0) return "Sin vendedores";
  if (ranking.length <= 10) return `${ranking.length} vendedores`;
  return `Top ${shown} de ${ranking.length} vendedores`;
}

function coverageCaption(data: readonly SellerByIndustryCell[]): string {
  if (data.length === 0) return "Sin datos";
  const sellers = new Set(data.map((r) => r.seller)).size;
  const industries = new Set(data.map((r) => r.industry)).size;
  return `${sellers} vendedores · ${industries} industrias`;
}
