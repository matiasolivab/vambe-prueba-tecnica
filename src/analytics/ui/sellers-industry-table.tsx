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

const HIGHLIGHT_THRESHOLD = 0.75;

/**
 * Sellers × Industries crosstab (§8.2). Pure Server Component — builds a
 * sparse matrix in O(data + rows × cols) and renders `${closed}/${total}`
 * per cell, with cyan highlight when closeRate ≥ 0.75.
 */
export function SellersIndustryTable({ data }: SellersIndustryTableProps) {
  if (data.length === 0) {
    return (
      <div className="py-6 text-center text-zinc-500 text-sm">Sin datos</div>
    );
  }

  const sellers = uniqueSorted(data.map((r) => r.seller));
  const industries = uniqueSorted(data.map((r) => r.industry));
  const cellsBySeller = indexBySeller(data);

  return (
    <div className="rounded-lg bg-zinc-900 ring-1 ring-zinc-800 overflow-x-auto">
      <Table className="text-zinc-300">
        <TableHeader>
          <TableRow className="border-zinc-800 hover:bg-transparent">
            <TableHead className="text-zinc-400 uppercase text-xs tracking-wide">
              Vendedor
            </TableHead>
            {industries.map((industry) => (
              <TableHead
                key={industry}
                scope="col"
                className="text-zinc-400 uppercase text-xs tracking-wide"
              >
                {industry}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {sellers.map((seller) => (
            <TableRow key={seller} className="border-zinc-800 hover:bg-zinc-900/40">
              <TableCell
                scope="row"
                role="rowheader"
                className="font-medium text-zinc-100"
              >
                {seller}
              </TableCell>
              {industries.map((industry) => {
                const cell = cellsBySeller.get(seller)?.get(industry);
                const isHot =
                  cell !== undefined && cell.closeRate >= HIGHLIGHT_THRESHOLD;
                return (
                  <TableCell
                    key={industry}
                    data-testid={`cell-${seller}-${industry}`}
                    className={cn(
                      "tabular-nums",
                      isHot &&
                        "bg-cyan-500/10 text-cyan-400 ring-1 ring-inset ring-cyan-500/30 rounded",
                    )}
                  >
                    {cell ? `${cell.closed}/${cell.total}` : ""}
                  </TableCell>
                );
              })}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

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
