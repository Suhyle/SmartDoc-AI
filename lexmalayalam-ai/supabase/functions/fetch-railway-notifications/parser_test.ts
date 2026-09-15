import { normalizeCenNumber, parseRailwayNotification } from "./parser.ts";

Deno.test("normalizes CEN identifiers consistently across regional pages", () => {
  const first = normalizeCenNumber("CEN 03 / 2026");
  const second = normalizeCenNumber("03/2026");
  if (first !== "03/2026" || second !== first) {
    throw new Error(`Unexpected CEN normalization: ${first ?? "null"}, ${second ?? "null"}`);
  }
});

Deno.test("accepts an official Railway CEN notice only when its ID and title are in the PDF text", () => {
  const parsed = parseRailwayNotification([
    "Government of India",
    "Ministry of Railways",
    "Railway Recruitment Boards",
    "CENTRALISED EMPLOYMENT NOTICE (CEN) No. 03/2026",
    "Recruitment of various categories of posts",
  ].join("\n"));
  if (parsed?.cenNumber !== "03/2026") throw new Error(`Unexpected CEN ID: ${parsed?.cenNumber ?? "null"}`);
  if (!parsed.title.includes("CENTRALISED EMPLOYMENT NOTICE")) {
    throw new Error(`Unexpected CEN title: ${parsed.title}`);
  }
});

Deno.test("rejects third-party content and non-notification Railway documents", () => {
  const noOfficialIdentity = parseRailwayNotification("CENTRALISED EMPLOYMENT NOTICE (CEN) No. 03/2026");
  const result = parseRailwayNotification([
    "Government of India",
    "Ministry of Railways",
    "Railway Recruitment Boards",
    "CENTRALISED EMPLOYMENT NOTICE (CEN) No. 03/2026",
    "Exam Result 2026",
  ].join("\n"));
  if (noOfficialIdentity !== null || result !== null) {
    throw new Error("Unverified or non-notification Railway content was accepted.");
  }
});
