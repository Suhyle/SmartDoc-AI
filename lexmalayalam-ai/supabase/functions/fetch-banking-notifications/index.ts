import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import {
  decodeHtml,
  extractApplicationDates,
  extractOfficialPdfFactsFromText,
  fetchOfficialPdfText,
  fetchOfficialText,
  makeRecord,
  parseAnchors,
  readOfficialPdfFacts,
  searchOfficialDocuments,
  stripHtml,
  type RecruitmentRecord,
  runRecruitmentSync,
} from "../_shared/recruitment.ts";
import { parseIbpsNotificationText, parseIbpsRegistrationDetails } from "./ibpsParser.ts";

const IBPS_HOSTS = ["www.ibps.in", "ibps.in", "ibpsreg.ibps.in"];
const SBI_HOSTS = ["sbi.bank.in", "recruitment.sbi.bank.in"];
const RBI_HOSTS = ["opportunities.rbi.org.in", "www.rbi.org.in", "rbidocs.rbi.org.in"];
const SBI_URL = "https://sbi.bank.in/web/careers/current-openings";
const IBPS_CYCLE_URLS = [
  { name: "IBPS CSA official cycle listing", url: "https://www.ibps.in/index.php/clerical-cadre-xvi/" },
  { name: "IBPS RRB official cycle listing", url: "https://www.ibps.in/index.php/rural-bank-xv/" },
  { name: "IBPS PO/MT official cycle listing", url: "https://www.ibps.in/index.php/management-trainees-xvi/" },
  { name: "IBPS Specialist Officer official cycle listing", url: "https://www.ibps.in/index.php/specialist-officers-xvi/" },
];
const IBPS_REGISTRATION_URL = "https://ibpsreg.ibps.in/csaxvijul26/";
const RBI_URL = "https://opportunities.rbi.org.in/Scripts/Vacancies.aspx";
const RBI_RECRUITMENT_URL = "https://www.rbi.org.in/Scripts/bs_viewcontent.aspx?Id=2802";

serve((req) => runRecruitmentSync(req, {
  category: "Banking",
  source: "Banking",
  officialWebsiteUrl: "https://sbi.bank.in/web/careers/current-openings",
  sources: [
    { name: "SBI careers", fetchRecords: fetchSbiRecords },
    ...IBPS_CYCLE_URLS.map(({ name, url }) => ({
      name,
      fetchRecords: () => fetchIbpsRecords(url),
    })),
    { name: "IBPS official registration page", fetchRecords: fetchIbpsRegistrationRecords },
    {
      name: "IBPS official-domain search fallback",
      fallbackFor: [...IBPS_CYCLE_URLS.map(({ name }) => name), "IBPS official registration page"],
      fetchRecords: fetchIbpsSearchRecords,
    },
    { name: "RBI vacancies", fetchRecords: fetchRbiRecords },
    { name: "RBI official recruitment index", fetchRecords: fetchRbiAnnouncementRecords },
    {
      name: "RBI official-domain search fallback",
      fallbackFor: ["RBI vacancies", "RBI official recruitment index"],
      fetchRecords: fetchRbiSearchRecords,
    },
  ],
}));

