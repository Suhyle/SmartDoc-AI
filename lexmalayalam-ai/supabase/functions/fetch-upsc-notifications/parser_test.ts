import { extractUpscExamDate, parseUpscNotification } from "./parser.ts";

Deno.test("parses an official UPSC examination notice title and identifier", () => {
  const result = parseUpscNotification([
    "COMBINED GEO-SCIENTIST EXAMINATION, 2027",
    "EXAMINATION NOTICE NO. 01/2027 - GEO L",
    "Date of Notification of Examination 02.09.2026",
    "Union Public Service Commission",
  ].join("\n"));
  if (result?.title !== "COMBINED GEO-SCIENTIST EXAMINATION, 2027") {
    throw new Error(`Unexpected parsed title: ${result?.title ?? "null"}`);
  }
  if (result.identifier !== "01/2027-GEO L") {
    throw new Error(`Unexpected parsed identifier: ${result.identifier ?? "null"}`);
  }
});

Deno.test("joins split title and identifier text without including date labels", () => {
  const result = parseUpscNotification([
    "CIVIL SERVICES",
    "EX AMINATION NOTICE NO. 05/2026-CSE DATE: 04.02.2026",
    "(LAST DATE FOR SUBMISSION OF ONLINE APPLICATIONS: 24.02.2026 of CIVIL SERVICES",
    "EXAMINATION, 2026)",
    "Union Public Service Commission",
  ].join("\n"));
  if (result?.title !== "CIVIL SERVICES EXAMINATION, 2026") {
    throw new Error(`Unexpected parsed title: ${result?.title ?? "null"}`);
  }
  if (result.identifier !== "05/2026-CSE") {
    throw new Error(`Unexpected parsed identifier: ${result.identifier ?? "null"}`);
  }
});

Deno.test("normalizes whitespace split across an official UPSC notice number", () => {
  const result = parseUpscNotification([
    "COMBINED DEFENCE SERVICES EXAMINATION - II, 2026",
    "EXAMINATION NOTICE NO. 1 1 /2026 - CDS - II",
    "Union Public Service Commission",
  ].join("\n"));
  if (result?.identifier !== "11/2026-CDS-II") {
    throw new Error(`Unexpected normalized identifier: ${result?.identifier ?? "null"}`);
  }
});

Deno.test("rejects results, admit cards, answer keys, and question papers", () => {
  for (const excluded of ["RESULT", "ADMIT CARD", "ANSWER KEY", "QUESTION PAPER", "PRESS NOTE"]) {
    const result = parseUpscNotification([
      "Union Public Service Commission",
      `Combined Civil Services ${excluded}, 2026`,
      "Examination Notice No. 01/2026",
    ].join("\n"));
    if (result !== null) throw new Error(`Accepted an excluded UPSC document type: ${excluded}`);
  }
});

Deno.test("extracts only explicitly labeled UPSC examination dates", () => {
  const pdfDate = extractUpscExamDate("Date of (Preliminary) Examination 10.01.2027");
  const archiveDate = extractUpscExamDate("Date / (s) of Examination 10/01/2027");
  if (pdfDate !== "10.01.2027" || archiveDate !== "10/01/2027") {
    throw new Error(`Unexpected UPSC exam dates: ${pdfDate ?? "null"}, ${archiveDate ?? "null"}`);
  }
  if (extractUpscExamDate("Notification issued 02.09.2026") !== null) {
    throw new Error("Notification date was incorrectly treated as the exam date.");
  }
});

Deno.test("rejects documents without official UPSC identity or notice title", () => {
  const nonUpsc = parseUpscNotification("Combined Geo-Scientist Examination, 2027\nExamination Notice No. 01/2027");
  const noTitle = parseUpscNotification("Union Public Service Commission\nImportant Notice\nNotification No. 01/2027");
  const instructions = parseUpscNotification([
    "Union Public Service Commission",
    "Instructions for filling online application form for Civil Services Examination",
    "Notification No. 05/2025-CSP",
  ].join("\n"));
  if (nonUpsc !== null || noTitle !== null || instructions !== null) {
    throw new Error("A document without verified UPSC notification identity was accepted.");
  }
});
