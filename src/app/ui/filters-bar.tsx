"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";

import {
  COMPANY_SIZES,
  INDUSTRIES,
  SENTIMENTS,
} from "@/classification/domain/schema";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

/**
 * Global filter strip (PRD §RF3.2). Reads current filters from the URL,
 * pushes URL updates on every change so every Server Component section
 * re-renders against the new query string. No local state besides the
 * debounced search buffer.
 *
 * URL contract — see {@link parseFiltersFromSearchParams}:
 *   vendor, industry, size, sentiment  → plain strings (absent = "Todos")
 *   closed                             → "true" | "false" (absent = "Todos")
 *   search                             → raw text, debounced 400ms
 *
 * The Select components use base-ui's sentinel "__all__" to represent
 * "Todos"/"Todas" because base-ui rejects empty-string values. We never
 * write "__all__" to the URL — selecting it DELETES that key.
 */

const ALL = "__all__";

export interface FiltersBarProps {
  /** Distinct sellers sourced from `ClientRepository.distinctSellers()`. */
  readonly sellers: readonly string[];
}

export function FiltersBar({ sellers }: FiltersBarProps) {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();

  // Current filter values as strings (or ALL when missing). Recomputed on
  // every render so they always reflect the URL — no stale local state.
  const currentVendor = sp.get("vendor") ?? ALL;
  const currentIndustry = sp.get("industry") ?? ALL;
  const currentSize = sp.get("size") ?? ALL;
  const currentSentiment = sp.get("sentiment") ?? ALL;
  const currentClosed = sp.get("closed") ?? ALL;
  const currentSearch = sp.get("search") ?? "";

  // Local, debounced search buffer. Seeded from the URL on mount and on
  // external changes (back/forward navigation), so typing doesn't clobber
  // a server-driven value.
  const [searchDraft, setSearchDraft] = useState(currentSearch);
  useEffect(() => {
    setSearchDraft(currentSearch);
  }, [currentSearch]);

  // Serialize-push on select change. URLSearchParams handles encoding.
  const pushWith = useMemoizedPusher(router.push, pathname, sp);

  function onSelectChange(key: string) {
    return (raw: unknown) => {
      const value = typeof raw === "string" ? raw : String(raw);
      pushWith(key, value === ALL ? null : value);
    };
  }

  // Debounced search: 400ms after the last keystroke, push ?search=<text>.
  // `useRef` lets us cancel on unmount and on every subsequent keystroke.
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (searchDraft === currentSearch) return;
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      pushWith("search", searchDraft.length > 0 ? searchDraft : null);
    }, 400);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [searchDraft, currentSearch, pushWith]);

  function onClear() {
    // `router.push(pathname)` strips every param in one shot.
    router.push(pathname, { scroll: false });
  }

  return (
    <section
      aria-label="Filtros globales"
      className="mb-6 flex flex-wrap items-center gap-3 rounded-lg border border-zinc-800 bg-zinc-900/60 p-3"
    >
      <FilterSelect
        label="Vendedor"
        value={currentVendor}
        onValueChange={onSelectChange("vendor")}
        allLabel="Todos"
        options={sellers}
      />
      <FilterSelect
        label="Industria"
        value={currentIndustry}
        onValueChange={onSelectChange("industry")}
        allLabel="Todas"
        options={INDUSTRIES}
      />
      <FilterSelect
        label="Tamaño"
        value={currentSize}
        onValueChange={onSelectChange("size")}
        allLabel="Todos"
        options={COMPANY_SIZES}
      />
      <FilterSelect
        label="Estado"
        value={currentClosed}
        onValueChange={onSelectChange("closed")}
        allLabel="Todos"
        options={[
          { value: "true", label: "Cerrado" },
          { value: "false", label: "Abierto" },
        ]}
      />
      <FilterSelect
        label="Sentiment"
        value={currentSentiment}
        onValueChange={onSelectChange("sentiment")}
        allLabel="Todos"
        options={SENTIMENTS}
      />

      <div className="flex min-w-56 flex-1 items-center">
        <Input
          type="search"
          aria-label="Buscar"
          placeholder="Nombre o email..."
          value={searchDraft}
          onChange={(e) => setSearchDraft(e.target.value)}
          className="border-zinc-700 bg-zinc-800 text-zinc-100 placeholder:text-zinc-500 focus-visible:border-cyan-400 focus-visible:ring-cyan-400/40"
        />
      </div>

      <Button
        type="button"
        variant="outline"
        onClick={onClear}
        className="border-zinc-700 bg-zinc-800 text-zinc-100 hover:bg-zinc-700"
      >
        Limpiar
      </Button>
    </section>
  );
}

// --- helpers --------------------------------------------------------------

type FilterOption = string | { value: string; label: string };

interface FilterSelectProps {
  readonly label: string;
  readonly value: string;
  readonly onValueChange: (value: unknown) => void;
  readonly allLabel: string;
  readonly options: readonly FilterOption[];
}

function FilterSelect({
  label,
  value,
  onValueChange,
  allLabel,
  options,
}: FilterSelectProps) {
  return (
    <Select value={value} onValueChange={onValueChange}>
      <SelectTrigger
        aria-label={label}
        className="min-w-36 border-zinc-700 bg-zinc-800 text-zinc-100 focus-visible:border-cyan-400 focus-visible:ring-cyan-400/40"
      >
        <SelectValue placeholder={label} />
      </SelectTrigger>
      <SelectContent className="bg-zinc-900 text-zinc-100 ring-zinc-700">
        <SelectItem value={ALL}>{allLabel}</SelectItem>
        {options.map((opt) => {
          const v = typeof opt === "string" ? opt : opt.value;
          const lbl = typeof opt === "string" ? opt : opt.label;
          return (
            <SelectItem key={v} value={v}>
              {lbl}
            </SelectItem>
          );
        })}
      </SelectContent>
    </Select>
  );
}

/**
 * Returns a stable function that produces `?foo=bar&baz=qux` by patching
 * a single key on the CURRENT search params. `null` value → delete key.
 *
 * We wrap in `useMemo` so the debounce effect's dep array is stable.
 */
function useMemoizedPusher(
  push: (url: string, opts?: { scroll?: boolean }) => void,
  pathname: string,
  sp: URLSearchParams,
) {
  // Snapshot the current query string; re-create the function whenever the
  // URL changes upstream so late callbacks don't operate on a stale baseline.
  const serialized = sp.toString();
  return useMemo(
    () => (key: string, value: string | null) => {
      const next = new URLSearchParams(serialized);
      if (value === null || value.length === 0) next.delete(key);
      else next.set(key, value);
      const qs = next.toString();
      push(qs.length > 0 ? `${pathname}?${qs}` : pathname, { scroll: false });
    },
    [push, pathname, serialized],
  );
}
