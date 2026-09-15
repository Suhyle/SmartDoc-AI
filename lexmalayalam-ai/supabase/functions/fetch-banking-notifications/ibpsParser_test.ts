import {
  parseIbpsNotificationText,
  parseIbpsRegistrationDetails,
} from "./ibpsParser.ts";

Deno.test("parses explicit IBPS registration dates and cycle from the public registration page", () => {
  const result = parseIbpsRegistrationDetails(
    "Common Recruitment Process for Recruitment of Customer Service Associate in Participating Banks (CRP CSA-XVI)",
    [
      "Important Events Dates",
      "Commencement of online registration of application 01/08/2026",
      "Closure of registration of application 28/08/2026",
    ].join("\n"),
  );
  if (result?.cycle !== "CRP-CSA-XVI"
    || result.applicationStartDate !== "01/08/2026"
    || result.applicationLastDate !== "28/08/2026") {
    throw new Error(`Unexpected IBPS registration details: ${JSON.stringify(result)}`);
  }
});

Deno.test("accepts only official IBPS notification PDFs, not corrigenda or results", () => {
  const notification = parseIbpsNotificationText([
    "Institute of Banking Personnel Selection",
    "NOTIFICATION FOR COMMON RECRUITMENT PROCESS FOR RECRUITMENT OF CUSTOMER SERVICE ASSOCIATES",
    "CRP CSA-XVI",
  ].join("\n"));
  if (notification?.cycle !== "CRP-CSA-XVI") {
    throw new Error(`Unexpected IBPS notification: ${JSON.stringify(notification)}`);
  }
  const corrigendum = parseIbpsNotificationText([
    "Institute of Banking Personnel Selection",
    "Corrigendum for Notification for Common Recruitment Process CRP CSA-XVI",
  ].join("\n"));
  const nonIbps = parseIbpsNotificationText("Notification for CRP CSA-XVI");
  if (corrigendum !== null || nonIbps !== null) {
    throw new Error("A non-notification or unverified IBPS PDF was accepted.");
  }
});

Deno.test("normalizes official IBPS cycle identifiers across recruitment groups", () => {
  const cases = [
    ["Notification for CRP-RRB-XV", "CRP-RRBs-XV"],
    ["Notification for CRP PO/MT-XVI", "CRP-PO-XVI"],
    ["Notification for CRP-SO-XVI", "CRP-SPL-XVI"],
  ] as const;
  for (const [text, expected] of cases) {
    const result = parseIbpsNotificationText([
      "Institute of Banking Personnel Selection",
      text,
      "Common Recruitment Process Notification",
    ].join("\n"));
    if (result?.cycle !== expected) {
      throw new Error(`Expected ${expected}, got ${JSON.stringify(result)}.`);
    }
  }
});
