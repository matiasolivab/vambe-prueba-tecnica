import { createMetricsCalculator } from "@/analytics/application/metrics-calculator";
import { ObjectionsBarChart } from "@/analytics/ui/objections-bar-chart";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

const RED_400 = "#f87171";
const CYAN_400 = "#22d3ee";

/**
 * §8.4 — Objeciones. Two horizontal bar charts side-by-side: what kills
 * deals (red) vs what gets overcome in the ones that close (cyan).
 */
export async function ObjectionsSection() {
  const calc = createMetricsCalculator();
  const breakdown = await calc.objections();

  return (
    <Card className="bg-zinc-900 border-zinc-800">
      <CardHeader>
        <CardTitle className="text-zinc-100 text-lg">
          Objeciones
        </CardTitle>
        <CardDescription className="text-zinc-400">
          Qué mata deals vs qué se logra salvar.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="flex flex-col gap-2">
            <h3 className="text-zinc-200 text-sm font-medium">
              Objeciones que matan deals
            </h3>
            <ObjectionsBarChart data={breakdown.inNotClosed} fill={RED_400} />
            <p className="text-zinc-500 text-xs">
              Top objeciones mencionadas en reuniones que NO cerraron.
            </p>
          </div>
          <div className="flex flex-col gap-2">
            <h3 className="text-zinc-200 text-sm font-medium">
              Objeciones superadas
            </h3>
            <ObjectionsBarChart data={breakdown.inClosed} fill={CYAN_400} />
            <p className="text-zinc-500 text-xs">
              Objeciones mencionadas en reuniones que SÍ cerraron.
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
