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

const LABELS = ["Principal", "Segundo", "Tercero"] as const;
const AMBER = "#fbbf24";
const ZINC = "#d4d4d8";

export function TopLeadSourcesCard({ data }: Props) {
  const slots = [0, 1, 2].map((i) => data[i] ?? null);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm font-medium">
          Cómo nos encontraron
        </CardTitle>
        <p className="text-xs text-muted-foreground">
          Top 3 fuentes de captación de clientes.
        </p>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {slots.map((slot, i) => (
            <div
              key={LABELS[i]}
              className="flex items-center justify-between gap-2"
            >
              <div className="flex items-center gap-2 min-w-0">
                <span
                  className="text-xs font-medium shrink-0"
                  style={{ color: ZINC }}
                >
                  {LABELS[i]}
                </span>
                <span className="text-sm text-zinc-200 truncate">
                  {slot?.leadSource ?? "N/A"}
                </span>
              </div>
              <span
                className="text-sm font-semibold tabular-nums shrink-0"
                style={{ color: i === 0 ? AMBER : ZINC }}
              >
                {slot?.count ?? "N/A"}
              </span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
