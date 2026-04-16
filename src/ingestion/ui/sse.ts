/**
 * SSE parser for the upload streaming protocol (PRD §8.6).
 *
 * The upload endpoint emits three event types separated by blank lines
 * (`\n\n` terminators): `progress`, `done`, `error`. `fetch()` delivers the
 * stream as arbitrary chunks, so events may span chunk boundaries.
 *
 * `parseSseEvents` accepts the running buffer and returns:
 *  - `events`: every COMPLETE event block decoded into `{ event, data }`.
 *  - `remainder`: the trailing bytes that did NOT yet end with `\n\n` and
 *    must be prepended to the next chunk by the caller.
 *
 * This is a pure function — trivial to unit-test — and encapsulates the
 * one piece of SSE logic with edge cases (missing event field defaults to
 * `"message"` per the SSE spec; multi-line `data:` fields are joined with
 * `\n`).
 */

export interface SseEvent {
  readonly event: string;
  readonly data: string;
}

export interface SseParseResult {
  readonly events: readonly SseEvent[];
  readonly remainder: string;
}

export function parseSseEvents(buffer: string): SseParseResult {
  if (buffer.length === 0) return { events: [], remainder: "" };

  const lastBoundary = buffer.lastIndexOf("\n\n");
  if (lastBoundary === -1) return { events: [], remainder: buffer };

  const complete = buffer.slice(0, lastBoundary);
  const remainder = buffer.slice(lastBoundary + 2);
  const blocks = complete.split("\n\n");
  const events: SseEvent[] = [];
  for (const block of blocks) {
    if (block.length === 0) continue;
    events.push(parseBlock(block));
  }
  return { events, remainder };
}

function parseBlock(block: string): SseEvent {
  let event = "message";
  const dataLines: string[] = [];
  for (const line of block.split("\n")) {
    if (line.startsWith("event:")) {
      event = line.slice("event:".length).trim();
    } else if (line.startsWith("data:")) {
      dataLines.push(stripLeadingSpace(line.slice("data:".length)));
    }
  }
  return { event, data: dataLines.join("\n") };
}

function stripLeadingSpace(value: string): string {
  return value.startsWith(" ") ? value.slice(1) : value;
}
