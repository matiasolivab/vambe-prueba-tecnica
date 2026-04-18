"use client";

import { SlidersHorizontalIcon } from "lucide-react";
import { useSearchParams } from "next/navigation";

import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";

import { FiltersPanel } from "./filters-panel";
import { countActiveFilters } from "./shared";

/**
 * Compact filter trigger (PRD §RF3.2 / §RF3.4). Renders a single pill:
 *
 *   [ ⚙ Filtros · N ]
 *
 * The count badge communicates how many filters are active; clicking
 * opens a popover with the full form (`FiltersPanel`). URL-driven, so
 * Server Component sections re-render on every change.
 */
export interface FiltersBarProps {
  /** Distinct sellers sourced from `ClientRepository.distinctSellers()`. */
  readonly sellers: readonly string[];
}

export function FiltersBar({ sellers }: FiltersBarProps) {
  const sp = useSearchParams();
  const activeCount = countActiveFilters(sp);

  return (
    <Popover>
      <PopoverTrigger
        aria-label="Filtros globales"
        className={cn(
          "inline-flex items-center gap-2 rounded-full border border-border bg-card/70 px-4 py-1.5 text-sm font-medium backdrop-blur transition-colors",
          "hover:border-foreground/30 hover:bg-card",
          activeCount > 0 && "border-foreground/20",
        )}
      >
        <SlidersHorizontalIcon className="h-3.5 w-3.5 text-muted-foreground" />
        <span>Filtros</span>
        {activeCount > 0 ? (
          <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-foreground px-1.5 text-xs font-semibold text-background">
            {activeCount}
          </span>
        ) : null}
      </PopoverTrigger>
      <PopoverContent align="end" sideOffset={8}>
        <FiltersPanel sellers={sellers} />
      </PopoverContent>
    </Popover>
  );
}
