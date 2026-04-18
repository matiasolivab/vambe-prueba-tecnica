import type { SellerConversion } from "@/analytics/application/metrics-calculator";

export interface SellersConversionBarChartProps {
  readonly data: readonly SellerConversion[];
}

export function SellersConversionBarChart({
  data,
}: SellersConversionBarChartProps) {
  if (data.length === 0) {
    return (
      <div className="text-zinc-500 text-sm text-center py-8">
        Sin vendedores con reuniones
      </div>
    );
  }

  const maxTotalClients = Math.max(...data.map((d) => d.totalClients), 1);

  return (
    <div>
      {data.map((row) => {
        const outerWidthPct = (row.totalClients / maxTotalClients) * 100;
        const closedWidthPct = row.closeRate * 100;
        const ratePct = Math.round(row.closeRate * 100);
        const tooltip = `${row.seller} · ${row.totalClients} reuniones · ${row.closedClients} cerradas · ${row.openClients} abiertas · ${ratePct}% close rate`;
        return (
          <div
            key={row.seller}
            data-testid="seller-row"
            title={tooltip}
            className="grid grid-cols-[1fr_auto_3fr] items-center gap-4 py-2"
          >
            <span className="text-zinc-400 text-sm truncate">{row.seller}</span>
            <span className="text-zinc-300 text-sm tabular-nums text-right">
              {row.totalClients}
            </span>
            <div
              data-testid="seller-bar-outer"
              className="flex h-2 rounded-full overflow-hidden bg-zinc-800/60"
              style={{ width: `${outerWidthPct}%` }}
            >
              <div
                data-testid="seller-bar-closed"
                className="bg-amber-400 h-full"
                style={{ width: `${closedWidthPct}%` }}
              />
              <div
                data-testid="seller-bar-open"
                className="bg-cyan-400 h-full flex-1"
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}
