import type { Clock } from "./clock";

export type LogLevel = "info" | "warn" | "error";

export interface Logger {
  info(event: string, meta?: Record<string, unknown>): void;
  warn(event: string, meta?: Record<string, unknown>): void;
  error(event: string, meta?: Record<string, unknown>): void;
}

export type LogSink = (line: string) => void;

const defaultSink: LogSink = (line) => {
  console.log(line);
};

export class JsonLogger implements Logger {
  constructor(
    private readonly clock: Clock,
    private readonly sink: LogSink = defaultSink,
  ) {}

  public info(event: string, meta: Record<string, unknown> = {}): void {
    this.emit("info", event, meta);
  }

  public warn(event: string, meta: Record<string, unknown> = {}): void {
    this.emit("warn", event, meta);
  }

  public error(event: string, meta: Record<string, unknown> = {}): void {
    this.emit("error", event, meta);
  }

  private emit(
    level: LogLevel,
    event: string,
    meta: Record<string, unknown>,
  ): void {
    const payload = {
      ...meta,
      timestamp: this.clock.now().toISOString(),
      level,
      event,
    };
    this.sink(JSON.stringify(payload));
  }
}
