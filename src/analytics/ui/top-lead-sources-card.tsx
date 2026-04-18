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
  const maxCount = data[0]?.count ?? 1;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm font-medium">
          ¿Cómo nos encontraron?
        </CardTitle>
        <p className="text-xs text-muted-foreground">
          Fuentes de captación de clientes.
        </p>
      </CardHeader>
      <CardContent>
        {data.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">
            Sin datos de captación
          </p>
        ) : (
          <div className="space-y-3">
            {data.map((item, i) => {
              const color = i === 0 ? AMBER : CYAN;
              const pct = (item.count / maxCount) * 100;
              return (
                <div key={item.leadSource} className="space-y-1.5">
                  <div className="flex items-baseline justify-between gap-3">
                    <div className="flex items-baseline gap-2 min-w-0">
                      <span className="text-xs font-medium tabular-nums text-muted-foreground shrink-0">
                        {i + 1}°
                      </span>
                      <span className="text-sm font-semibold truncate">
                        {item.leadSource}
                      </span>
                    </div>
                    <span
                      className="text-xl font-semibold tabular-nums shrink-0"
                      style={{ color }}
                    >
                      {item.count}
                    </span>
                  </div>
                  <div className="h-1.5 w-full rounded-full bg-muted">
                    <div
                      className="h-1.5 rounded-full"
                      style={{ width: `${pct}%`, background: color }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
