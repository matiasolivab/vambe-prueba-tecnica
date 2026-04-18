import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env.local", override: true });

import { readFileSync } from "node:fs";
import { join } from "node:path";

import {
  buildIngestionService,
} from "@/ingestion/application/ingestion-factory";
import type { IngestionReport } from "@/ingestion/application/ingestion-service";

async function main(): Promise<void> {
  const { service, dispose } = buildIngestionService({
    loggerSink: () => {},
  });

  try {
    const csv = readFileSync(
      join(process.cwd(), "data/vambe_clients.csv"),
      "utf8",
    );

    const startMs = Date.now();
    console.log(
      "[seed] starting — this calls OpenAI ~60 times, expect ~7-8 min sequential",
    );

    const report = await service.ingest(csv, (p) => {
      const last = p.lastEmail ? ` — ${p.lastEmail}` : "";
      process.stdout.write(
        `\r[seed] ${p.processed}/${p.total}${last}`.padEnd(80, " "),
      );
    });
    process.stdout.write("\n");

    const durationSec = ((Date.now() - startMs) / 1000).toFixed(1);
    printReport(report, durationSec);
  } finally {
    dispose();
  }
}

function printReport(report: IngestionReport, durationSec: string): void {
  console.log("");
  console.log(
    `[seed] done in ${durationSec}s — ${report.succeeded} classified, ${report.failed} failed`,
  );
  if (report.parseErrors.length > 0) {
    console.log("[seed] parse errors:");
    for (const e of report.parseErrors) {
      console.log(`  row ${e.rowNumber}: ${e.error}`);
    }
  }
  if (report.classificationErrors.length > 0) {
    console.log("[seed] classification errors:");
    for (const e of report.classificationErrors) {
      console.log(`  ${e.email}: [${e.code}] ${e.message}`);
    }
  }
}

main().catch((err) => {
  console.error("[seed] fatal:", err instanceof Error ? err.stack : err);
  process.exit(1);
});
