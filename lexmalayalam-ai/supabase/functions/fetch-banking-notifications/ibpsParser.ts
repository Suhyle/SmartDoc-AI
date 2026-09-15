export type IbpsRegistrationDetails = {
  title: string;
  cycle: string;
  applicationStartDate: string;
  applicationLastDate: string;
};

export function parseIbpsRegistrationDetails(title: string, text: string): IbpsRegistrationDetails | null {
  const cycle = extractIbpsCycle(title) || extractIbpsCycle(text.slice(0, 12000));
  if (!cycle || !/common recruitment process/i.test(title)) return null;
  const applicationStartDate = /commencement of online registration of application\s*[:-]?\s*(\d{1,2}[./-]\d{1,2}[./-]\d{4})/i.exec(text)?.[1];
  const applicationLastDate = /closure of registration of application\s*[:-]?\s*(\d{1,2}[./-]\d{1,2}[./-]\d{4})/i.exec(text)?.[1];
  if (!applicationStartDate || !applicationLastDate) return null;
  return { title: title.trim(), cycle, applicationStartDate, applicationLastDate };
}

export function parseIbpsNotificationText(text: string): { title: string; cycle: string } | null {
  const openingText = text.slice(0, 14000);
  if (!/institute\s+of\s+banking\s+personnel\s+selection/i.test(openingText)) return null;
  const openingLines = openingText.split(/\r?\n/).map((line) => line.replace(/\s+/g, " ").trim()).filter(Boolean);
  if (/\b(?:corrigendum|annexure|result|call\s+letter|admit\s+card|information\s+handout|score\s*card)\b/i.test(openingLines.slice(0, 12).join("\n"))) return null;
  if (!/\b(?:notification|common\s+recruitment\s+process)\b/i.test(openingLines.slice(0, 30).join("\n"))) return null;
  const cycle = extractIbpsCycle(openingText);
  if (!cycle) return null;

  const title = openingLines.find((line) =>
    line.length >= 18
    && line.length <= 240
    && /\b(?:notification|common\s+recruitment\s+process|CRP)\b/i.test(line)
    && !/\b(?:corrigendum|annexure|result|call\s+letter|admit\s+card|information\s+handout|score\s*card)\b/i.test(line)
  );
  return title ? { title, cycle } : null;
}

function extractIbpsCycle(text: string): string | null {
  const match = /\bCRP\s*[- ]*(CSA|RRBs?|PO(?:\/MTs?)?|SPL|SO)\s*[- ]*([A-Z0-9]+)\b/i.exec(text);
  if (!match) return null;
  const group = /^RRBs?$/i.test(match[1])
    ? "RRBs"
    : /^(?:SPL|SO)$/i.test(match[1])
    ? "SPL"
    : /^PO(?:\/MTs?)?$/i.test(match[1])
    ? "PO"
    : match[1].toUpperCase();
  return `CRP-${group}-${match[2].toUpperCase()}`;
}
