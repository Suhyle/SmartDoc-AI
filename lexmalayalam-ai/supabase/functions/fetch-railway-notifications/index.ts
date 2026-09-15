import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import {
  extractApplicationDates,
  extractOfficialPdfFactsFromText,
  fetchOfficialPdfText,
  fetchOfficialText,
  makeRecord,
  parseAnchors,
  searchOfficialDocuments,
  stripHtml,
  type RecruitmentRecord,
  runRecruitmentSync,
} from "../_shared/recruitment.ts";
import { normalizeCenNumber, parseRailwayNotification } from "./parser.ts";

const RRB_APPLY_HOSTS = ["rrbapply.gov.in", "www.rrbapply.gov.in"];
const RRB_REGIONAL_HOSTS = ["rrb.indianrailways.gov.in"];
const RRB_HOSTS = [...RRB_APPLY_HOSTS, ...RRB_REGIONAL_HOSTS];
const RRB_APPLY_HOME = "https://www.rrbapply.gov.in";
const RRB_DIRECTORY = "https://rrb.indianrailways.gov.in/";
const CEN_LINK_CATEGORIES = new Set(["notification"]);

serve((req) => runRecruitmentSync(req, {
  category: "Railway",
  source: "Railway",
  officialWebsiteUrl: RRB_DIRECTORY,
  sources: [
    {
      name: "Centralized RRB recruitment portal",
      async fetchRecords() {
        const { text, finalUrl } = await fetchOfficialText(RRB_APPLY_HOME, RRB_APPLY_HOSTS);
        const candidates = collectCenCandidates(text, finalUrl, RRB_APPLY_HOSTS);
        const { records } = await parseCenCandidates(candidates);
        if (!records.length) {
          throw new Error("The official RRB Apply page exposed no verifiable CEN notification PDF links.");
        }
        return records;
      },
    },
    {
      name: "Official regional RRB directory",
      async fetchRecords() {
        const { text, finalUrl } = await fetchOfficialText(RRB_DIRECTORY, RRB_REGIONAL_HOSTS);
        if (!/Government of India|Ministry of Railways/i.test(stripHtml(text))) {
          throw new Error("The regional RRB directory did not verify its Ministry of Railways identity.");
        }
        const regionalPages = parseAnchors(text, finalUrl, RRB_REGIONAL_HOSTS)
          .filter((anchor) => /^RRB\s+/i.test(anchor.text))
          .map((anchor) => {
            const path = new URL(anchor.href).pathname;
            const match = /^\/([a-z-]+)(?:\/header\/overview)?\/?$/i.exec(path);
            return match ? { name: anchor.text, slug: match[1].toLowerCase() } : null;
          })
          .filter((region): region is { name: string; slug: string } => region !== null);
        const uniqueRegions = [...new Map(regionalPages.map((region) => [region.slug, region])).values()];
        const candidates = new Map<string, string[]>();

        for (const region of uniqueRegions) {
          try {
            const regionUrl = new URL(`/${region.slug}`, finalUrl).toString();
            const page = await fetchOfficialText(regionUrl, RRB_REGIONAL_HOSTS);
            if (!/Railway Recruitment Board|Ministry of Railways/i.test(stripHtml(page.text))) {
              console.warn(`[Railway] Regional page identity could not be verified; skipped ${region.name}: ${regionUrl}`);
              continue;
            }
            addCenCandidates(candidates, collectCenCandidates(page.text, page.finalUrl, RRB_REGIONAL_HOSTS));
          } catch (error) {
            console.warn(`[Railway] Official regional page failed independently: ${region.name}`, error);
          }
        }

        if (!candidates.size) {
          throw new Error(`The verified regional RRB directory listed ${uniqueRegions.length} boards, but their accessible pages exposed no CEN notification links.`);
        }
        const { records, errors } = await parseCenCandidates(candidates);
        if (!records.length) {
          const details = errors.slice(0, 3).join(" | ");
          throw new Error(`Official regional RRB pages exposed ${candidates.size} CEN notification link(s), but none returned verifiable official PDF bytes.${details ? ` Candidate failures: ${details}` : ""}`);
        }
        return records;
      },
    },
    {
      name: "Railway official-domain search fallback",
      fallbackFor: ["Centralized RRB recruitment portal", "Official regional RRB directory"],
      async fetchRecords() {
        const year = new Date().getUTCFullYear();
        const { results, rejected } = await searchOfficialDocuments(
          `site:rrb.indianrailways.gov.in CEN railway recruitment notification ${year} PDF`,
          RRB_HOSTS,
        );
        console.info(`[Railway] Official search discovery returned ${results.length} approved-domain candidate(s); rejected ${rejected} non-HTTPS or non-official result(s).`);
        const candidates = new Map<string, string[]>();
        for (const result of results) {
          const url = new URL(result.link);
          const cenInUrl = normalizeCenNumber(`${url.pathname} ${url.searchParams.get("cennum") || ""}`);
          if (/\.pdf$/i.test(url.pathname) && cenInUrl) {
            addCenCandidates(candidates, new Map([[cenInUrl, [url.toString()]]]));
            continue;
          }
          if (url.searchParams.get("category")?.toLowerCase() === "notification" && cenInUrl) {
            addCenCandidates(candidates, new Map([[cenInUrl, [url.toString()]]]));
            continue;
          }
          try {
            const { text, finalUrl } = await fetchOfficialText(url.toString(), RRB_HOSTS);
            if (/request rejected|human verification|captcha|access denied/i.test(stripHtml(text))) continue;
            addCenCandidates(candidates, collectCenCandidates(text, finalUrl, RRB_HOSTS));
          } catch (error) {
            console.warn(`[Railway] Official search candidate could not be verified: ${url}`, error);
          }
        }
        const { records } = await parseCenCandidates(candidates);
        if (!records.length) throw new Error("Official Railway search found no verifiable CEN notification PDFs.");
        return records;
      },
    },
  ],
}));

