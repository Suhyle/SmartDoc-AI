import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

export type RecruitmentRecord = {
  exam_name: string;
  organization: string;
  notification_title: string;
  description: string | null;
  qualification: string | null;
  degree: string | null;
  stream: string | null;
  age_limit: string | null;
  vacancies: number | null;
  application_start_date: string | null;
  application_last_date: string | null;
  exam_date: string | null;
  official_notification_url: string | null;
  official_website_url: string;
  source_notification_id: string;
};

export type RecruitmentSource = {
  name: string;
  fetchRecords: () => Promise<RecruitmentRecord[]>;
  fallbackFor?: string[];
};

export type OfficialSearchResult = {
  title: string;
  link: string;
  snippet: string;
};

type SyncOptions = {
  category: "SSC" | "UPSC" | "Railway" | "Banking";
  source: string;
  officialWebsiteUrl: string;
  sources: RecruitmentSource[];
};

export const SOURCE_HEADERS = {
  "User-Agent": "SmartDocAI notification indexer (official-source-only)",
  "Accept": "text/html,application/json,application/pdf;q=0.9,*/*;q=0.8",
};

export function decodeHtml(value: string): string {
  return value
    .replace(/&nbsp;|&#160;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#0*39;|&apos;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&#(\d+);/g, (_, number) => String.fromCodePoint(Number(number)))
    .replace(/&#x([0-9a-f]+);/gi, (_, number) => String.fromCodePoint(parseInt(number, 16)));
}

export function stripHtml(value: string): string {
  return decodeHtml(value.replace(/<script\b[\s\S]*?<\/script>/gi, " ")
    .replace(/<style\b[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " "))
    .replace(/\s+/g, " ")
    .trim();
}

export function parseAnchors(html: string, baseUrl: string, allowedHosts: string[]): Array<{
  href: string;
  text: string;
  start: number;
  end: number;
}> {
  const anchors: Array<{ href: string; text: string; start: number; end: number }> = [];
  const anchorPattern = /<a\b([^>]*?)href\s*=\s*(["'])(.*?)\2([^>]*)>([\s\S]*?)<\/a\s*>/gi;
  let match: RegExpExecArray | null;

  while ((match = anchorPattern.exec(html)) !== null) {
    try {
      const url = new URL(decodeHtml(match[3].trim()), baseUrl);
      if (url.protocol !== "https:" || !allowedHosts.includes(url.hostname.toLowerCase())) continue;
      url.hash = "";
      anchors.push({
        href: url.toString(),
        text: stripHtml(match[5]),
        start: match.index,
        end: anchorPattern.lastIndex,
      });
    } catch {
      continue;
    }
  }

  return anchors;
}

export async function fetchOfficialText(url: string, allowedHosts: string[]): Promise<{
  text: string;
  finalUrl: string;
}> {
  const parsedUrl = new URL(url);
  if (parsedUrl.protocol !== "https:" || !allowedHosts.includes(parsedUrl.hostname.toLowerCase())) {
    throw new Error(`Refusing non-official URL: ${url}`);
  }

  const response = await fetch(url, { headers: SOURCE_HEADERS, redirect: "follow" });
  const finalUrl = new URL(response.url);
  if (finalUrl.protocol !== "https:" || !allowedHosts.includes(finalUrl.hostname.toLowerCase())) {
    throw new Error(`Official source redirected to an unapproved URL: ${finalUrl.toString()}`);
  }
  if (!response.ok) {
    throw new Error(`Official source returned HTTP ${response.status}: ${url}`);
  }
  return { text: await response.text(), finalUrl: response.url };
}

export async function searchOfficialDocuments(query: string, allowedHosts: string[]): Promise<{
  results: OfficialSearchResult[];
  rejected: number;
}> {
  const apiKey = Deno.env.get("GOOGLE_CUSTOM_SEARCH_API_KEY");
  const engineId = Deno.env.get("GOOGLE_CUSTOM_SEARCH_ENGINE_ID");
  if (!apiKey || !engineId) {
    throw new Error("Official search fallback is unavailable: configure GOOGLE_CUSTOM_SEARCH_API_KEY and GOOGLE_CUSTOM_SEARCH_ENGINE_ID.");
  }
  if (!allowedHosts.some((host) => query.toLowerCase().includes(`site:${host.toLowerCase()}`))) {
    throw new Error("Official search query must be restricted to an approved official domain.");
  }

  const searchUrl = new URL("https://www.googleapis.com/customsearch/v1");
  searchUrl.searchParams.set("key", apiKey);
  searchUrl.searchParams.set("cx", engineId);
  searchUrl.searchParams.set("q", query);
  searchUrl.searchParams.set("num", "10");

  let response: Response;
  try {
    response = await fetch(searchUrl.toString(), { headers: { Accept: "application/json" } });
  } catch {
    throw new Error("Configured official search provider could not be reached.");
  }
  if (!response.ok) {
    throw new Error(`Configured official search provider returned HTTP ${response.status}.`);
  }

  let payload: { items?: Array<{ title?: unknown; link?: unknown; snippet?: unknown }> };
  try {
    payload = await response.json();
  } catch {
    throw new Error("Configured official search provider returned invalid JSON.");
  }

  const results: OfficialSearchResult[] = [];
  let rejected = 0;
  for (const item of payload.items || []) {
    if (typeof item.link !== "string") {
      rejected++;
      continue;
    }
    try {
      const url = new URL(item.link);
      if (url.protocol !== "https:" || !allowedHosts.includes(url.hostname.toLowerCase())) {
        rejected++;
        continue;
      }
      url.hash = "";
      results.push({
        title: typeof item.title === "string" ? item.title : "",
        link: url.toString(),
        snippet: typeof item.snippet === "string" ? item.snippet : "",
      });
    } catch {
      rejected++;
    }
  }
  return { results, rejected };
}

export async function fetchOfficialPdfText(url: string, allowedHosts: string[]): Promise<string> {
  const parsedUrl = new URL(url);
  if (parsedUrl.protocol !== "https:" || !allowedHosts.includes(parsedUrl.hostname.toLowerCase())) {
    throw new Error(`Refusing non-official PDF URL: ${url}`);
  }

  const response = await fetch(url, { headers: SOURCE_HEADERS, redirect: "follow" });
  const finalUrl = new URL(response.url);
  if (finalUrl.protocol !== "https:" || !allowedHosts.includes(finalUrl.hostname.toLowerCase())) {
    throw new Error(`Official PDF redirected to an unapproved URL: ${finalUrl.toString()}`);
  }
  if (!response.ok) throw new Error(`Official PDF returned HTTP ${response.status}: ${url}`);

  const bytes = new Uint8Array(await response.arrayBuffer());
  if (new TextDecoder().decode(bytes.subarray(0, 5)) !== "%PDF-") {
    throw new Error(`Official PDF URL did not return PDF bytes: ${url}`);
  }

  const { getDocument } = await import("npm:pdfjs-dist@4.10.38/legacy/build/pdf.mjs");
  const loadingTask = getDocument({
    data: bytes,
    useSystemFonts: true,
    verbosity: 0,
  });
  const pdf = await loadingTask.promise;
  try {
    const pages: string[] = [];
    for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber++) {
      const page = await pdf.getPage(pageNumber);
      const content = await page.getTextContent();
      const rows = new Map<number, Array<{ x: number; text: string }>>();
      for (const item of content.items) {
        if (!("str" in item) || !item.str.trim()) continue;
        const x = item.transform[4];
        const y = Math.round(item.transform[5]);
        const row = rows.get(y) || [];
        row.push({ x, text: item.str });
        rows.set(y, row);
      }
      pages.push([...rows.entries()]
        .sort(([left], [right]) => right - left)
        .map(([, row]) => row.sort((left, right) => left.x - right.x).map((item) => item.text).join(" "))
        .join("\n"));
    }
    const text = pages.join("\n").replace(/[ \t]+/g, " ").trim();
    if (!text) throw new Error(`Official PDF has no extractable text: ${url}`);
    return text;
  } finally {
    await loadingTask.destroy();
  }
}

export async function fetchOfficialPdfFacts(url: string, allowedHosts: string[]): Promise<{
  qualification: string | null;
  degree: string | null;
  stream: string | null;
  age_limit: string | null;
  vacancies: number | null;
  application_start_date: string | null;
  application_last_date: string | null;
}> {
  return extractOfficialPdfFactsFromText(await fetchOfficialPdfText(url, allowedHosts));
}

export function extractOfficialPdfFactsFromText(text: string): {
  qualification: string | null;
  degree: string | null;
  stream: string | null;
  age_limit: string | null;
  vacancies: number | null;
  application_start_date: string | null;
  application_last_date: string | null;
} {
  const qualification = capturePdfValue(text, [
    /^\s*(?:\d+[.)]\s*)?(?:minimum\s+)?(?:educational\s+)?qualifications?\s*[:-]\s*(.{8,240})\s*$/im,
    /^\s*(?:minimum\s+)?qualifications?\s+required\s*[:-]\s*(.{8,240})\s*$/im,
  ]) || extractLabeledEducationQualification(text);
  const degree = capturePdfValue(text, [
    /^\s*(?:degree\s+(?:required|qualification)|essential\s+degree)\s*[:-]\s*(.{3,160})\s*$/im,
  ]);
  const stream = capturePdfValue(text, [
    /^\s*(?:stream|discipline|speciali[sz]ation|subject)\s*[:-]\s*(.{3,140})\s*$/im,
  ]);
  const extractedAgeLimit = capturePdfValue(text, [
    /^\s*\bage(?:\s+limit|\s+criteria)?\s*[:-]\s*(.{2,100})\s*$/im,
  ]);
  const ageLimit = extractedAgeLimit && !/\bfor\s+(?:SC|ST|OBC|EWS|PwBD|PWD|UR|General)\b/i.test(extractedAgeLimit)
    ? extractedAgeLimit
    : null;
  const vacancyText = /^\s*(?:total\s+(?:number|no\.?)\s+of\s+vacancies|number\s+of\s+vacancies|vacancies)\s*[:-]\s*([\d,]+)\s*$/im.exec(text)?.[1];
  const vacancies = vacancyText ? Number(vacancyText.replace(/,/g, "")) : null;
  return {
    qualification,
    degree,
    stream,
    age_limit: ageLimit,
    vacancies: Number.isSafeInteger(vacancies) ? vacancies : null,
    ...extractApplicationDates(text),
  };
}

function extractLabeledEducationQualification(text: string): string | null {
  // Some official PDFs split the label across table rows and put its value on a "Mandatory:" row.
  const label = /\beducational(?:\s*\n\s*|\s+)qualifications?\b/i.exec(text);
  if (!label) return null;
  const tail = text.slice(label.index + label[0].length, label.index + label[0].length + 900);
  const end = /\n\s*(?:post[- ]qualification\s+experience|specific\s+skills|job\s+profile|key\s+responsibility)\b/i.exec(tail)?.index;
  const section = end === undefined ? tail : tail.slice(0, end);
  const mandatory = /(?:^|\n)\s*mandatory\s*:\s*([^\n]{8,240})/i.exec(section)?.[1];
  if (mandatory) return mandatory.replace(/\s+/g, " ").trim();
  const lines = section.split("\n").map((line) => line.trim()).filter(Boolean);
  return lines.find((line) => line.length >= 8 && !/^\(?as on\b/i.test(line)) || null;
}

export async function readOfficialPdfFacts(
  url: string,
  allowedHosts: string[],
  sourceName: string,
): Promise<Partial<RecruitmentRecord>> {
  try {
    const facts = await fetchOfficialPdfFacts(url, allowedHosts);
    const availableFacts: Partial<RecruitmentRecord> = {};
    if (facts.qualification !== null) availableFacts.qualification = facts.qualification;
    if (facts.degree !== null) availableFacts.degree = facts.degree;
    if (facts.stream !== null) availableFacts.stream = facts.stream;
    if (facts.age_limit !== null) availableFacts.age_limit = facts.age_limit;
    if (facts.vacancies !== null) availableFacts.vacancies = facts.vacancies;
    if (facts.application_start_date !== null) availableFacts.application_start_date = facts.application_start_date;
    if (facts.application_last_date !== null) availableFacts.application_last_date = facts.application_last_date;
    return availableFacts;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.warn(`[${sourceName}] Official PDF could not be parsed; leaving unverified fields empty: ${url}: ${message}`);
    return {};
  }
}

function capturePdfValue(text: string, patterns: RegExp[]): string | null {
  for (const pattern of patterns) {
    const match = pattern.exec(text);
    const value = match?.[1]?.replace(/\s+/g, " ").trim();
    if (value && !/^[,;:/-]|[,;:/-]$/.test(value)) return value;
  }
  return null;
}

export function parseOfficialDate(value: string | null | undefined): string | null {
  if (!value) return null;
  const text = value.trim();
  let match = /^(\d{4})-(\d{1,2})-(\d{1,2})/.exec(text);
  if (match) return validDate(Number(match[1]), Number(match[2]), Number(match[3]));

  match = /^(\d{1,2})[./-](\d{1,2})[./-](\d{4})$/.exec(text);
  if (match) return validDate(Number(match[3]), Number(match[2]), Number(match[1]));

  match = /^(\d{1,2})\s+([A-Za-z]+)\s+(\d{4})$/.exec(text);
  if (match) {
    const month = new Date(`${match[2]} 1, 2000`).getMonth() + 1;
    return validDate(Number(match[3]), month, Number(match[1]));
  }
  return null;
}

function validDate(year: number, month: number, day: number): string | null {
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return null;
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

export function extractApplicationDates(text: string): {
  application_start_date: string | null;
  application_last_date: string | null;
} {
  const rangePatterns = [
    /online\s+registration(?:\s+of\s+applications?)?\s*(?:&[^\n]{0,50})?\s*[:-]?\s*from\s*(\d{1,2}[./-]\d{1,2}[./-]\d{4})\s*(?:to|through|until|[-–])\s*(\d{1,2}[./-]\d{1,2}[./-]\d{4})/i,
    /apply\s+online\s*[-(:]?\s*(\d{1,2}[./-]\d{1,2}[./-]\d{4})\s*(?:to|through|until|[-–])\s*(\d{1,2}[./-]\d{1,2}[./-]\d{4})/i,
    /(?:apply(?:ing)?\s+(?:online\s+)?from|application(?:s)?\s+(?:open|start)(?:s|ing)?\s+(?:from|on))\s*[:-]?\s*(\d{1,2}[./-]\d{1,2}[./-]\d{4})\s*(?:to|through|until|[-–])\s*(\d{1,2}[./-]\d{1,2}[./-]\d{4})/i,
    /(?:apply(?:ing)?\s+(?:online\s+)?from)\s*[:-]?\s*(\d{1,2}\s+[A-Za-z]+\s+\d{4})\s*(?:to|through|until|[-–])\s*(\d{1,2}\s+[A-Za-z]+\s+\d{4})/i,
  ];

  let rangeMatch: RegExpExecArray | null = null;
  for (const pattern of rangePatterns) {
    const globalPattern = new RegExp(pattern.source, `${pattern.flags}g`);
    let match: RegExpExecArray | null;
    while ((match = globalPattern.exec(text)) !== null) rangeMatch = match;
  }
  if (rangeMatch) {
    return {
      application_start_date: parseOfficialDate(rangeMatch[1]),
      application_last_date: parseOfficialDate(rangeMatch[2]),
    };
  }

  const lastDatePattern = /(?:last date(?:\s+(?:to\s+apply|for\s+(?:(?:filling\s+up|receipt|submission)\s+of\s+)?(?:online\s+)?applications?))?|closing date)\s*[:-]?\s*(\d{1,2}[./-]\d{1,2}[./-]\d{4}|\d{1,2}\s+[A-Za-z]+\s+\d{4})/gi;
  let lastMatch: RegExpExecArray | null = null;
  let match: RegExpExecArray | null;
  while ((match = lastDatePattern.exec(text)) !== null) lastMatch = match;
  return {
    application_start_date: null,
    application_last_date: lastMatch ? parseOfficialDate(lastMatch[1]) : null,
  };
}

export function makeRecord(input: Partial<RecruitmentRecord> & {
  sourceId: string;
  officialWebsiteUrl: string;
  notificationUrl?: string | null;
  title: string;
  examName?: string | null;
  organization: string;
}): RecruitmentRecord {
  const title = input.title.trim();
  return {
    exam_name: input.examName?.trim() || title,
    organization: input.organization,
    notification_title: title,
    description: input.description?.trim() || null,
    qualification: input.qualification?.trim() || null,
    degree: input.degree?.trim() || null,
    stream: input.stream?.trim() || null,
    age_limit: input.age_limit?.trim() || null,
    vacancies: Number.isFinite(input.vacancies) ? Number(input.vacancies) : null,
    application_start_date: parseOfficialDate(input.application_start_date) || null,
    application_last_date: parseOfficialDate(input.application_last_date) || null,
    exam_date: parseOfficialDate(input.exam_date) || null,
    official_notification_url: input.notificationUrl || null,
    official_website_url: input.officialWebsiteUrl,
    source_notification_id: input.sourceId,
  };
}

export async function runRecruitmentSync(req: Request, options: SyncOptions): Promise<Response> {
  const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
  };
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") {
    return jsonResponse({ success: false, error: "Use POST to fetch official recruitment notices." }, 405, corsHeaders);
  }

  let dryRun = new URL(req.url).searchParams.get("dry_run") === "true";
  if (req.headers.get("content-type")?.includes("application/json")) {
    try {
      const body = await req.json();
      if (body && typeof body === "object" && body.dry_run === true) dryRun = true;
    } catch {
      return jsonResponse({ success: false, error: "Request JSON could not be parsed." }, 400, corsHeaders);
    }
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!dryRun && (!supabaseUrl || !serviceRoleKey)) {
    return jsonResponse({ success: false, error: "Server configuration error: Supabase service credentials are unavailable." }, 500, corsHeaders);
  }

  const supabase = supabaseUrl && serviceRoleKey ? createClient(supabaseUrl, serviceRoleKey) : null;
  const totals = {
    discovered: 0,
    parsed: 0,
    inserted: 0,
    updated: 0,
    duplicate: 0,
    uncompared: 0,
    skipped: 0,
    missingEligibility: 0,
    markedInactive: 0,
  };
  const sourceResults: Array<{
    source: string;
    discovered: number;
    parsed: number;
    inserted: number;
    updated: number;
    duplicate: number;
    uncompared: number;
    errors: string[];
  }> = [];
  const recordPreview: Array<{
    source: string;
    source_notification_id: string;
    notification_title: string;
    qualification: string | null;
    degree: string | null;
    stream: string | null;
    age_limit: string | null;
    vacancies: number | null;
    application_start_date: string | null;
    application_last_date: string | null;
    exam_date: string | null;
    official_notification_url: string | null;
  }> = [];
  const errors: string[] = [];
  const today = new Date().toISOString().slice(0, 10);
  let writesPerformed = 0;
  const seenIds = new Set<string>();
  const directSourceResults = new Map<string, { failed: boolean; records: number }>();

  for (const source of options.sources) {
    const shouldSkipFallback = source.fallbackFor
      && !source.fallbackFor.some((name) => {
        const directResult = directSourceResults.get(name);
        return !directResult || directResult.failed || directResult.records === 0;
      });
    if (shouldSkipFallback) {
      sourceResults.push({
        source: source.name,
        discovered: 0,
        parsed: 0,
        inserted: 0,
        updated: 0,
        duplicate: 0,
        uncompared: 0,
        errors: [],
      });
      continue;
    }

    let records: RecruitmentRecord[];
    try {
      records = await source.fetchRecords();
      totals.discovered += records.length;
      if (!source.fallbackFor) {
        const usableRecords = records.filter((record) => Boolean(
          record.exam_name?.trim()
          && record.notification_title?.trim()
          && record.application_last_date
          && [record.qualification, record.degree, record.stream].some((value) => value?.trim())
        ));
        directSourceResults.set(source.name, { failed: false, records: usableRecords.length });
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error(`[${options.source}] ${source.name} discovery failed: ${message}`);
      if (!source.fallbackFor) {
        directSourceResults.set(source.name, { failed: true, records: 0 });
      }
      sourceResults.push({
        source: source.name,
        discovered: 0,
        parsed: 0,
        inserted: 0,
        updated: 0,
        duplicate: 0,
        uncompared: 0,
        errors: [message],
      });
      errors.push(`${source.name}: ${message}`);
      continue;
    }

    let parsed = 0;
    let inserted = 0;
    let updated = 0;
    let duplicate = 0;
    let uncompared = 0;
    const sourceErrors: string[] = [];
    for (const record of records) {
      const id = record.source_notification_id?.trim();
      if (!id || !record.notification_title?.trim() || !record.exam_name?.trim()) {
        totals.skipped++;
        sourceErrors.push(`Skipped ${id || "an unidentified notice"}: missing exam name or notification title.`);
        continue;
      }
      if (!record.application_last_date || ![record.qualification, record.degree, record.stream].some((value) => value?.trim())) {
        totals.skipped++;
        sourceErrors.push(`Skipped ${id}: required qualification or last application date could not be verified from the official notice.`);
        continue;
      }
      if (seenIds.has(id)) {
        totals.duplicate++;
        duplicate++;
        continue;
      }
      seenIds.add(id);
      parsed++;
      if (dryRun) {
        recordPreview.push({
          source: source.name,
          source_notification_id: id,
          notification_title: record.notification_title,
          qualification: record.qualification,
          degree: record.degree,
          stream: record.stream,
          age_limit: record.age_limit,
          vacancies: record.vacancies,
          application_start_date: record.application_start_date,
          application_last_date: record.application_last_date,
          exam_date: record.exam_date,
          official_notification_url: record.official_notification_url,
        });
      }
      try {
        let existing: Record<string, unknown> | null = null;
        if (supabase) {
          const { data, error: lookupError } = await supabase
            .from("exam_notifications")
            .select("*")
            .eq("source", options.source)
            .eq("source_notification_id", id)
            .maybeSingle();
          if (lookupError) {
            totals.skipped++;
            sourceErrors.push(`Could not check existing ${id}: ${lookupError.message}`);
            continue;
          }
          existing = data as Record<string, unknown> | null;
        }

        const existingEndDate = typeof existing?.application_last_date === "string"
          ? existing.application_last_date
          : null;
        const endDate = record.application_last_date || existingEndDate;
        const verifiedEndDate = parseOfficialDate(endDate);
        const active = verifiedEndDate
          ? verifiedEndDate >= today
          : (existing?.is_active as boolean | undefined) ?? true;
        if (!active) totals.markedInactive++;

        const merged: Record<string, unknown> = {
          category: options.category,
          exam_name: record.exam_name || existing?.exam_name,
          organization: record.organization || existing?.organization,
          notification_title: record.notification_title || existing?.notification_title,
          description: record.description || existing?.description || null,
          qualification: record.qualification || existing?.qualification || null,
          degree: record.degree || existing?.degree || null,
          stream: record.stream || existing?.stream || null,
          age_limit: record.age_limit || existing?.age_limit || null,
          vacancies: record.vacancies ?? existing?.vacancies ?? null,
          application_start_date: record.application_start_date || existing?.application_start_date || null,
          application_last_date: record.application_last_date || existing?.application_last_date || null,
          exam_date: record.exam_date || existing?.exam_date || null,
          official_notification_url: record.official_notification_url || existing?.official_notification_url || null,
          official_website_url: record.official_website_url || existing?.official_website_url || options.officialWebsiteUrl,
          is_active: active,
          source: options.source,
          source_notification_id: id,
          created_at: existing?.created_at || new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };

        if (dryRun) {
          if (!supabase) {
            totals.uncompared++;
            uncompared++;
          } else if (!existing) {
            inserted++;
          } else {
            const changed = Object.entries(merged).some(([key, value]) =>
              key !== "created_at" && key !== "updated_at" && (existing?.[key] ?? null) !== (value ?? null)
            );
            if (changed) updated++;
            else duplicate++;
          }
        } else {
          if (!supabase) throw new Error("Supabase client is unavailable for a write request.");
          const { error: writeError } = await supabase
            .from("exam_notifications")
            .upsert(merged, { onConflict: "source,source_notification_id" });
          if (writeError) {
            totals.skipped++;
            sourceErrors.push(`Could not upsert ${id}: ${writeError.message}`);
            continue;
          }
          if (existing) updated++;
          else inserted++;
          writesPerformed++;
        }

        if (![merged.qualification, merged.degree, merged.stream, merged.age_limit].some(Boolean)) {
          totals.missingEligibility++;
        }
      } catch (error) {
        totals.skipped++;
        const message = error instanceof Error ? error.message : String(error);
        sourceErrors.push(`Could not process ${id}: ${message}`);
      }
    }
    totals.parsed += parsed;
    totals.inserted += inserted;
    totals.updated += updated;
    totals.duplicate += duplicate;
    sourceResults.push({
      source: source.name,
      discovered: records.length,
      parsed,
      inserted,
      updated,
      duplicate,
      uncompared,
      errors: sourceErrors,
    });
    errors.push(...sourceErrors.map((message) => `${source.name}: ${message}`));
  }

  const successfulSources = sourceResults.filter((result) => result.errors.length === 0).length;
  console.log(`[${options.source}] ${dryRun ? "dry-run" : "sync"} completed`, JSON.stringify({ ...totals, sources: sourceResults, errors: errors.length }));
  return jsonResponse({
    success: errors.length === 0 || successfulSources > 0,
    partial: errors.length > 0 && successfulSources > 0,
    dry_run: dryRun,
    write_mode: !dryRun,
    writes_performed: writesPerformed,
    database_comparison: dryRun ? (supabase ? "read_only" : "unavailable_no_credentials") : "not_applicable",
    source: options.source,
    category: options.category,
    ...totals,
    sources: sourceResults,
    errors,
    ...(dryRun ? { record_preview: recordPreview } : {}),
  }, successfulSources > 0 || errors.length === 0 ? 200 : 502, corsHeaders);
}

function jsonResponse(body: unknown, status: number, corsHeaders: Record<string, string>): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
