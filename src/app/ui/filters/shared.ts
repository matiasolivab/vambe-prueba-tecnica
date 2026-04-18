"use client";

import { useMemo } from "react";

/**
 * base-ui's Select rejects empty-string values, so we use this sentinel to
 * represent the "Todos/Todas" option. It is NEVER written to the URL —
 * selecting it DELETES the corresponding query key.
 */
export const ALL = "__all__";

/**
 * The URL keys the dashboard filter contract accepts, plus their human
 * labels and optional display formatters. Single source of truth so the
 * chips, popover form, and URL pushers never drift.
 */
export interface FilterMeta {
  readonly key: string;
  readonly label: string;
  readonly format?: (value: string) => string;
}

export const FILTER_META: readonly FilterMeta[] = [
  { key: "vendor", label: "Vendedor" },
  { key: "industry", label: "Industria" },
  { key: "size", label: "Tamaño" },
  {
    key: "closed",
    label: "Estado",
    format: (v) => (v === "true" ? "Cerrado" : v === "false" ? "Abierto" : v),
  },
  { key: "sentiment", label: "Sentiment" },
  { key: "search", label: "Buscar" },
];

export type UrlPusher = (key: string, value: string | null) => void;

/**
 * Returns a stable function that produces `?foo=bar&baz=qux` by patching
 * a single key on the CURRENT search params. `null` or empty value →
 * delete key. Memoized so effect dep arrays stay stable.
 */
export function useSearchParamsPusher(
  push: (url: string, opts?: { scroll?: boolean }) => void,
  pathname: string,
  sp: URLSearchParams,
): UrlPusher {
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

/**
 * Count how many filter keys are currently set. Used for the popover
 * trigger label (`Filtros (N)`).
 */
export function countActiveFilters(sp: URLSearchParams): number {
  return FILTER_META.reduce(
    (acc, meta) => acc + (sp.get(meta.key) ? 1 : 0),
    0,
  );
}
