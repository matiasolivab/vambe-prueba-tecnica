import { describe, it, expect } from "vitest";
import { SystemClock, FixedClock } from "../clock";

describe("SystemClock", () => {
  it("returns a Date near wall-clock time", () => {
    const clock = new SystemClock();
    const before = Date.now();
    const now = clock.now();
    const after = Date.now();
    expect(now).toBeInstanceOf(Date);
    expect(now.getTime()).toBeGreaterThanOrEqual(before);
    expect(now.getTime()).toBeLessThanOrEqual(after);
  });
});

describe("FixedClock", () => {
  it("returns the injected instant, unchanged across calls", () => {
    const fixed = new Date("2026-04-16T10:00:00.000Z");
    const clock = new FixedClock(fixed);
    expect(clock.now().toISOString()).toBe(fixed.toISOString());
    expect(clock.now().toISOString()).toBe(fixed.toISOString());
  });

  it("can be advanced manually", () => {
    const fixed = new Date("2026-04-16T10:00:00.000Z");
    const clock = new FixedClock(fixed);
    clock.advance(5000);
    expect(clock.now().toISOString()).toBe("2026-04-16T10:00:05.000Z");
  });
});