async function fetchSbiRecords(): Promise<RecruitmentRecord[]> {
  const { text, finalUrl } = await fetchOfficialText(SBI_URL, SBI_HOSTS);
  const anchors = parseAnchors(text, finalUrl, SBI_HOSTS);
  const records: RecruitmentRecord[] = [];

  for (const anchor of anchors) {
    if (!/\.pdf(?:\/|$|[?#])/i.test(anchor.href)) continue;
    const listItemStart = text.lastIndexOf("<li", anchor.start);
    const listItemEnd = text.indexOf("</li>", anchor.end);
    if (listItemStart < 0 || listItemEnd < 0) continue;
    const listItem = text.slice(listItemStart, listItemEnd + 5);
    if (!/download\s+advertisement/i.test(stripHtml(listItem))
      || /biodata|undertaking|negotiation|ctc|hindi/i.test(`${anchor.text} ${anchor.href} ${stripHtml(listItem)}`)) continue;

    const cardStart = text.lastIndexOf('<div class="accordion lateral', listItemStart);
    if (cardStart < 0) continue;
    const cardHeader = text.slice(cardStart, listItemStart);
    const dataArticleId = /data-articleid=["']([^"']+)["']/i.exec(text.slice(cardStart, cardStart + 1000))?.[1];
    const adNumber = /advertisement\s*(?:no\.?|number)?\s*[:#-]?\s*([A-Z0-9][A-Z0-9/._-]{3,})/i.exec(stripHtml(cardHeader))?.[1]
      || dataArticleId;
    const headingHtml = /<p\b[^>]*>([\s\S]*?)<\/p>/i.exec(cardHeader)?.[1];
    const title = stripHtml(headingHtml || "");
    if (!adNumber || !title
      || /ADVERTISEMENT\s*NO|selected|shortlisted|result|call\s+letter|admit\s+card/i.test(title)) continue;

    const nextCardStart = text.indexOf('<div class="accordion lateral', cardStart + 1);
    const cardHtml = text.slice(cardStart, nextCardStart < 0 ? text.length : nextCardStart);
    const context = stripHtml(cardHtml);
    const dates = extractApplicationDates(`${context} ${title}`);
    const cleanAdNumber = adNumber.replace(/[.,;]+$/, "").toUpperCase();
    const pdfFacts = await readOfficialPdfFacts(anchor.href, SBI_HOSTS, "SBI");
    records.push(makeRecord({
      sourceId: `SBI:${cleanAdNumber}`,
      officialWebsiteUrl: "https://sbi.bank.in/web/careers/current-openings",
      notificationUrl: anchor.href,
      title,
      organization: "State Bank of India",
      ...dates,
      ...pdfFacts,
    }));
  }

  return deduplicate(records);
}

async function fetchIbpsRecords(listingUrl: string): Promise<RecruitmentRecord[]> {
  let text: string;
  let finalUrl: string;
  try {
    ({ text, finalUrl } = await fetchOfficialText(listingUrl, IBPS_HOSTS));
  } catch (error) {
    const cause = error instanceof Error && error.cause instanceof Error ? error.cause.message : null;
    if (cause) throw new Error(`Official IBPS cycle page could not be fetched by this runtime: ${cause}`);
    throw error;
  }
  const candidates = new Map<string, string>();
  for (const anchor of parseAnchors(text, finalUrl, IBPS_HOSTS)) {
    if (!/\.pdf(?:\/|$|[?#])/i.test(anchor.href)) continue;
    if (!/(?:notification|advert|CRP|CSA|PO|RRB|SPL)/i.test(`${anchor.href} ${anchor.text}`)) continue;
    if (/\b(?:corrigendum|annexure|window notification|result|call letter|admit card|information handout|score\s*card|mock test)\b/i.test(`${anchor.href} ${anchor.text}`)) continue;
    const context = stripHtml(text.slice(Math.max(0, anchor.start - 5000), Math.min(text.length, anchor.end + 500)));
    candidates.set(anchor.href, context);
  }
  return parseIbpsPdfCandidates(candidates);
}

async function fetchIbpsRegistrationRecords(): Promise<RecruitmentRecord[]> {
  const { text, finalUrl } = await fetchOfficialText(IBPS_REGISTRATION_URL, ["ibpsreg.ibps.in"]);
  const titleMarkup = /<title\b[^>]*>([\s\S]*?)<\/title>/i.exec(text)?.[1] || "";
  const title = stripHtml(titleMarkup);
  const details = parseIbpsRegistrationDetails(title, stripHtml(text));
  if (!details) {
    throw new Error("The official IBPS registration page did not expose a verifiable CRP cycle and explicit registration dates.");
  }
  return [makeRecord({
    sourceId: `IBPS:${details.cycle}`,
    officialWebsiteUrl: "https://www.ibps.in/",
    notificationUrl: finalUrl,
    title: details.title,
    examName: details.title,
    organization: "Institute of Banking Personnel Selection",
    application_start_date: details.applicationStartDate,
    application_last_date: details.applicationLastDate,
  })];
}

async function fetchIbpsSearchRecords(): Promise<RecruitmentRecord[]> {
  const year = new Date().getUTCFullYear();
  const { results, rejected } = await searchOfficialDocuments(
    `(site:ibps.in OR site:ibpsreg.ibps.in) IBPS notification common recruitment process ${year} PDF`,
    IBPS_HOSTS,
  );
  console.info(`[IBPS] Official search discovery returned ${results.length} approved-domain candidate(s); rejected ${rejected} non-HTTPS or non-official result(s).`);
  const candidates = new Map<string, string>();
  for (const result of results) {
    const url = new URL(result.link);
    if (/\.pdf$/i.test(url.pathname)) {
      candidates.set(url.toString(), "");
      continue;
    }
    try {
      const { text, finalUrl } = await fetchOfficialText(url.toString(), IBPS_HOSTS);
      if (/human verification|captcha|access denied/i.test(stripHtml(text))) continue;
      for (const anchor of parseAnchors(text, finalUrl, IBPS_HOSTS)) {
        if (/\.pdf(?:$|[?#])/i.test(anchor.href)
          && !/\b(?:corrigendum|annexure|window notification|result|call letter|admit card|information handout|score\s*card)\b/i.test(`${anchor.href} ${anchor.text}`)) {
          const context = stripHtml(text.slice(Math.max(0, anchor.start - 3500), Math.min(text.length, anchor.end + 500)));
          candidates.set(anchor.href, context);
        }
      }
    } catch (error) {
      console.warn(`[IBPS] Official search candidate could not be verified: ${url}`, error);
    }
  }
  return parseIbpsPdfCandidates(candidates);
}

async function parseIbpsPdfCandidates(candidates: Map<string, string>): Promise<RecruitmentRecord[]> {
  const records: RecruitmentRecord[] = [];
  for (const [url, listingContext] of candidates) {
    try {
      const pdfText = await fetchOfficialPdfText(url, IBPS_HOSTS);
      const metadata = parseIbpsNotificationText(pdfText);
      if (!metadata) {
        console.info(`[IBPS] Official PDF rejected because it did not verify a recruitment notification: ${url}`);
        continue;
      }
      const facts = extractOfficialPdfFactsFromText(pdfText);
      const pdfDates = extractApplicationDates(pdfText);
      const listingDates = extractApplicationDates(listingContext);
      records.push(makeRecord({
        sourceId: `IBPS:${metadata.cycle}`,
        officialWebsiteUrl: "https://www.ibps.in/",
        notificationUrl: url,
        title: metadata.title,
        examName: metadata.title,
        organization: "Institute of Banking Personnel Selection",
        ...facts,
        application_start_date: pdfDates.application_start_date || listingDates.application_start_date,
        application_last_date: pdfDates.application_last_date || listingDates.application_last_date,
      }));
    } catch (error) {
      console.warn(`[IBPS] Official notification PDF skipped independently: ${url}`, error);
    }
  }
  const unique = deduplicate(records);
  if (!unique.length) {
    throw new Error("No verifiable IBPS recruitment notification PDF was accessible from the official listing or search results.");
  }
  return unique;
}

async function fetchRbiRecords(): Promise<RecruitmentRecord[]> {
  const { text, finalUrl } = await fetchOfficialText(RBI_URL, RBI_HOSTS);
  if (/human visitor|human verification|captcha/i.test(text)) {
    throw new Error("RBI vacancies page returned an automated-access verification challenge.");
  }

  const listingAnchors = parseAnchors(text, finalUrl, RBI_HOSTS);
  const detailLinks = listingAnchors.filter((anchor) => /bs_viewcontent\.aspx\?Id=\d+/i.test(anchor.href));
  if (detailLinks.length === 0) {
    throw new Error("No RBI vacancy detail links were present in the official listing response.");
  }

  const records: RecruitmentRecord[] = [];
  for (const detail of detailLinks.slice(0, 30)) {
    try {
      const detailPage = await fetchOfficialText(detail.href, RBI_HOSTS);
      const detailText = stripHtml(detailPage.text);
      const pageTitle = /<h[1-3]\b[^>]*>([\s\S]*?)<\/h[1-3]>/i.exec(detailPage.text)?.[1];
      const title = stripHtml(pageTitle || detail.text);
      if (title.length < 8) continue;

      const pdf = parseAnchors(detailPage.text, detailPage.finalUrl, RBI_HOSTS)
        .find((anchor) => /\.pdf(?:\/|$|[?#])/i.test(anchor.href));
      const dates = extractApplicationDates(detailText);
      const id = /[?&]Id=(\d+)/i.exec(detail.href)?.[1];
      if (!id) continue;
      const pdfFacts = pdf ? await readOfficialPdfFacts(pdf.href, RBI_HOSTS, "RBI") : {};

      records.push(makeRecord({
        sourceId: `RBI:${id}`,
        officialWebsiteUrl: "https://opportunities.rbi.org.in/Scripts/Vacancies.aspx",
        notificationUrl: pdf?.href || detail.href,
        title,
        organization: "Reserve Bank of India",
        description: null,
        ...dates,
        ...pdfFacts,
      }));
    } catch (error) {
      console.warn(`[Banking] RBI detail page skipped: ${detail.href}`, error);
    }
  }
  return deduplicate(records);
}

async function fetchRbiAnnouncementRecords(): Promise<RecruitmentRecord[]> {
  const { text, finalUrl } = await fetchOfficialText(RBI_RECRUITMENT_URL, ["www.rbi.org.in"]);
  if (!/Reserve Bank of India/i.test(stripHtml(text))) {
    throw new Error("The official RBI recruitment page did not verify its Reserve Bank of India identity.");
  }
  const candidates = parseRbiPdfAnchors(text, finalUrl);
  if (!candidates.length) {
    throw new Error("The official RBI recruitment page exposed no notification PDF links.");
  }
  const records = await parseRbiPdfCandidates(candidates);
  if (!records.length) {
    throw new Error(`The official RBI recruitment page exposed ${candidates.length} document link(s), but none returned verifiable HTTPS RBI PDF bytes.`);
  }
  return records;
}

async function fetchRbiSearchRecords(): Promise<RecruitmentRecord[]> {
  const year = new Date().getUTCFullYear();
  const { results, rejected } = await searchOfficialDocuments(
    `(site:rbi.org.in OR site:rbidocs.rbi.org.in OR site:opportunities.rbi.org.in) RBI recruitment notification ${year} PDF`,
    RBI_HOSTS,
  );
  console.info(`[RBI] Official search discovery returned ${results.length} approved-domain candidate(s); rejected ${rejected} non-HTTPS or non-official result(s).`);
  const candidates: Array<{ url: string; title: string }> = [];
  for (const result of results) {
    const url = new URL(result.link);
    if (/\.pdf$/i.test(url.pathname)) {
      candidates.push({ url: url.toString(), title: "" });
      continue;
    }
    try {
      const { text, finalUrl } = await fetchOfficialText(url.toString(), RBI_HOSTS);
      if (/human verification|captcha|access denied/i.test(stripHtml(text))) continue;
      candidates.push(...parseRbiPdfAnchors(text, finalUrl));
    } catch (error) {
      console.warn(`[RBI] Official search candidate could not be verified: ${url}`, error);
    }
  }
  const records = await parseRbiPdfCandidates(candidates);
  if (!records.length) throw new Error("Official RBI search found no verifiable recruitment notification PDFs.");
  return records;
}

function parseRbiPdfAnchors(html: string, baseUrl: string): Array<{ url: string; title: string }> {
  const candidates: Array<{ url: string; title: string }> = [];
  const pattern = /<a\b([^>]*?)href\s*=\s*(["'])(.*?)\2([^>]*)>([\s\S]*?)<\/a\s*>/gi;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(html)) !== null) {
    try {
      const url = new URL(decodeHtml(match[3].trim()), baseUrl);
      if (!RBI_HOSTS.includes(url.hostname.toLowerCase())) continue;
      if (!/^https?:$/.test(url.protocol) || !/\.pdf(?:$|[?#])/i.test(url.pathname)) continue;
      if (url.protocol === "http:") {
        if (url.hostname.toLowerCase() !== "rbidocs.rbi.org.in") continue;
        url.protocol = "https:";
      }
      const title = stripHtml(match[5]);
      if (!title || /\b(?:result|score\s*card|marksheet|admit\s+card|call\s+letter|corrigendum|answer\s+key)\b/i.test(title)) continue;
      candidates.push({ url: url.toString(), title });
    } catch {
      continue;
    }
  }
  return [...new Map(candidates.map((candidate) => [candidate.url, candidate])).values()];
}

async function parseRbiPdfCandidates(candidates: Array<{ url: string; title: string }>): Promise<RecruitmentRecord[]> {
  const records: RecruitmentRecord[] = [];
  for (const candidate of candidates.slice(0, 30)) {
    try {
      const pdfText = await fetchOfficialPdfText(candidate.url, RBI_HOSTS);
      if (!/Reserve Bank of India/i.test(pdfText.slice(0, 12000))
        || !/\b(?:recruitment|vacancy|advertisement|application)\b/i.test(pdfText.slice(0, 24000))) {
        console.info(`[RBI] Official PDF rejected because its contents did not verify a recruitment notice: ${candidate.url}`);
        continue;
      }
      const facts = extractOfficialPdfFactsFromText(pdfText);
      const dates = extractApplicationDates(pdfText);
      const id = /(?:advertisement|notification)\s*(?:no\.?|number)?\s*[:#-]?\s*([A-Z0-9][A-Z0-9./-]*\d[A-Z0-9./-]*)/i.exec(pdfText.slice(0, 16000))?.[1];
      records.push(makeRecord({
        sourceId: `RBI:${id?.toUpperCase() || new URL(candidate.url).pathname}`,
        officialWebsiteUrl: RBI_RECRUITMENT_URL,
        notificationUrl: candidate.url,
        title: candidate.title,
        organization: "Reserve Bank of India",
        ...facts,
        ...dates,
      }));
    } catch (error) {
      console.warn(`[RBI] Official recruitment PDF skipped independently: ${candidate.url}`, error);
    }
  }
  return deduplicate(records);
}

function deduplicate(records: RecruitmentRecord[]): RecruitmentRecord[] {
  const unique = new Map<string, RecruitmentRecord>();
  for (const record of records) {
    if (!unique.has(record.source_notification_id)) unique.set(record.source_notification_id, record);
  }
  return [...unique.values()];
}
