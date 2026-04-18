import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { cn } from "@/lib/utils";

export interface KpiTileProps {
  readonly label: string;
  readonly value: string | number;
  readonly caption?: string;
  readonly highlight?: "cyan" | "amber" | undefined;
  readonly delta?: {
    readonly pct: number | null;
    readonly direction: "up" | "down" | "flat" | "na";
  };
}

export function KpiTile({
  label,
  value,
  caption,
  highlight,
  delta,
}: KpiTileProps) {
  const valueClass = cn(
    "text-4xl font-semibold tabular-nums tracking-tight",
    highlight === "cyan" && "text-cyan-600",
    highlight === "amber" && "text-amber-600",
    !highlight && "text-foreground",
  );

  return (
    <Card className="rounded-2xl ring-border shadow-[0_10px_40px_-15px_rgba(0,0,0,0.12)]">
      <CardHeader>
        <CardDescription className="text-xs uppercase tracking-wide">
          {label}
        </CardDescription>
        <div className="flex items-baseline gap-2">
          <CardTitle className={valueClass}>{value}</CardTitle>
          {delta ? <DeltaBadge delta={delta} /> : null}
        </div>
        {caption ? (
          <p className="text-muted-foreground text-xs mt-1">{caption}</p>
        ) : null}
      </CardHeader>
    </Card>
  );
}

type Delta = NonNullable<KpiTileProps["delta"]>;

const BADGE_BASE = "text-xs font-medium rounded-md px-1.5 py-0.5";

function DeltaBadge({ delta }: { delta: Delta }) {
  if (delta.direction === "na") {
    return (
      <span className={cn(BADGE_BASE, "text-zinc-500 bg-zinc-500/10")}>
        N/A
      </span>
    );
  }
  if (delta.direction === "flat") {
    return (
      <span className={cn(BADGE_BASE, "text-zinc-500 bg-zinc-500/10")}>
        0%
      </span>
    );
  }
  const arrow = delta.direction === "up" ? "↑" : "↓";
  const tone =
    delta.direction === "up"
      ? "text-emerald-400 bg-emerald-500/10"
      : "text-rose-400 bg-rose-500/10";
  const magnitude = Math.abs(delta.pct ?? 0).toFixed(1);
  return (
    <span className={cn(BADGE_BASE, tone)}>
      <span aria-hidden="true">{arrow}</span> {magnitude}%
    </span>
  );
}
