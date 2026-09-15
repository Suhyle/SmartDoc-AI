import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import {
  extractOfficialPdfFactsFromText,
  extractApplicationDates,
  fetchOfficialPdfText,
  fetchOfficialText,
  makeRecord,
  parseAnchors,
  searchOfficialDocuments,
  stripHtml,
  type RecruitmentRecord,
  runRecruitmentSync,
} from "../_shared/recruitment.ts";
import { parseSscNotification } from "./parser.ts";

const SSC_HOSTS = ["ssc.gov.in"];
const SSC_HOME = "https://ssc.gov.in";
const SSC_NOTICE_API = `${SSC_HOME}/api/general-website/portal/notice-boards`;
const SSC_NOTICE_PAGE = `${SSC_HOME}/`;

serve((req) => runRecruitmentSync(req, {
  category: "SSC",
  source: "SSC",
  officialWebsiteUrl: SSC_HOME,
  sources: [
    {
      name: "SSC direct notice board",
      async fetchRecords() {
        const { text } = await fetchOfficialText(SSC_NOTICE_API, SSC_HOSTS);
        let payload: unknown;
        try {
          payload = JSON.parse(text);
        } catch {
          throw new Error("SSC notice API returned a non-JSON response; no records were ingested.");
        }

        const response = payload as { statusCode?: string; statusMessage?: string; error?: string };
        if (response.statusCode && response.statusCode !== "200") {
          throw new Error(`SSC notice API ${response.statusCode}: ${response.error || response.statusMessage || "request rejected"}. Its query contract is not currently known; refusing to guess parameters.`);
        }
        throw new Error("SSC notice API response shape has not been verified. Refusing to guess its fields or create records.");
      },
    },
    {
      name: "SSC official-domain search fallback",
      fallbackFor: ["SSC direct notice board"],
      async fetchRecords() {
        const year = new Date().getUTCFullYear();
        const pdfCandidates = new Map<string, string>();
        try {
          const { text, finalUrl } = await fetchOfficialText(SSC_NOTICE_PAGE, SSC_HOSTS);
          for (const anchor of parseAnchors(text, finalUrl, SSC_HOSTS)) {
            if (/\.pdf(?:$|[?#])/i.test(anchor.href)) pdfCandidates.set(anchor.href, anchor.text);
          }
        } catch (error) {
          console.warn(`[SSC] Direct official noticeboard page could not be parsed: ${SSC_NOTICE_PAGE}`, error);
        }

        if (!pdfCandidates.size) {
          const { results, rejected } = await searchOfficialDocuments(
            `site:ssc.gov.in SSC notification examination recruitment ${year} PDF`,
            SSC_HOSTS,
          );
          console.info(`[SSC] Official search discovery returned ${results.length} approved-domain candidate(s); rejected ${rejected} non-HTTPS or non-official result(s).`);
          for (const result of results) {
            const resultUrl = new URL(result.link);
            if (/\.pdf$/i.test(resultUrl.pathname)) {
              pdfCandidates.set(resultUrl.toString(), resultUrl.toString());
              continue;
            }
            try {
              const { text, finalUrl } = await fetchOfficialText(resultUrl.toString(), SSC_HOSTS);
              if (/human verification|captcha|access denied/i.test(stripHtml(text))) {
                console.warn(`[SSC] Official search candidate returned an access challenge: ${finalUrl}`);
                continue;
              }
              for (const anchor of parseAnchors(text, finalUrl, SSC_HOSTS)) {
                if (/\.pdf(?:$|[?#])/i.test(anchor.href)) {
                  pdfCandidates.set(anchor.href, anchor.text);
                }
              }
            } catch (error) {
              console.warn(`[SSC] Official search candidate could not be verified: ${resultUrl}`, error);
            }
          }
        }

        const records: RecruitmentRecord[] = [];
        for (const [pdfUrl, officialLinkTitle] of [...pdfCandidates].slice(0, 40)) {
          try {
            const pdfText = await fetchOfficialPdfText(pdfUrl, SSC_HOSTS);
            const metadata = parseSscNotification(pdfText);
            if (!metadata) {
              console.info(`[SSC] Official PDF rejected because its contents did not verify a recruitment notification: ${pdfUrl}`);
              continue;
            }
            const pdfFacts = extractOfficialPdfFactsFromText(pdfText);
            const path = new URL(pdfUrl).pathname;
            const sourceId = metadata.identifier
              ? `SSC:${metadata.identifier.toUpperCase()}`
              : `SSC:${path}`;
            records.push(makeRecord({
              sourceId,
              officialWebsiteUrl: SSC_HOME,
              notificationUrl: pdfUrl,
              title: metadata.title,
              examName: metadata.title,
              organization: "Staff Selection Commission",
              ...extractApplicationDates(pdfText),
              ...pdfFacts,
            }));
            if (officialLinkTitle) {
              console.info(`[SSC] Verified document link label: ${officialLinkTitle}`);
            }
          } catch (error) {
            console.warn(`[SSC] Official PDF could not be parsed; skipping it independently: ${pdfUrl}`, error);
          }
        }

        const unique = new Map<string, RecruitmentRecord>();
        for (const record of records) {
          if (!unique.has(record.source_notification_id)) unique.set(record.source_notification_id, record);
        }
        if (!unique.size) {
          throw new Error(`SSC official search fallback found no verifiable notification PDFs. Official noticeboard: ${SSC_NOTICE_PAGE}.`);
        }
        return [...unique.values()];
      },
    },
  ],
}));
