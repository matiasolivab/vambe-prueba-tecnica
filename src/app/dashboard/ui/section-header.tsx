import { FiltersBar } from "@/app/ui/filters/filters-bar";

/**
 * Page-level header used by every dashboard section. Two columns:
 *
 *   [badge]                                                    [Filtros ⋯]
 *   Title
 *   Description
 *
 * The filters live in the header — same visual row as the title — so the
 * user immediately connects "this is what I'm filtering" with "here's the
 * data below". Stacks vertically on mobile (title above, filters below).
 */
export interface SectionHeaderProps {
  readonly title: string;
  readonly description: string;
  /**
   * Small rounded-full label above the title (e.g. "Resumen", "Performance").
   * Mirrors the landing pill. Optional.
   */
  readonly badge?: string;
  /**
   * Distinct sellers for the FiltersBar popover. Each page fetches this
   * alongside its own data so the header stays a pure composition of
   * server-passed props.
   */
  readonly sellers: readonly string[];
}

export function SectionHeader({
  title,
  description,
  badge,
  sellers,
}: SectionHeaderProps) {
  return (
    <header className="mb-8 flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
      <div className="min-w-0">
        {badge ? (
          <div className="inline-flex items-center gap-2 rounded-full border border-border bg-card/70 px-3 py-1 text-xs font-medium text-muted-foreground backdrop-blur">
            <span
              aria-hidden
              className="inline-block h-1.5 w-1.5 rounded-full bg-primary"
            />
            {badge}
          </div>
        ) : null}
        <h1 className="mt-4 text-3xl font-semibold tracking-tight sm:text-4xl">
          {title}
        </h1>
        <p className="mt-2 text-muted-foreground">{description}</p>
      </div>
      <div className="shrink-0 md:pt-1">
        <FiltersBar sellers={sellers} />
      </div>
    </header>
  );
}
