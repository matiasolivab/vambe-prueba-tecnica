import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";

import type { SellerByIndustryCell } from "@/analytics/application/metrics-calculator";

export interface SellersIndustryTableProps {
  readonly data: readonly SellerByIndustryCell[];
}

/** Close-rate threshold above which a cell shows a ring/outline accent. */
const HIGHLIGHT_THRESHOLD = 0.75;

/**
 * Sellers × Industries crosstab (§8.2) as a heatmap.
 *
 * Each cell is tinted with the primary color at an intensity proportional
 * to its close rate (via `color-mix`), so the eye scans "where is each
 * seller strongest" in one pass. A `Total` column on the right shows the
 * per-seller aggregate. The first column (Vendedor) is sticky while the
 * rest scrolls horizontally — matters when there are 6+ industries.
 */
export function SellersIndustryTable({ data }: SellersIndustryTableProps) {
  if (data.length === 0) {
    return (
      <div className="py-6 text-center text-sm text-muted-foreground">
        Sin datos
      </div>
    );
  }

  const sellers = uniqueSorted(data.map((r) => r.seller));
  const industries = uniqueSorted(data.map((r) => r.industry));
  const cellsBySeller = indexBySeller(data);
  const totals = computeSellerTotals(data);

  return (
    <div className="overflow-hidden rounded-xl ring-1 ring-border">
      <Table className="table-fixed">
        <TableHeader>
          <TableRow className="border-border bg-muted/40 hover:bg-muted/40">
            <TableHead className="sticky left-0 z-10 w-36 bg-muted/40 text-[11px] uppercase text-muted-foreground">
              Vendedor
            </TableHead>
            {industries.map((industry) => (
              <TableHead
                key={industry}
                scope="col"
                className="whitespace-normal break-words px-2 text-center align-middle text-[11px] leading-tight uppercase text-muted-foreground"
              >
                {industry}
              </TableHead>
            ))}
            <TableHead className="w-24 text-center text-[11px] uppercase text-muted-foreground">
              Total
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {sellers.map((seller) => {
            const total = totals.get(seller);
            return (
              <TableRow key={seller} className="border-border hover:bg-muted/30">
                <TableCell
                  scope="row"
                  role="rowheader"
                  className="sticky left-0 z-10 bg-card font-medium text-foreground"
                >
                  {seller}
                </TableCell>
                {industries.map((industry) => {
                  const cell = cellsBySeller.get(seller)?.get(industry);
                  return (
                    <HeatCell
                      key={industry}
                      seller={seller}
                      industry={industry}
                      cell={cell}
                    />
                  );
                })}
                <TotalCell
                  closed={total?.closed ?? 0}
                  totalMeetings={total?.total ?? 0}
                />
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}

// --- cells ----------------------------------------------------------------

interface HeatCellProps {
  readonly seller: string;
  readonly industry: string;
  readonly cell: SellerByIndustryCell | undefined;
}

function HeatCell({ seller, industry, cell }: HeatCellProps) {
  if (!cell) {
    return (
      <TableCell
        data-testid={`cell-${seller}-${industry}`}
        className="text-center tabular-nums text-muted-foreground/40"
      >
        —
      </TableCell>
    );
  }

  const isHot = cell.closeRate >= HIGHLIGHT_THRESHOLD;
  // color-mix lets us fade the primary token (cyan) to transparent
  // proportionally. Cap intensity at 0.9 so 100% cells aren't pure primary
  // (which would clash with the foreground text).
  const intensity = Math.min(0.9, 0.08 + cell.closeRate * 0.72);

  return (
    <TableCell
      data-testid={`cell-${seller}-${industry}`}
      className={cn(
        "text-center font-medium tabular-nums text-foreground",
        isHot && "ring-1 ring-inset ring-primary/40",
      )}
      style={{
        backgroundColor: `color-mix(in oklch, var(--primary) ${(intensity * 100).toFixed(0)}%, transparent)`,
      }}
    >
      {cell.closed}/{cell.total}
    </TableCell>
  );
}

function TotalCell({
  closed,
  totalMeetings,
}: {
  closed: number;
  totalMeetings: number;
}) {
  if (totalMeetings === 0) {
    return (
      <TableCell className="bg-muted/30 text-center text-xs text-muted-foreground">
        —
      </TableCell>
    );
  }
  const pct = Math.round((closed / totalMeetings) * 100);
  return (
    <TableCell className="bg-muted/30 text-center font-semibold tabular-nums text-foreground">
      {pct}%
    </TableCell>
  );
}

// --- helpers --------------------------------------------------------------

function uniqueSorted(values: readonly string[]): string[] {
  return Array.from(new Set(values)).sort((a, b) => a.localeCompare(b));
}

function indexBySeller(
  data: readonly SellerByIndustryCell[],
): Map<string, Map<string, SellerByIndustryCell>> {
  const out = new Map<string, Map<string, SellerByIndustryCell>>();
  for (const row of data) {
    let inner = out.get(row.seller);
    if (!inner) {
      inner = new Map();
      out.set(row.seller, inner);
    }
    inner.set(row.industry, row);
  }
  return out;
}

function computeSellerTotals(
  data: readonly SellerByIndustryCell[],
): Map<string, { closed: number; total: number }> {
  const out = new Map<string, { closed: number; total: number }>();
  for (const row of data) {
    const agg = out.get(row.seller) ?? { closed: 0, total: 0 };
    agg.closed += row.closed;
    agg.total += row.total;
    out.set(row.seller, agg);
  }
  return out;
}
