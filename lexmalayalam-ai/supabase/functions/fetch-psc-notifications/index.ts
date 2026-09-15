import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { extractOfficialPdfFactsFromText, fetchOfficialPdfText } from "../_shared/recruitment.ts";

/* =========================================================
   CORS HEADERS
========================================================= */
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/* =========================================================
   HELPERS & VALIDATORS
========================================================= */

/**
 * Validates that the URL belongs strictly to official Kerala PSC domains
 */
function normalizePscUrl(urlStr: string, baseUrl = "https://www.keralapsc.gov.in/"): string | null {
  try {
    const parsed = new URL(urlStr, baseUrl);
    const hostname = parsed.hostname.toLowerCase();
    if (hostname !== "keralapsc.gov.in" && hostname !== "www.keralapsc.gov.in") return null;
    // The official PSC pages sometimes publish HTTP PDF links. Upgrade those
    // links to HTTPS before sending them to the shared official-PDF reader.
    parsed.protocol = "https:";
    return parsed.toString();
  } catch {
    return null;
  }
}

/**
 * HTML Entities decoder helper
 */
function decodeHtmlEntities(str: string): string {
  return str
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Converts DD-MM-YYYY format to YYYY-MM-DD
 */
function normalizeDate(rawDateStr: string): string | null {
  if (!rawDateStr) return null;
  const cleaned = rawDateStr.trim();
  const dmyMatch = /^(\d{1,2})[.-](\d{1,2})[.-](\d{4})$/.exec(cleaned);
  if (dmyMatch) {
    const day = Number(dmyMatch[1]);
    const month = Number(dmyMatch[2]);
    const year = Number(dmyMatch[3]);
    const date = new Date(Date.UTC(year, month - 1, day));
    if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return null;
    return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  }
  // Try ISO date regex match YYYY-MM-DD
  const isoMatch = /^(\d{4}-\d{2}-\d{2})/.exec(cleaned);
  if (isoMatch) return isoMatch[1];
  return null;
}

/**
 * Standard HTTP headers for scraping official Kerala PSC site
 */
const FETCH_HEADERS = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
  "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
  "Accept-Language": "en-US,en;q=0.5",
};

function normalizeEligibilityText(value: string | null | undefined): string | null {
  if (!value) return null;
  const cleaned = String(value)
    .replace(/\s+/g, " ")
    .replace(/\s*[:;,.]+\s*/g, ": ")
    .replace(/\s*\|\s*/g, " | ")
    .replace(/\s+/g, " ")
    .trim();

  return cleaned.length > 0 ? cleaned : null;
}

function isAmbiguousEligibilityValue(value: string | null): boolean {
  if (!value) return true;
  const normalized = value.trim().toLowerCase().replace(/^s\s*:\s*/i, "").trim();
  return ["all", "all candidates", "all categories", "as per rule", "not specified", "n/a"].includes(normalized)
    || normalized.length < 3;
}

function extractAgeLimit(rawText: string): string | null {
  const text = normalizeEligibilityText(rawText) ?? "";
  if (!text) return null;

  const patterns = [
    /(?:age\s*limit|age\s*[:\-]|minimum\s+age|maximum\s+age|not\s+less\s+than|not\s+more\s+than)\s*([^\n]{0,220}?)(?=(?:\b(?:education|educational|qualification|degree|stream|experience|vacancy|vacancies|selection|mode|test|interview|date|candidates|general conditions|notes?)\b)|$)/i,
    /(?:\b\d{1,2}\s*(?:-|to|and|to\s+not\s+more\s+than|\s*\-\s*)\s*\d{1,2}\s*(?:years?|yrs?)\b[^\n]{0,120})/i,
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) {
      const value = normalizeEligibilityText(match[1] || match[0]);
      if (value) {
        return value
          .replace(/^\s*[:\-]\s*/, "")
          .replace(/\s+(?:years?|yrs?)\s*$/i, "")
          .replace(/\s+and\s+not\s+more\s+than\s+/i, " to ")
          .replace(/\s+to\s+not\s+more\s+than\s+/i, " to ")
          .trim();
      }
    }
  }

  return null;
}

