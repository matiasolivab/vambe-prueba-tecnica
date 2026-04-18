import Link from "next/link";

export const metadata = {
  title: "Vambe — Análisis de ventas con IA",
  description:
    "Sube tus transcripciones de llamadas y obtén métricas accionables: tasa de cierre, mejor vendedor, objeciones frecuentes y pain points.",
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
          Convierte tus transcripciones de venta en{" "}
          <span className="text-primary">datos accionables</span>
        </h1>

        <p className="mx-auto mt-6 max-w-2xl text-base text-muted-foreground sm:text-lg">
          Sube tus transcripciones y obtén métricas claras como tasa de cierre,
          mejor vendedor, objeciones frecuentes y pain points, sin escuchar
          una sola llamada.
        </p>

        <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <Link
            href="/dashboard"
            className="inline-flex items-center justify-center rounded-full bg-primary px-6 py-3 text-sm font-medium text-primary-foreground shadow-sm transition-colors hover:bg-primary/90"
          >
            Ver dashboard en vivo
          </Link>
        </div>

      </section>
    </main>
  );
}
