import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { cn } from "@/lib/utils";

/**
 * Presentation-only KPI tile for §8.1 of the dashboard. Dumb component —
 * all formatting (percent, captions) happens at the page level so the tile
 * stays trivially testable and composable.
 */
export interface KpiTileProps {
  readonly label: string;
  readonly value: string | number;
  readonly caption?: string;
  readonly highlight?: "cyan" | "amber" | undefined;
}

export function KpiTile({ label, value, caption, highlight }: KpiTileProps) {
  const valueClass = cn(
    "text-4xl font-semibold tabular-nums",
    highlight === "cyan" && "text-cyan-400",
    highlight === "amber" && "text-amber-400",
    !highlight && "text-zinc-50",
  );

  return (
    <Card className="bg-zinc-900 border-zinc-800">
      <CardHeader>
        <CardDescription className="text-zinc-400 text-xs uppercase tracking-wide">
          {label}
        </CardDescription>
        <CardTitle className={valueClass}>{value}</CardTitle>
        {caption ? (
          <p className="text-zinc-500 text-xs mt-1">{caption}</p>
        ) : null}
      </CardHeader>
    </Card>
  );
}
