import { describe, it, expect, beforeEach } from "vitest";
import { JsonLogger } from "../logger";
import { FixedClock } from "../clock";

describe("JsonLogger", () => {
  const fixed = new Date("2026-04-16T10:00:00.000Z");
  let lines: string[];
  let logger: JsonLogger;

  beforeEach(() => {
    lines = [];
    logger = new JsonLogger(new FixedClock(fixed), (l) => lines.push(l));
  });

  it("emits a JSON object with timestamp, level, event", () => {
    logger.info("classification.started");
    expect(lines).toHaveLength(1);
    const entry = JSON.parse(lines[0]);
    expect(entry).toMatchObject({
      timestamp: "2026-04-16T10:00:00.000Z",
      level: "info",
      event: "classification.started",
    });
  });

  it("supports warn and error levels", () => {
    logger.warn("budget.exceeded");
    logger.error("llm.failed");
    const levels = lines.map((l) => JSON.parse(l).level);
    expect(levels).toEqual(["warn", "error"]);
  });

  it("merges meta into the payload", () => {
    logger.info("client.classified", { emailHash: "abc123", durationMs: 1200 });
    const entry = JSON.parse(lines[0]);
    expect(entry.emailHash).toBe("abc123");
    expect(entry.durationMs).toBe(1200);
  });

  it("does not let meta overwrite reserved fields", () => {
    logger.info("x", { level: "error", event: "spoof", timestamp: "1970" });
    const entry = JSON.parse(lines[0]);
    expect(entry.level).toBe("info");
    expect(entry.event).toBe("x");
    expect(entry.timestamp).toBe("2026-04-16T10:00:00.000Z");
  });

  it("produces valid JSON per line", () => {
    logger.info("a");
    logger.error("b", { nested: { k: 1 } });
    for (const l of lines) {
      expect(() => JSON.parse(l)).not.toThrow();
    }
  });
});
