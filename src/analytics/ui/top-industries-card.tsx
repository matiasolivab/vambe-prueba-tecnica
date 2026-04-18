import type { IndustryCount } from "@/analytics/application/metrics-calculator";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

interface Props {
  data: readonly IndustryCount[];
}

interface RowProps {
  label: string;
  industry: IndustryCount | undefined;
  accent: "amber" | "zinc";
}

function IndustryRow({ label, industry, accent }: RowProps) {
  const name = industry?.industry ?? "N/A";
  const count = industry?.count;
  const countClass =
    accent === "amber" ? "tabular-nums text-amber-400" : "tabular-nums text-zinc-300";
  const emptyCountClass = "tabular-nums text-zinc-500";

  return (
    <div className="flex items-center justify-between">
      <div>
        <span className="text-xs uppercase tracking-wide text-zinc-500">
          {label}
        </span>
        <div className="mt-0.5 text-lg text-zinc-50">{name}</div>
      </div>
      {count !== undefined ? (
        <span className={countClass}>{count}</span>
      ) : (
        <span className={emptyCountClass}>N/A</span>
      )}
    </div>
  );
}

export function TopIndustriesCard({ data }: Props) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm font-medium">
          Industrias principales
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <IndustryRow
            label="Principal"
            industry={data[0]}
            accent="amber"
          />
          <IndustryRow
            label="Secundaria"
            industry={data[1]}
            accent="zinc"
          />
        </div>
      </CardContent>
    </Card>
  );
}
