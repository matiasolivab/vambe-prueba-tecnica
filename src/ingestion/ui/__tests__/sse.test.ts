import { describe, expect, it } from "vitest";

import { parseSseEvents } from "@/ingestion/ui/sse";

describe("parseSseEvents", () => {
  it("returns no events and empty remainder on empty buffer", () => {
    const { events, remainder } = parseSseEvents("");
    expect(events).toEqual([]);
    expect(remainder).toBe("");
  });

  it("parses a single complete event block", () => {
    const buf = "event: progress\ndata: {\"n\":1}\n\n";
    const { events, remainder } = parseSseEvents(buf);
    expect(events).toEqual([{ event: "progress", data: "{\"n\":1}" }]);
    expect(remainder).toBe("");
  });

  it("parses multiple event blocks in one buffer", () => {
    const buf =
      "event: progress\ndata: 1\n\n" +
      "event: progress\ndata: 2\n\n" +
      "event: done\ndata: ok\n\n";
    const { events, remainder } = parseSseEvents(buf);
    expect(events).toEqual([
      { event: "progress", data: "1" },
      { event: "progress", data: "2" },
      { event: "done", data: "ok" },
    ]);
    expect(remainder).toBe("");
  });

  it("keeps an incomplete trailing block in the remainder", () => {
    const buf =
      "event: progress\ndata: 1\n\n" +
      "event: progress\ndata: 2"; // no trailing \n\n
    const { events, remainder } = parseSseEvents(buf);
    expect(events).toEqual([{ event: "progress", data: "1" }]);
    expect(remainder).toBe("event: progress\ndata: 2");
  });

  it("recovers an event split across two chunks via the remainder", () => {
    const first = "event: progress\ndata: {\"partial\":";
    const { events: e1, remainder: r1 } = parseSseEvents(first);
    expect(e1).toEqual([]);
    expect(r1).toBe(first);

    const second = r1 + "true}\n\n";
    const { events: e2, remainder: r2 } = parseSseEvents(second);
    expect(e2).toEqual([{ event: "progress", data: "{\"partial\":true}" }]);
    expect(r2).toBe("");
  });

  it("captures event type with empty data when data field is missing", () => {
    const buf = "event: ping\n\n";
    const { events, remainder } = parseSseEvents(buf);
    expect(events).toEqual([{ event: "ping", data: "" }]);
    expect(remainder).toBe("");
  });

  it("defaults event name to 'message' when event field is missing", () => {
    const buf = "data: hello\n\n";
    const { events, remainder } = parseSseEvents(buf);
    expect(events).toEqual([{ event: "message", data: "hello" }]);
    expect(remainder).toBe("");
  });

  it("joins multi-line data fields with newline per SSE spec", () => {
    const buf = "event: msg\ndata: a\ndata: b\n\n";
    const { events, remainder } = parseSseEvents(buf);
    expect(events).toEqual([{ event: "msg", data: "a\nb" }]);
    expect(remainder).toBe("");
  });
});
