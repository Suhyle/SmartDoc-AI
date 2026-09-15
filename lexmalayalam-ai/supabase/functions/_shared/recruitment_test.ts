import {
  extractApplicationDates,
  extractOfficialPdfFactsFromText,
  searchOfficialDocuments,
} from "./recruitment.ts";

Deno.test("extracts an explicitly labeled UPSC application closing date", () => {
  const applicationSubmission = extractApplicationDates("Last date for submission of online applications: 24.02.2026");
  const applicationFilling = extractApplicationDates("Last date for filling up of Application 22.09.2026");
  if (applicationSubmission.application_last_date !== "2026-02-24") {
    throw new Error(`Unexpected submission closing date: ${applicationSubmission.application_last_date ?? "null"}`);
  }
  if (applicationFilling.application_last_date !== "2026-09-22") {
    throw new Error(`Unexpected filling closing date: ${applicationFilling.application_last_date ?? "null"}`);
  }
});

Deno.test("official search results retain only HTTPS URLs on explicitly approved hosts", async () => {
  const originalFetch = globalThis.fetch;
  const previousKey = Deno.env.get("GOOGLE_CUSTOM_SEARCH_API_KEY");
  const previousEngine = Deno.env.get("GOOGLE_CUSTOM_SEARCH_ENGINE_ID");
  Deno.env.set("GOOGLE_CUSTOM_SEARCH_API_KEY", "test-key");
  Deno.env.set("GOOGLE_CUSTOM_SEARCH_ENGINE_ID", "test-engine");
  globalThis.fetch = async () => new Response(JSON.stringify({
    items: [
      { title: "Official PDF", link: "https://ssc.gov.in/official.pdf", snippet: "discovery only" },
      { title: "Third party", link: "https://example.org/notice.pdf", snippet: "must reject" },
      { title: "Insecure official", link: "http://ssc.gov.in/notice.pdf", snippet: "must reject" },
    ],
  }), { status: 200, headers: { "Content-Type": "application/json" } });

  try {
    const result = await searchOfficialDocuments("site:ssc.gov.in SSC notice", ["ssc.gov.in"]);
    if (result.results.length !== 1 || result.results[0].link !== "https://ssc.gov.in/official.pdf") {
      throw new Error("Search result domain filtering accepted or rejected the wrong links.");
    }
    if (result.rejected !== 2) throw new Error(`Expected 2 rejected results, got ${result.rejected}.`);
  } finally {
    globalThis.fetch = originalFetch;
    if (previousKey === undefined) Deno.env.delete("GOOGLE_CUSTOM_SEARCH_API_KEY");
    else Deno.env.set("GOOGLE_CUSTOM_SEARCH_API_KEY", previousKey);
    if (previousEngine === undefined) Deno.env.delete("GOOGLE_CUSTOM_SEARCH_ENGINE_ID");
    else Deno.env.set("GOOGLE_CUSTOM_SEARCH_ENGINE_ID", previousEngine);
  }
});

Deno.test("extracts only explicitly labeled PDF eligibility facts and dates", () => {
  const facts = extractOfficialPdfFactsFromText([
    "Educational Qualification: Degree in Agricultural Science from a recognized university",
    "Degree Required: Bachelor of Agriculture",
    "Stream: Agronomy",
    "Age Limit: 21-30 years",
    "Total Number of Vacancies: 1,234",
    "Apply Online 01.08.2026 to 30.08.2026",
  ].join("\n"));
  if (facts.qualification !== "Degree in Agricultural Science from a recognized university"
    || facts.degree !== "Bachelor of Agriculture"
    || facts.stream !== "Agronomy"
    || facts.age_limit !== "21-30 years"
    || facts.vacancies !== 1234
    || facts.application_start_date !== "2026-08-01"
    || facts.application_last_date !== "2026-08-30") {
    throw new Error(`Unexpected explicit PDF facts: ${JSON.stringify(facts)}`);
  }

  const missing = extractOfficialPdfFactsFromText("Candidates should read the full notice before applying.");
  if (missing.qualification !== null || missing.degree !== null || missing.stream !== null
    || missing.age_limit !== null || missing.vacancies !== null) {
    throw new Error(`Unlabeled eligibility facts were fabricated: ${JSON.stringify(missing)}`);
  }
});
