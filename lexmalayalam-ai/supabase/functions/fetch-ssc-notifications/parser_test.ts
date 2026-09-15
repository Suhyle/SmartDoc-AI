import { parseSscNotification } from "./parser.ts";

Deno.test("parses an SSC notice title and official identifier from document text", () => {
  const result = parseSscNotification([
    "Staff Selection Commission",
    "Notice of Combined Graduate Level Examination, 2026",
    "Notification No. HQ-C-3008/1/2026-C-3",
    "Applications open as published in this notice.",
  ].join("\n"));
  if (result?.title !== "Notice of Combined Graduate Level Examination, 2026") {
    throw new Error(`Unexpected parsed title: ${result?.title ?? "null"}`);
  }
  if (result.identifier !== "HQ-C-3008/1/2026-C-3") {
    throw new Error(`Unexpected parsed identifier: ${result.identifier ?? "null"}`);
  }
});

Deno.test("rejects SSC results rather than treating them as recruitment notices", () => {
  const result = parseSscNotification([
    "Staff Selection Commission",
    "Notice of Combined Graduate Level Examination Result, 2026",
    "Notice No. HQ-C-3008/1/2026-C-3",
  ].join("\n"));
  if (result !== null) throw new Error("An examination result was incorrectly accepted.");
});

Deno.test("rejects documents without verified SSC identity or a notification title", () => {
  const nonSsc = parseSscNotification("Notice of Combined Graduate Level Examination, 2026");
  const noTitle = parseSscNotification("Staff Selection Commission\nImportant Notice\nNotification No. 123/2026");
  if (nonSsc !== null || noTitle !== null) {
    throw new Error("A document without verified SSC notification identity was accepted.");
  }
});
