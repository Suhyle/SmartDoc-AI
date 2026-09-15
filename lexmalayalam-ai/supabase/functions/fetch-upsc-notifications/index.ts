import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import {
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
import { extractUpscExamDate, parseUpscNotification } from "./parser.ts";

const UPSC_HOSTS = ["upsc.gov.in", "www.upsc.gov.in"];
const UPSC_HOME = "https://www.upsc.gov.in";
const ACTIVE_EXAMS_URL = `${UPSC_HOME}/examinations/active-exams`;
const NOTIFICATIONS_URL = `${UPSC_HOME}/examinations/exam-notifications`;
const ARCHIVE_URL = `${UPSC_HOME}/exams-related-info/exam-notification/archives`;
const RECRUITMENT_URL = `${UPSC_HOME}/recruitment/recruitment-advertisement`;
const UPSC_LISTING_PATHS = new Set([
  "/examinations/active-exams",
  "/examinations/exam-notifications",
  "/examinations/exam-calendar",
  "/examinations/forthcoming-exams",
  "/examinations/previous-question-papers",
  "/exams-related-info/exam-notification/archives",
  "/recruitment/recruitment-advertisement",
]);

serve((req) => runRecruitmentSync(req, {
  category: "UPSC",
  source: "UPSC",
  officialWebsiteUrl: UPSC_HOME,
  sources: [
    {
      name: "UPSC active examinations",
      async fetchRecords() {
        const { text, finalUrl } = await fetchOfficialText(ACTIVE_EXAMS_URL, UPSC_HOSTS);
        const detailLinks = parseAnchors(text, finalUrl, UPSC_HOSTS).filter((anchor) => {
          const path = new URL(anchor.href).pathname.toLowerCase();
          return path.startsWith("/examinations/") && !UPSC_LISTING_PATHS.has(path)
            && anchor.text.length >= 10 && /examination|services|academy|recruitment/i.test(anchor.text);
        });

        const records: RecruitmentRecord[] = [];
        // The active-exams page is ordered with current examinations first.
        // Bound PDF work so a single demo refresh stays within Edge limits.
        for (const examLink of deduplicateLinks(detailLinks).slice(0, 3)) {
          try {
            const detail = await fetchOfficialText(examLink.href, UPSC_HOSTS);
            const detailText = stripHtml(detail.text);
            if (/enable JavaScript to visit|javascript is required|human verification|captcha/i.test(detailText)) {
              console.warn(`[UPSC] Examination detail skipped because the official page returned an access challenge: ${examLink.href}`);
              continue;
            }
            const heading = /<h1\b[^>]*>([\s\S]*?)<\/h1>/i.exec(detail.text)?.[1];
            const title = stripHtml(heading || examLink.text);
            const pdf = parseAnchors(detail.text, detail.finalUrl, UPSC_HOSTS)
              .find((anchor) => /\.pdf(?:\/|$|[?#])/i.test(anchor.href)
                && /notification|examination|advertisement|notice/i.test(`${anchor.text} ${anchor.href}`));
            const noticeNumber = /(?:notification|advertisement|notice)\s*(?:no\.?|number)?\s*[:#-]?\s*([A-Z0-9][A-Z0-9/-]*\d[A-Z0-9/-]*)/i.exec(detailText)?.[1];
            const url = new URL(examLink.href);
            const dates = extractApplicationDates(detailText);
            const pdfFacts = pdf ? await readOfficialPdfFacts(pdf.href, UPSC_HOSTS, "UPSC") : {};
            records.push(makeRecord({
              sourceId: noticeNumber
                ? `UPSC:${noticeNumber.toUpperCase()}`
                : `UPSC:${url.pathname}${url.search}`,
              officialWebsiteUrl: UPSC_HOME,
              notificationUrl: pdf?.href || examLink.href,
              title,
              examName: examLink.text,
              organization: "Union Public Service Commission",
              ...dates,
              ...pdfFacts,
            }));
          } catch (error) {
            console.warn(`[UPSC] Examination detail skipped: ${examLink.href}`, error);
          }
        }
        const uniqueRecords = deduplicate(records);
        if (uniqueRecords.length === 0) {
          throw new Error("UPSC active examination detail pages were inaccessible or exposed no verifiable notice records.");
        }
        return uniqueRecords;
      },
    },
    {
      name: "UPSC examination notifications",
      async fetchRecords() {
        const records = await fetchPdfNotices(NOTIFICATIONS_URL, "examination notification");
        return records;
      },
    },
    {
      name: "UPSC examination notification archive",
      async fetchRecords() {
        const records = await fetchVerifiedPdfNotices(ARCHIVE_URL);
        return records;
      },
    },
    {
      name: "UPSC recruitment advertisements",
      async fetchRecords() {
        const records = await fetchPdfNotices(RECRUITMENT_URL, "recruitment advertisement");
        return records;
      },
    },
    {
      name: "UPSC official-domain search fallback",
      fallbackFor: [
        "UPSC active examinations",
        "UPSC examination notifications",
        "UPSC examination notification archive",
        "UPSC recruitment advertisements",
      ],
      async fetchRecords() {
        const year = new Date().getUTCFullYear();
        const { results, rejected } = await searchOfficialDocuments(
          `site:upsc.gov.in ("examination notice" OR "recruitment advertisement") ${year} PDF`,
          UPSC_HOSTS,
        );
        console.info(`[UPSC] Official search discovery returned ${results.length} approved-domain candidate(s); rejected ${rejected} non-HTTPS or non-official result(s).`);
        const candidates = new Map<string, string>();
        for (const result of results) {
          const url = new URL(result.link);
          if (/\.pdf$/i.test(url.pathname)) {
            candidates.set(url.toString(), "");
            continue;
          }
          try {
            const { text, finalUrl } = await fetchOfficialText(url.toString(), UPSC_HOSTS);
            if (/human verification|captcha|access denied/i.test(stripHtml(text))) continue;
            for (const anchor of parseAnchors(text, finalUrl, UPSC_HOSTS)) {
              if (/\.pdf(?:$|[?#])/i.test(anchor.href)) candidates.set(anchor.href, anchor.text);
            }
          } catch (error) {
            console.warn(`[UPSC] Official search candidate could not be verified: ${url}`, error);
          }
        }
        const records = await parseVerifiedPdfCandidates(candidates);
        if (!records.length) throw new Error("UPSC official search found no verifiable examination or recruitment notification PDFs.");
        return records;
      },
    },
  ],
}));

async function fetchVerifiedPdfNotices(url: string): Promise<RecruitmentRecord[]> {
  const { text, finalUrl } = await fetchOfficialText(url, UPSC_HOSTS);
  const candidates = new Map<string, string>();
  for (const anchor of parseAnchors(text, finalUrl, UPSC_HOSTS)) {
    if (!/\.pdf(?:\/|$|[?#])/i.test(anchor.href)) continue;
    const context = stripHtml(text.slice(Math.max(0, anchor.start - 1600), Math.min(text.length, anchor.end + 500)));
    if (/\b(?:result|admit\s+card|answer\s+key|question\s+paper|press\s+note)\b/i.test(`${anchor.text} ${context}`)) continue;
    candidates.set(anchor.href, context);
  }
  const records = await parseVerifiedPdfCandidates(candidates);
  if (!records.length) {
    throw new Error("The official UPSC archive exposed no PDFs whose contents verified an examination or recruitment notification.");
  }
  return records;
}

async function parseVerifiedPdfCandidates(candidates: Map<string, string>): Promise<RecruitmentRecord[]> {
  const records: RecruitmentRecord[] = [];
  for (const [url, listingContext] of [...candidates].slice(0, 4)) {
    try {
      const pdfText = await fetchOfficialPdfText(url, UPSC_HOSTS);
      const metadata = parseUpscNotification(pdfText);
      if (!metadata) {
        console.info(`[UPSC] Official PDF rejected because it was not a verified notification: ${url}`);
        continue;
      }
      const facts = extractOfficialPdfFactsFromText(pdfText);
      const pdfDates = extractApplicationDates(pdfText);
      const listingDates = extractApplicationDates(listingContext);
      const examDate = extractUpscExamDate(pdfText) || extractUpscExamDate(listingContext);
      const path = new URL(url).pathname;
      records.push(makeRecord({
        sourceId: metadata.identifier
          ? `UPSC:${metadata.identifier.toUpperCase()}`
          : `UPSC:${path}`,
        officialWebsiteUrl: UPSC_HOME,
        notificationUrl: url,
        title: metadata.title,
        examName: metadata.title,
        organization: "Union Public Service Commission",
        ...facts,
        application_start_date: pdfDates.application_start_date || listingDates.application_start_date,
        application_last_date: pdfDates.application_last_date || listingDates.application_last_date,
        exam_date: examDate,
      }));
    } catch (error) {
      console.warn(`[UPSC] Official notification PDF skipped independently: ${url}`, error);
    }
  }
  return deduplicate(records);
}

async function fetchPdfNotices(url: string, label: string): Promise<RecruitmentRecord[]> {
  const { text, finalUrl } = await fetchOfficialText(url, UPSC_HOSTS);
  const records: RecruitmentRecord[] = [];
  for (const anchor of parseAnchors(text, finalUrl, UPSC_HOSTS)) {
    if (records.length >= 4) break;
    if (!/\.pdf(?:\/|$|[?#])/i.test(anchor.href)) continue;
    const context = stripHtml(text.slice(Math.max(0, anchor.start - 1600), Math.min(text.length, anchor.end + 500)));
    if (/\b(?:result|admit\s+card|answer\s+key|question\s+paper|press\s+note)\b/i.test(`${anchor.text} ${context}`)) continue;
    const adNo = /(?:advertisement|notification)\s*(?:no\.?|number)?\s*[:#-]?\s*([A-Z0-9][A-Z0-9/-]*\d[A-Z0-9/-]*)/i.exec(context)?.[1];
    const genericLinkText = /^(?:english|hindi|download|click here|view|view\/download|\(?\d+(?:\.\d+)?\s*(?:kb|mb|gb)\)?)$/i.test(anchor.text);
    if (!adNo && (!anchor.text || genericLinkText)) continue;
    const title = !genericLinkText && anchor.text
      ? anchor.text
      : `UPSC ${label}${adNo ? ` No. ${adNo}` : ""}`;
    const dates = extractApplicationDates(context);
    const pdfFacts = await readOfficialPdfFacts(anchor.href, UPSC_HOSTS, "UPSC");
    const sourceId = adNo && /\d{4}/.test(adNo)
      ? `UPSC:${adNo.toUpperCase()}`
      : `UPSC:${new URL(anchor.href).pathname}`;
    records.push(makeRecord({
      sourceId,
      officialWebsiteUrl: UPSC_HOME,
      notificationUrl: anchor.href,
      title,
      organization: "Union Public Service Commission",
      ...dates,
      ...pdfFacts,
    }));
  }
  if (records.length === 0) {
    throw new Error(`The official UPSC ${label} listing exposed no PDF with a verifiable advertisement or notification number.`);
  }
  return deduplicate(records);
}

function deduplicateLinks<T extends { href: string }>(links: T[]): T[] {
  return [...new Map(links.map((link) => [link.href, link])).values()];
}

function deduplicate(records: RecruitmentRecord[]): RecruitmentRecord[] {
  const unique = new Map<string, RecruitmentRecord>();
  for (const record of records) {
    if (!unique.has(record.source_notification_id)) unique.set(record.source_notification_id, record);
  }
  return [...unique.values()];
}
