import Link from "next/link";

export const metadata = {
  title: "Vambe — Análisis de ventas con IA",
  description:
    "Subí tus transcripciones de llamadas y obtené métricas accionables: tasa de cierre, mejor vendedor, objeciones frecuentes y pain points.",
};

export default function LandingPage() {
  return (
    <main className="relative isolate min-h-screen overflow-hidden bg-background">
      <div
        aria-hidden
        className="pointer-events-none absolute -top-40 -left-32 h-[32rem] w-[32rem] rounded-full bg-gradient-to-br from-cyan-300/40 to-cyan-500/5 blur-3xl"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -top-32 right-[-8rem] h-[28rem] w-[28rem] rounded-full bg-gradient-to-br from-violet-300/30 to-pink-300/20 blur-3xl"
      />

      <nav className="relative z-10 mx-auto flex max-w-6xl items-center justify-between px-6 py-6">
        <Link href="/" className="flex items-center gap-2">
          <span className="inline-block h-2.5 w-2.5 rounded-full bg-primary" />
          <span className="text-base font-semibold tracking-tight">Vambe</span>
        </Link>
        <div className="flex items-center gap-5 sm:gap-8">
          <Link
            href="/dashboard"
            className="hidden text-sm font-medium text-muted-foreground transition-colors hover:text-foreground sm:inline"
          >
            Dashboard
          </Link>
          <Link
            href="/dashboard"
            className="inline-flex items-center rounded-full bg-foreground px-4 py-2 text-sm font-medium text-background transition-colors hover:bg-foreground/90"
          >
            Probar ahora
          </Link>
        </div>
      </nav>

      <section className="relative z-10 mx-auto max-w-6xl px-6 pt-14 pb-24 text-center">
        <div className="inline-flex items-center gap-2 rounded-full border border-border bg-card/70 px-3 py-1 text-xs font-medium text-muted-foreground backdrop-blur">
          <span className="inline-block h-1.5 w-1.5 rounded-full bg-primary" />
          Análisis de ventas con IA
        </div>

        <h1 className="mx-auto mt-8 max-w-4xl text-5xl font-semibold tracking-tight sm:text-6xl md:text-7xl">
          Convertí cada llamada de venta en{" "}
          <span className="text-primary">datos accionables</span>
        </h1>

        <p className="mx-auto mt-6 max-w-2xl text-base text-muted-foreground sm:text-lg">
          Subí tus transcripciones y obtené métricas claras — tasa de cierre,
          mejor vendedor, objeciones frecuentes y pain points — sin escuchar
          una sola llamada.
        </p>

        <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <Link
            href="/dashboard"
            className="inline-flex items-center justify-center rounded-full bg-primary px-6 py-3 text-sm font-medium text-primary-foreground shadow-sm transition-colors hover:bg-primary/90"
          >
            Ver dashboard en vivo
          </Link>
          <Link
            href="#demo"
            className="inline-flex items-center justify-center rounded-full border border-border bg-card px-6 py-3 text-sm font-medium transition-colors hover:bg-muted"
          >
            Agendar demo →
          </Link>
        </div>

        <p className="mt-4 text-xs text-muted-foreground">
          Sin tarjeta · subí un CSV y ves resultados en minutos
        </p>

        <DashboardPreview />
      </section>
    </main>
  );
}

function DashboardPreview() {
  return (
    <div className="relative mx-auto mt-16 max-w-5xl">
      <div className="rounded-2xl border border-border bg-card p-6 text-left shadow-[0_20px_60px_-20px_rgba(0,0,0,0.18)]">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              Overview
            </div>
            <div className="mt-1 text-lg font-semibold">
              Pipeline de ventas
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-red-400" />
            <span className="h-2 w-2 rounded-full bg-amber-400" />
            <span className="h-2 w-2 rounded-full bg-green-400" />
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <MockKpi label="Total de clientes" value="1.284" trend="+12.4%" />
          <MockKpi label="Tasa de cierre" value="38%" trend="+4.1%" accent />
          <MockKpi
            label="Mejor vendedor"
            value="Sofía M."
            trend="42 cierres"
          />
        </div>

        <div className="mt-6 rounded-xl border border-border bg-muted/50 p-4">
          <div className="mb-3 flex items-center justify-between text-xs text-muted-foreground">
            <span>Objeciones frecuentes · últimos 30 días</span>
            <span>menciones</span>
          </div>
          <div className="space-y-2">
            <MockBar label="Precio elevado" pct={62} />
            <MockBar label="Timing de compra" pct={44} />
            <MockBar label="Integración técnica" pct={31} />
            <MockBar label="Soporte / onboarding" pct={18} />
          </div>
        </div>
      </div>
    </div>
  );
}

function MockKpi({
  label,
  value,
  trend,
  accent = false,
}: {
  label: string;
  value: string;
  trend: string;
  accent?: boolean;
}) {
  return (
    <div className="rounded-xl border border-border bg-background p-4">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div
        className={`mt-2 text-2xl font-semibold tracking-tight ${
          accent ? "text-primary" : ""
        }`}
      >
        {value}
      </div>
      <div className="mt-1 text-xs text-muted-foreground">{trend}</div>
    </div>
  );
}

function MockBar({ label, pct }: { label: string; pct: number }) {
  return (
    <div className="flex items-center gap-3">
      <div className="w-40 shrink-0 text-xs">{label}</div>
      <div className="h-2 flex-1 overflow-hidden rounded-full bg-border/70">
        <div
          className="h-full rounded-full bg-primary"
          style={{ width: `${pct}%` }}
        />
      </div>
      <div className="w-10 text-right text-xs text-muted-foreground">
        {pct}%
      </div>
    </div>
  );
}
