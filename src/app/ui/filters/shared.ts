"use client";

import { useMemo } from "react";

export const ALL = "__all__";

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

export function countActiveFilters(sp: URLSearchParams): number {
  return FILTER_META.reduce(
    (acc, meta) => acc + (sp.get(meta.key) ? 1 : 0),
    0,
  );
}