function collectCenCandidates(html: string, baseUrl: string, allowedHosts: string[]): Map<string, string[]> {
  const candidates = new Map<string, string[]>();
  for (const anchor of parseAnchors(html, baseUrl, allowedHosts)) {
    const url = new URL(anchor.href);
    const category = url.searchParams.get("category")?.toLowerCase();
    if (category && !CEN_LINK_CATEGORIES.has(category)) continue;
    const context = stripHtml(html.slice(Math.max(0, anchor.start - 1200), Math.min(html.length, anchor.end + 300)));
    const cenNumber = normalizeCenNumber(url.searchParams.get("cennum"))
      || normalizeCenNumber(`${anchor.text} ${anchor.href} ${context}`);
    if (!cenNumber) continue;
    const isPdf = /\.pdf(?:$|[?#])/i.test(url.pathname);
    const isNotificationLink = category === "notification"
      || /CEN|notification|employment notice/i.test(`${anchor.text} ${anchor.href}`);
    if (!isPdf && !isNotificationLink) continue;
    const existing = candidates.get(cenNumber) || [];
    if (!existing.includes(anchor.href) && existing.length < 4) existing.push(anchor.href);
    candidates.set(cenNumber, existing);
  }
  return candidates;
}

function addCenCandidates(target: Map<string, string[]>, incoming: Map<string, string[]>): void {
  for (const [cenNumber, urls] of incoming) {
    const existing = target.get(cenNumber) || [];
    for (const url of urls) {
      if (!existing.includes(url) && existing.length < 4) existing.push(url);
    }
    target.set(cenNumber, existing);
  }
}

async function parseCenCandidates(candidates: Map<string, string[]>): Promise<{
  records: RecruitmentRecord[];
  errors: string[];
}> {
  const records: RecruitmentRecord[] = [];
  const errors: string[] = [];
  const currentYear = new Date().getUTCFullYear();
  for (const [expectedCen, urls] of [...candidates].slice(0, 10)) {
    const cenYear = Number(expectedCen.split("/")[1]);
    if (Number.isInteger(cenYear) && cenYear < currentYear) continue;
    let record: RecruitmentRecord | null = null;
    for (const candidateUrl of urls) {
      try {
        let pdfUrls: string[];
        if (/\.pdf(?:$|[?#])/i.test(new URL(candidateUrl).pathname)) {
          pdfUrls = [candidateUrl];
        } else {
          const detail = await fetchOfficialText(candidateUrl, RRB_HOSTS);
          pdfUrls = parseAnchors(detail.text, detail.finalUrl, RRB_HOSTS)
            .filter((anchor) => /\.pdf(?:$|[?#])/i.test(new URL(anchor.href).pathname))
            .map((anchor) => anchor.href);
        }
        if (!pdfUrls.length) throw new Error('Official CEN detail page exposed no PDF link.');
        for (const pdfUrl of pdfUrls.slice(0, 2)) {
          const pdfText = await fetchOfficialPdfText(pdfUrl, RRB_HOSTS);
          const metadata = parseRailwayNotification(pdfText);
          if (!metadata || metadata.cenNumber !== expectedCen) {
            throw new Error(`Official PDF content did not verify expected CEN ${expectedCen}.`);
          }
          const facts = extractOfficialPdfFactsFromText(pdfText);
          const dates = extractApplicationDates(pdfText);
          record = makeRecord({
            sourceId: `CEN:${metadata.cenNumber}`,
            officialWebsiteUrl: RRB_DIRECTORY,
            notificationUrl: pdfUrl,
            title: metadata.title,
            examName: metadata.title,
            organization: "Railway Recruitment Board",
            ...facts,
            ...dates,
          });
          break;
        }
        if (record) break;
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        errors.push(`${expectedCen} at ${candidateUrl}: ${message}`);
        console.warn(`[Railway] CEN candidate rejected independently: ${candidateUrl}: ${message}`);
      }
    }
    if (record) records.push(record);
  }
  const uniqueRecords = [...new Map(records.map((record) => [record.source_notification_id, record])).values()];
  if (!uniqueRecords.length && errors.length) {
    console.info(`[Railway] No CEN documents verified. Candidate failures: ${errors.slice(0, 4).join(" | ")}`);
  }
  return { records: uniqueRecords, errors };
}