function extractQualificationOrDegree(rawText: string, labels: string[], stopWords: string[]): string | null {
  const text = normalizeEligibilityText(rawText) ?? "";
  if (!text) return null;

  const labelPattern = labels.join("|");
  const stopPattern = stopWords.join("|");
  const patterns = [
    new RegExp(`(?:${labelPattern})\\s*[:\-]?\\s*([^\\n]{0,250}?)(?=(?:\\b(?:${stopPattern})\\b)|$)`, "i"),
    new RegExp(`(?:must\s+possess|pass\s+in|holding|having)\\s*([^\\n]{0,250}?)(?=(?:\\b(?:${stopPattern})\\b)|$)`, "i"),
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) {
      const value = normalizeEligibilityText(match[1]);
      if (value) {
        const cleaned = value
          .replace(/^\s*[:\-]\s*/, "")
          .replace(/\s*(?:and|or)\s*(?:age|age limit|experience|stream|subject|specialization|specialisation|qualification|educational qualification|degree)\b.*$/i, "")
          .trim();

        if (cleaned && !isAmbiguousEligibilityValue(cleaned)) return cleaned;
      }
    }
  }

  return null;
}

function extractStream(rawText: string): string | null {
  const text = normalizeEligibilityText(rawText) ?? "";
  if (!text) return null;

  const patterns = [
    /(?:stream|subject|specialization|specialisation|branch)\s*[:\-]?\s*([^\n]{0,200}?)(?=(?:\b(?:age|experience|qualification|degree|education|vacancy|vacancies|selection|candidates|note|notes)\b)|$)/i,
    /(?:in\s+the\s+discipline\s+of)\s*([^\n]{0,200}?)(?=(?:\b(?:age|experience|qualification|degree|education|vacancy|vacancies|selection|candidates|note|notes)\b)|$)/i,
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) {
      const value = normalizeEligibilityText(match[1]);
      if (value && !isAmbiguousEligibilityValue(value)) {
        return value.replace(/^\s*[:\-]\s*/, "").trim();
      }
    }
  }

  return null;
}

async function extractEligibilityFromPdf(pdfUrl: string): Promise<{
  qualification: string | null;
  degree: string | null;
  stream: string | null;
  age_limit: string | null;
}> {
  try {
    const pdfText = await fetchOfficialPdfText(pdfUrl, ["keralapsc.gov.in", "www.keralapsc.gov.in"]);
    const facts = extractOfficialPdfFactsFromText(pdfText);
    return {
      qualification: facts.qualification,
      degree: facts.degree,
      stream: facts.stream,
      age_limit: facts.age_limit,
    };
  } catch (error) {
    console.warn(`Failed to read eligibility from official PSC PDF ${pdfUrl}:`, error);
    return { qualification: null, degree: null, stream: null, age_limit: null };
  }
}

