import type { PainPointCount } from "@/analytics/application/metrics-calculator";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface Props {
  data: readonly PainPointCount[];
}

export function PainPointsMatrix({ data }: Props) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm font-medium">
          ¿Qué pain points aparecen más?
        </CardTitle>
        <p className="text-xs text-muted-foreground">
          Frecuencia de menciones agrupadas por tipo de dolor.
        </p>
      </CardHeader>
      <CardContent>
        {data.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">
            Sin datos de pain points
          </p>
        ) : (
          <PainPointsTable data={data} />
        )}
      </CardContent>
    </Card>
  );
}

function PainPointsTable({ data }: { data: readonly PainPointCount[] }) {
  const total = data.reduce((acc, d) => acc + d.count, 0);
  return (
    <Table>
      <TableHeader>
        <TableRow className="border-border hover:bg-transparent">
          <TableHead className="text-muted-foreground uppercase text-xs tracking-wide">
            Dolor
          </TableHead>
          <TableHead className="w-24 text-right text-muted-foreground uppercase text-xs tracking-wide">
            Menciones
          </TableHead>
          <TableHead className="text-muted-foreground uppercase text-xs tracking-wide">
            Proporción
          </TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {data.map((item, index) => {
          const pct = total > 0 ? (item.count / total) * 100 : 0;
          const isTop = index === 0;
          return (
            <TableRow key={item.painPoint} className="border-border">
              <TableCell className="font-medium text-foreground">
                {item.painPoint}
              </TableCell>
              <TableCell
                className={`text-right tabular-nums ${
                  isTop ? "text-amber-400" : "text-cyan-400"
                }`}
              >
                {item.count}
              </TableCell>
              <TableCell>
                <div className="flex items-center gap-3">
                  <div
                    className="h-2 flex-1 overflow-hidden rounded-full bg-zinc-700/40"
                    role="progressbar"
                    aria-valuenow={Math.round(pct)}
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-label={`Proporción de ${item.painPoint}`}
                  >
                    <div
                      className={`h-full rounded-full ${
                        isTop ? "bg-amber-400" : "bg-cyan-500"
                      }`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <span className="w-10 shrink-0 text-right text-xs text-muted-foreground tabular-nums">
                    {Math.round(pct)}%
                  </span>
                </div>
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}
