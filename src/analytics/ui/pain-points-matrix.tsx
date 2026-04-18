import type { PainPointCount } from "@/analytics/application/metrics-calculator";

interface Props {
  data: readonly PainPointCount[];
}

export function PainPointsMatrix({ data }: Props) {
  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center rounded-lg border border-zinc-700 bg-zinc-900 p-6">
        <p className="text-sm text-zinc-500">Sin datos de pain points</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {data.map((item, index) => {
        const isTop = index === 0;
        return (
          <div
            key={item.painPoint}
            className={`rounded-lg border border-zinc-700 bg-zinc-900 p-4${isTop ? " ring-1 ring-amber-400/30" : ""}`}
          >
            <div
              className={`text-3xl font-semibold tabular-nums ${isTop ? "text-amber-400" : "text-cyan-400"}`}
            >
              {item.count}
            </div>
            <div className="mt-1 text-sm text-zinc-300">{item.painPoint}</div>
          </div>
        );
      })}
    </div>
  );
}