/* =========================================================
   MAIN EDGE FUNCTION HANDLER
========================================================= */
serve(async (req) => {
  // Handle CORS preflight request
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ success: false, error: "Use POST to fetch PSC notifications." }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  let requestBody: Record<string, unknown> = {};
  try {
    requestBody = await req.json();
  } catch {
    requestBody = {};
  }
  const dryRun = new URL(req.url).searchParams.get("dry_run") === "true"
    || requestBody.dry_run === true
    || requestBody.mode === "dry_run";

  console.log("PSC fetch started");

  try {
    // 1. Initialize Supabase Client (Service Role or Anon fallback)
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !supabaseKey) {
      console.error("Missing Supabase environment variables!");
      return new Response(
        JSON.stringify({ success: false, error: "Server configuration error: missing Supabase keys" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // 2. Fetch main official PSC notifications page
    const pscMainUrl = "https://www.keralapsc.gov.in/notifications";
    console.log(`Requesting official PSC source: ${pscMainUrl}`);

    const mainRes = await fetch(pscMainUrl, { headers: FETCH_HEADERS });

    if (!mainRes.ok) {
      console.error(`Failed to fetch PSC main page. Status: ${mainRes.status}`);
      return new Response(
        JSON.stringify({ success: false, error: `Official PSC site returned status ${mainRes.status}` }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const mainHtml = await mainRes.text();
    console.log("PSC page fetched successfully");

    // 3. Parse main table <tr> rows
    const trMatches = mainHtml.match(/<tr[\s\S]*?<\/tr>/gi) || [];
    console.log(`Number of notification entries found: ${trMatches.length}`);

    let fetchedCount = 0;
    let insertedCount = 0;
    let updatedCount = 0;
    let skippedCount = 0;

    // Process top recent Gazettes (limit to top 5 recent gazettes to avoid rate limits)
    const gazetteRows = trMatches.filter((tr) => !tr.includes("<th")).slice(0, 5);

    for (const tr of gazetteRows) {
      // Each PSC post requires parsing an official PDF. Bound this demo refresh
      // to avoid the Edge worker exhausting memory on large gazettes.
      if (fetchedCount >= 12) break;
      // Extract detail page link
      const linkMatch = /<a\s+[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi.exec(tr);
      // Extract last date
      const timeMatch = /<time[^>]*>([\s\S]*?)<\/time>/gi.exec(tr);

      if (!linkMatch) continue;

      const detailRelativeUrl = linkMatch[1];
      const gazetteTitle = decodeHtmlEntities(linkMatch[2].replace(/<[^>]+>/g, ""));
      // The current Kerala PSC listing renders the deadline as plain cell text
      // on some pages instead of a <time> element.
      const rowText = tr.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
      const rawDate = timeMatch
        ? timeMatch[1].replace(/<[^>]+>/g, "").trim()
        : /\b\d{1,2}[.-]\d{1,2}[.-]\d{4}\b/.exec(rowText)?.[0] || "";
      const applicationLastDate = normalizeDate(rawDate);

      const gazetteFullUrl = normalizePscUrl(detailRelativeUrl);

      if (!gazetteFullUrl) {
        console.warn(`Skipping invalid/untrusted PSC detail URL: ${detailRelativeUrl}`);
        skippedCount++;
        continue;
      }

      // Fetch Gazette detail page containing individual posts
      try {
        console.log(`Fetching Gazette detail page: ${gazetteFullUrl}`);
        const gazetteRes = await fetch(gazetteFullUrl, { headers: FETCH_HEADERS });

        if (!gazetteRes.ok) {
          console.warn(`Could not load gazette page ${gazetteFullUrl}`);
          skippedCount++;
          continue;
        }

        const gazetteHtml = await gazetteRes.text();

        // Extract individual notification items with PDF links
        const itemRegex = /<div\s+class=["']field__item["']>[\s\S]*?<a\s+href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
        let itemMatch;
        let itemsFoundInGazette = 0;

        while ((itemMatch = itemRegex.exec(gazetteHtml)) !== null) {
          if (fetchedCount >= 12) break;
          const pdfUrlRaw = itemMatch[1];
          const rawItemTitle = decodeHtmlEntities(itemMatch[2].replace(/<[^>]+>/g, ""));

          // Ignore non-notification links like "Back" button
          if (!pdfUrlRaw.includes(".pdf") && !pdfUrlRaw.includes("sites/default/files")) {
            continue;
          }

          itemsFoundInGazette++;
          fetchedCount++;

          const pdfUrl = normalizePscUrl(pdfUrlRaw, gazetteFullUrl);
          if (!pdfUrl) {
            console.warn(`Skipping invalid/untrusted PSC PDF URL: ${pdfUrlRaw}`);
            skippedCount++;
            continue;
          }

          // Normalize category number (e.g. Cat.No.151/2026 or Category No. 151/2026 -> 151/2026)
          const catMatch = /(?:Cat(?:egory)?\.?\s*No\.?\s*[:\.]?\s*|\b)([0-9]{1,4}\/[0-9]{4}(?:\s*&\s*[0-9]{1,4}\/[0-9]{4})?)/i.exec(rawItemTitle);
          const sourceNotificationId = catMatch ? catMatch[1].trim() : null;

          if (!sourceNotificationId) {
            console.warn(`Could not extract category number for item: ${rawItemTitle}`);
            skippedCount++;
            continue;
          }

          // Clean post / exam name
          const examName = rawItemTitle
            .replace(/\s*\(?(?:Cat(?:egory)?\.?\s*No\.?\s*[:\.]?\s*)?[0-9]{1,4}\/[0-9]{4}(?:\s*&\s*[0-9]{1,4}\/[0-9]{4})?\)?\s*/gi, "")
            .trim();

          const notificationTitle = rawItemTitle;
          const eligibility = await extractEligibilityFromPdf(pdfUrl);

          // Do not save a partial notice: the UI and matching logic require an
          // exam name, a verified qualification, and the official last date.
          if (!examName || !applicationLastDate
            || ![eligibility.qualification, eligibility.degree, eligibility.stream].some((value) => value?.trim())) {
            console.info(`Skipping incomplete PSC notice ${sourceNotificationId}: required exam name, qualification, or last date was not verified.`);
            skippedCount++;
            continue;
          }

          // Upsert logic to prevent duplicates
          const { data: existing, error: lookupErr } = await supabase
            .from("exam_notifications")
            .select("id")
            .eq("source", "Kerala PSC")
            .eq("source_notification_id", sourceNotificationId)
            .maybeSingle();

          if (lookupErr) {
            console.error(`Error checking existing PSC record ${sourceNotificationId}:`, lookupErr);
            skippedCount++;
            continue;
          }

          const nowIso = new Date().toISOString();

          if (existing) {
            // Update existing record
            const { error: updateErr } = dryRun ? { error: null } : await supabase
              .from("exam_notifications")
              .update({
                exam_name: examName,
                notification_title: notificationTitle,
                qualification: eligibility.qualification ?? null,
                degree: eligibility.degree ?? null,
                stream: eligibility.stream ?? null,
                age_limit: eligibility.age_limit ?? null,
                application_last_date: applicationLastDate,
                official_notification_url: pdfUrl,
                official_website_url: "https://www.keralapsc.gov.in/",
                is_active: true,
                updated_at: nowIso,
              })
              .eq("id", existing.id);

            if (updateErr) {
              console.error(`Error updating record ${sourceNotificationId}:`, updateErr);
              skippedCount++;
            } else {
              updatedCount++;
            }
          } else {
            // Insert new record
            const { error: insertErr } = dryRun ? { error: null } : await supabase
              .from("exam_notifications")
              .insert({
                category: "PSC",
                organization: "Kerala Public Service Commission",
                exam_name: examName,
                notification_title: notificationTitle,
                qualification: eligibility.qualification ?? null,
                degree: eligibility.degree ?? null,
                stream: eligibility.stream ?? null,
                age_limit: eligibility.age_limit ?? null,
                application_last_date: applicationLastDate,
                official_notification_url: pdfUrl,
                official_website_url: "https://www.keralapsc.gov.in/",
                is_active: true,
                source: "Kerala PSC",
                source_notification_id: sourceNotificationId,
                created_at: nowIso,
                updated_at: nowIso,
              });

            if (insertErr) {
              console.error(`Error inserting record ${sourceNotificationId}:`, insertErr);
              skippedCount++;
            } else {
              insertedCount++;
            }
          }
        }

        // Fallback: If no individual items found in gazette detail, treat gazette as single item
        if (itemsFoundInGazette === 0) {
          fetchedCount++;
          const gazetteCatMatch = /(?:CAT\.?\s*NO\.?\s*[:\.]?\s*)([0-9\/&]+\s*(?:TO\s*[0-9\/&]+)?)/i.exec(tr);
          const fallbackCatId = gazetteCatMatch ? gazetteCatMatch[1].trim() : gazetteTitle;
          const eligibility = await extractEligibilityFromPdf(gazetteFullUrl);

          if (!fallbackCatId || !gazetteTitle || !applicationLastDate
            || ![eligibility.qualification, eligibility.degree, eligibility.stream].some((value) => value?.trim())) {
            console.info(`Skipping incomplete PSC gazette ${gazetteTitle}: required exam name, qualification, or last date was not verified.`);
            skippedCount++;
            continue;
          }

          const { data: existing, error: lookupErr } = await supabase
            .from("exam_notifications")
            .select("id")
            .eq("source", "Kerala PSC")
            .eq("source_notification_id", fallbackCatId)
            .maybeSingle();

          if (lookupErr) {
            console.error(`Error checking existing PSC gazette ${fallbackCatId}:`, lookupErr);
            skippedCount++;
            continue;
          }

          const nowIso = new Date().toISOString();

          if (existing) {
            const { error: updateErr } = dryRun ? { error: null } : await supabase
              .from("exam_notifications")
              .update({
                exam_name: gazetteTitle,
                notification_title: gazetteTitle,
                qualification: eligibility.qualification ?? null,
                degree: eligibility.degree ?? null,
                stream: eligibility.stream ?? null,
                age_limit: eligibility.age_limit ?? null,
                application_last_date: applicationLastDate,
                official_notification_url: gazetteFullUrl,
                is_active: true,
                updated_at: nowIso,
              })
              .eq("id", existing.id);
            if (updateErr) {
              console.error(`Error updating PSC gazette ${fallbackCatId}:`, updateErr);
              skippedCount++;
            } else {
              updatedCount++;
            }
          } else {
            const { error: insertErr } = dryRun ? { error: null } : await supabase
              .from("exam_notifications")
              .insert({
                category: "PSC",
                organization: "Kerala Public Service Commission",
                exam_name: gazetteTitle,
                notification_title: gazetteTitle,
                qualification: eligibility.qualification ?? null,
                degree: eligibility.degree ?? null,
                stream: eligibility.stream ?? null,
                age_limit: eligibility.age_limit ?? null,
                application_last_date: applicationLastDate,
                official_notification_url: gazetteFullUrl,
                official_website_url: "https://www.keralapsc.gov.in/",
                is_active: true,
                source: "Kerala PSC",
                source_notification_id: fallbackCatId,
                created_at: nowIso,
                updated_at: nowIso,
              });
            if (insertErr) {
              console.error(`Error inserting PSC gazette ${fallbackCatId}:`, insertErr);
              skippedCount++;
            } else {
              insertedCount++;
            }
          }
        }
      } catch (gazetteErr) {
        console.error(`Error processing gazette page ${gazetteFullUrl}:`, gazetteErr);
        skippedCount++;
      }
    }

    console.log("Number of valid records found:", fetchedCount);
    console.log("Number of records inserted:", insertedCount);
    console.log("Number of records updated:", updatedCount);
    console.log("Number of records skipped:", skippedCount);
    console.log("PSC fetch completed");

    const hasUsableNotifications = fetchedCount > 0 && insertedCount + updatedCount > 0;
    return new Response(
      JSON.stringify({
        success: hasUsableNotifications,
        source: "PSC",
        dry_run: dryRun,
        found: fetchedCount,
        fetched: fetchedCount,
        inserted: insertedCount,
        updated: updatedCount,
        skipped: skippedCount,
        ...(!hasUsableNotifications ? { error: "PSC fetch found no notices with a verified exam name, qualification, and last date. Check the official notice PDFs and function logs." } : {}),
      }),
      { status: hasUsableNotifications ? 200 : 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    console.error("Unhandled error during PSC fetch:", err);
    return new Response(
      JSON.stringify({
        success: false,
        error: err.message || "An unexpected error occurred during PSC fetch",
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
