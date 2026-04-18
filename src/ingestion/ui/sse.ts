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
