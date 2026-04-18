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

const AMBER = "#f59e0b";
const CYAN = "#0891b2";

export function TopLeadSourcesCard({ data }: Props) {
  const slots: (LeadSourceCount | null)[] = [0, 1, 2, 3, 4].map(
    (i) => data[i] ?? null,
  );
  const maxCount = Math.max(...slots.map((s) => s?.count ?? 0), 1);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm font-medium">
          ¿Cómo nos encontraron?
        </CardTitle>
        <p className="text-xs text-muted-foreground">
          Top 5 fuentes de captación de clientes.
        </p>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {slots.map((slot, i) => {
            const color = i === 0 ? AMBER : CYAN;
            const pct = slot ? (slot.count / maxCount) * 100 : 0;
            return (
              <div key={i} className="space-y-1.5">
                <div className="flex items-baseline justify-between gap-3">
                  <div className="flex items-baseline gap-2 min-w-0">
                    <span className="text-xs font-medium tabular-nums text-muted-foreground shrink-0">
                      {i + 1}°
                    </span>
                    <span className="text-sm font-semibold truncate">
                      {slot?.leadSource ?? "N/A"}
                    </span>
                  </div>
                  <span
                    className="text-xl font-semibold tabular-nums shrink-0"
                    style={{ color }}
                  >
                    {slot?.count ?? "N/A"}
                  </span>
                </div>
                <div className="h-1.5 w-full rounded-full bg-muted">
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
