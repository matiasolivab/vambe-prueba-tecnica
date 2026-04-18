import type { LeadSourceCount } from "@/analytics/application/metrics-calculator";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

interface Props {
  data: readonly LeadSourceCount[];
}

const AMBER = "#fbbf24";
const CYAN = "#22d3ee";
const TRACK = "#27272a";

export function TopLeadSourcesCard({ data }: Props) {
  const slots: (LeadSourceCount | null)[] = [0, 1, 2].map((i) => data[i] ?? null);
  const maxCount = Math.max(...slots.map((s) => s?.count ?? 0), 1);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm font-medium">
          ¿Cómo nos encontraron?
        </CardTitle>
        <p className="text-xs text-muted-foreground">
          Top 3 fuentes de captación de clientes.
        </p>
      </CardHeader>
      <CardContent>
        <div className="space-y-5 py-2">
          {slots.map((slot, i) => {
            const color = i === 0 ? AMBER : CYAN;
            const pct = slot ? (slot.count / maxCount) * 100 : 0;
            return (
              <div key={i} className="space-y-2">
                <div className="flex items-baseline justify-between gap-3">
                  <div className="flex items-baseline gap-2 min-w-0">
                    <span className="text-xs font-medium tabular-nums text-zinc-500 shrink-0">
                      {i + 1}°
                    </span>
                    <span className="text-sm font-medium text-zinc-100 truncate">
                      {slot?.leadSource ?? "N/A"}
                    </span>
                  </div>
                  <span
                    className="text-2xl font-semibold tabular-nums shrink-0"
                    style={{ color }}
                  >
                    {slot?.count ?? "N/A"}
                  </span>
                </div>
                <div
                  className="h-1.5 w-full rounded-full"
                  style={{ background: TRACK }}
                >
                  <div
                    className="h-1.5 rounded-full"
                    style={{
                      width: `${pct}%`,
                      background: color,
                      opacity: slot ? 1 : 0,
                    }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
