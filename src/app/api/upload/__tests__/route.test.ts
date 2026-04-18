// @vitest-environment node
import { config as loadEnv } from "dotenv";
import { NextRequest } from "next/server";
import { describe, expect, it } from "vitest";

loadEnv({ path: ".env.local", override: true });

import { POST } from "@/app/api/upload/route";

const hasDbUrl = Boolean(process.env.DATABASE_URL);
const hasOpenAIKey = Boolean(process.env.OPENAI_API_KEY);
const canRun = hasDbUrl && hasOpenAIKey;

async function readStreamText(res: Response): Promise<string> {
  if (!res.body) throw new Error("no response body");
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let out = "";
  for (;;) {
    const { value, done } = await reader.read();
    if (value) out += decoder.decode(value, { stream: true });
    if (done) break;
  }
  return out + decoder.decode();
}

function buildRequest(form: FormData): NextRequest {
  const req = new Request("http://localhost/api/upload", {
    method: "POST",
    body: form,
  });
  return new NextRequest(req);
}

describe.skipIf(!canRun)("POST /api/upload (integration — light)", () => {
  it("returns 400 when no file field is attached", async () => {
    const res = await POST(buildRequest(new FormData()));
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: string };
    expect(body.error).toBeDefined();
  });

  it("streams an SSE error event when the CSV headers are invalid", async () => {
    const form = new FormData();
    const badCsv = "foo,bar,baz\n1,2,3\n";
    form.set("csv", new Blob([badCsv], { type: "text/csv" }), "bad.csv");
    form.set("password", "pruebavambe123");

    const res = await POST(buildRequest(form));
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("text/event-stream");

    const text = await readStreamText(res);
    expect(text).toContain("event: error");
    expect(text).toContain("ingestion.invalid_csv_format");
  });

  it("returns 401 when the password is missing or wrong", async () => {
    const form = new FormData();
    form.set("csv", new Blob(["email,transcript\na@b.com,hi\n"], { type: "text/csv" }), "c.csv");
    form.set("password", "wrong");
    const res = await POST(buildRequest(form));
    expect(res.status).toBe(401);
    const body = (await res.json()) as { error: string };
    expect(body.error).toBe("invalid_password");
  });
});
