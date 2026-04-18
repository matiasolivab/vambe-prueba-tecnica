"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";

import { cn } from "@/lib/utils";

export interface DashboardTab {
  readonly href: string;
  readonly label: string;
}

export const DASHBOARD_TABS: readonly DashboardTab[] = [
  { href: "/dashboard", label: "Overview" },
  { href: "/dashboard/sellers", label: "Vendedores" },
  { href: "/dashboard/clients", label: "Clientes" },
];

export function DashboardTabs() {
  const pathname = usePathname();
  const sp = useSearchParams();
  const qs = sp.toString();
  const suffix = qs.length > 0 ? `?${qs}` : "";

  return (
    <nav
      aria-label="Secciones del dashboard"
      className="relative z-10 mx-auto w-full max-w-7xl px-6 pt-6"
    >
      <div className="inline-flex items-center gap-1 rounded-full border border-border bg-card/70 p-1 shadow-sm backdrop-blur">
        {DASHBOARD_TABS.map((tab) => {
          const active = isTabActive(pathname, tab.href);
          return (
            <Link
              key={tab.href}
              href={`${tab.href}${suffix}`}
              aria-current={active ? "page" : undefined}
              className={cn(
                "whitespace-nowrap rounded-full px-4 py-1.5 text-sm font-medium transition-colors",
                active
                  ? "bg-foreground text-background shadow-sm"
                  : "text-muted-foreground hover:bg-muted/60 hover:text-foreground",
              )}
            >
              {tab.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

function isTabActive(pathname: string, href: string): boolean {
  if (href === "/dashboard") return pathname === "/dashboard";
  return pathname === href || pathname.startsWith(`${href}/`);
}
