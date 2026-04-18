"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";

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

import { ALL, useSearchParamsPusher } from "./shared";

export interface FiltersPanelProps {
  readonly sellers: readonly string[];
}

export function FiltersPanel({ sellers }: FiltersPanelProps) {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();
  const push = useSearchParamsPusher(router.push, pathname, sp);

  const currentVendor = sp.get("vendor") ?? ALL;
  const currentIndustry = sp.get("industry") ?? ALL;
  const currentSize = sp.get("size") ?? ALL;
  const currentSentiment = sp.get("sentiment") ?? ALL;
  const currentClosed = sp.get("closed") ?? ALL;
  const currentSearch = sp.get("search") ?? "";

  const [searchDraft, setSearchDraft] = useState(currentSearch);
  useEffect(() => {
    setSearchDraft(currentSearch);
  }, [currentSearch]);

  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (searchDraft === currentSearch) return;
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      push("search", searchDraft.length > 0 ? searchDraft : null);
    }, 400);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [searchDraft, currentSearch, push]);

  function onSelectChange(key: string) {
    return (raw: unknown) => {
      const value = typeof raw === "string" ? raw : String(raw);
      push(key, value === ALL ? null : value);
    };
  }

  function onClear() {
    router.push(pathname, { scroll: false });
  }

  return (
    <div className="flex w-80 flex-col gap-3">
      <div className="flex items-center justify-between">
        <span className="text-sm font-semibold">Filtros</span>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={onClear}
          className="h-auto px-2 py-1 text-xs"
        >
          Limpiar todo
        </Button>
      </div>

      <Input
        type="search"
        aria-label="Buscar"
        placeholder="Nombre o email..."
        value={searchDraft}
        onChange={(e) => setSearchDraft(e.target.value)}
      />

      <div className="grid grid-cols-2 gap-2">
        <PanelSelect
          label="Vendedor"
          value={currentVendor}
          onValueChange={onSelectChange("vendor")}
          allLabel="Todos"
          options={sellers}
        />
        <PanelSelect
          label="Industria"
          value={currentIndustry}
          onValueChange={onSelectChange("industry")}
          allLabel="Todas"
          options={INDUSTRIES}
        />
        <PanelSelect
          label="Tamaño"
          value={currentSize}
          onValueChange={onSelectChange("size")}
          allLabel="Todos"
          options={COMPANY_SIZES}
        />
        <PanelSelect
          label="Estado"
          value={currentClosed}
          onValueChange={onSelectChange("closed")}
          allLabel="Todos"
          options={[
            { value: "true", label: "Cerrado" },
            { value: "false", label: "Abierto" },
          ]}
        />
        <PanelSelect
          label="Sentiment"
          value={currentSentiment}
          onValueChange={onSelectChange("sentiment")}
          allLabel="Todos"
          options={SENTIMENTS}
          className="col-span-2"
        />
      </div>
    </div>
  );
}

type FilterOption = string | { value: string; label: string };

interface PanelSelectProps {
  readonly label: string;
  readonly value: string;
  readonly onValueChange: (value: unknown) => void;
  readonly allLabel: string;
  readonly options: readonly FilterOption[];
  readonly className?: string;
}

function PanelSelect({
  label,
  value,
  onValueChange,
  allLabel,
  options,
  className,
}: PanelSelectProps) {
  return (
    <label className={className}>
      <span className="mb-1 block text-[11px] font-medium text-muted-foreground">
        {label}
      </span>
      <Select value={value} onValueChange={onValueChange}>
        <SelectTrigger
          aria-label={label}
          className="w-full border-border bg-background"
        >
          <SelectValue placeholder={label}>
            {(v) => displayLabel(v, allLabel, options)}
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
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
    </label>
  );
}

function displayLabel(
  value: unknown,
  allLabel: string,
  options: readonly FilterOption[],
): string {
  if (value === ALL || value == null) return allLabel;
  const str = typeof value === "string" ? value : String(value);
  for (const opt of options) {
    if (typeof opt === "string") {
      if (opt === str) return opt;
    } else if (opt.value === str) {
      return opt.label;
    }
  }
  return str;
}
