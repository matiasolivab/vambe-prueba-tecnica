import Link from "next/link";
import type { ReactNode } from "react";

import UploadButton from "@/ingestion/ui/upload-button";

import { DashboardTabs } from "./ui/dashboard-tabs";

export const dynamic = "force-dynamic";

export default function DashboardLayout({
  children,
}: {
  readonly children: ReactNode;
}) {
  return (
    <main className="relative isolate min-h-screen overflow-hidden bg-background text-foreground">
      <div
        aria-hidden
        className="pointer-events-none absolute -top-40 -left-40 -z-10 h-[28rem] w-[28rem] rounded-full bg-gradient-to-br from-cyan-300/20 to-cyan-500/0 blur-3xl"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -top-32 right-[-10rem] -z-10 h-[24rem] w-[24rem] rounded-full bg-gradient-to-br from-violet-300/15 to-pink-300/10 blur-3xl"
      />

      <nav className="relative z-10 border-b border-border bg-card/60 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
          <Link href="/" className="flex items-center gap-2">
            <span className="inline-block h-2.5 w-2.5 rounded-full bg-primary" />
            <span className="text-base font-semibold tracking-tight">
              Vambe
            </span>
            <span className="ml-2 text-sm text-muted-foreground">
              · Dashboard
            </span>
          </Link>
          <UploadButton />
        </div>
      </nav>

      <DashboardTabs />

      <div className="relative z-10 mx-auto max-w-7xl px-6 py-10">
        {children}
      </div>
    </main>
  );
}
