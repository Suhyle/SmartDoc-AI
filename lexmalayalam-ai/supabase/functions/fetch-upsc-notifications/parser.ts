export function parseUpscNotification(text: string): { title: string; identifier: string | null } | null {
  const lines = text.split(/\r?\n/).map((line) => line.replace(/\s+/g, " ").trim()).filter(Boolean);
  const openingLines = lines.slice(0, 40);
  const openingText = openingLines.join("\n");
  const normalizedOpeningText = openingText.replace(/\bEX\s+AMINATION\b/gi, "EXAMINATION");
  if (!/union\s+public\s+service\s+commission/i.test(text.slice(0, 8000))) return null;
  if (/\b(?:result|admit\s+card|answer\s+key|question\s+paper|press\s+note)\b/i.test(openingLines.slice(0, 8).join("\n"))) return null;
  if (/\binstructions?\b|\bonline\s+application\s+form\b/i.test(openingLines.slice(0, 8).join("\n"))) return null;
  if (!/\b(?:examination\s+(?:notice|notification)|notice\s+of\s+.{0,40}examination|notification\s+no\.?)\b/i.test(normalizedOpeningText)) return null;

  const combinedHeader = openingLines.slice(0, 20).join(" ").replace(/\s+/g, " ");
  const officialExamTitlePatterns = [
    /\bCIVIL\s+SERVICES(?:\s+\(PRELIMINARY\))?\s+EXAMINATION(?:\s*,?\s*\d{4})?/i,
    /\bINDIAN\s+FOREST\s+SERVICE(?:\s+\(PRELIMINARY\))?\s+EXAMINATION(?:\s*,?\s*\d{4})?/i,
    /\bCOMBINED\s+GEO[-\s]?SCIENTIST\s+EXAMINATION(?:\s*,?\s*\d{4})?/i,
    /\bCOMBINED\s+DEFENCE\s+SERVICES\s+EXAMINATION(?:\s*[-(]\s*[IVX0-9]+[)]?)?(?:\s*,?\s*\d{4})?/i,
    /\bNATIONAL\s+DEFENCE\s+ACADEMY(?:\s+AND\s+NAVAL\s+ACADEMY)?\s+EXAMINATION(?:\s*[-(]\s*[IVX0-9]+[)]?)?(?:\s*,?\s*\d{4})?/i,
    /\bCOMBINED\s+MEDICAL\s+SERVICES\s+EXAMINATION(?:\s*,?\s*\d{4})?/i,
    /\bCENTRAL\s+ARMED\s+POLICE\s+FORCES\b.{0,80}\bEXAMINATION(?:\s*,?\s*\d{4})?/i,
    /\bINDIAN\s+ECONOMIC\s+SERVICE(?:\s*\/\s*INDIAN\s+STATISTICAL\s+SERVICE)?\s+EXAMINATION(?:\s*,?\s*\d{4})?/i,
    /\bENGINEERING\s+SERVICES\s+EXAMINATION(?:\s*,?\s*\d{4})?/i,
  ];
  const officialTitle = officialExamTitlePatterns.map((pattern) => pattern.exec(combinedHeader)?.[0]).find(Boolean);
  const title = officialTitle?.replace(/\s+/g, " ") || openingLines.find((line) =>
    line.length >= 12
    && line.length <= 220
    && /\b(?:recruitment|civil\s+services|national\s+defence|engineering\s+services|combined|medical\s+services|forest\s+service|geo[\s-]?scientist|geologist|economics|statistical|specialist|academy|competitive\s+examination)\b/i.test(line)
    && !/\b(?:result|admit\s+card|answer\s+key|question\s+paper|press\s+note|notice|notification|advertisement|instructions?|dated?|date\s+of)\b/i.test(line)
  );
  if (!title) return null;

  const rawIdentifier = /(?:examination\s+)?(?:notice|notification|advertisement)\s*(?:no\.?|number)?\s*[:#-]?\s*([A-Z0-9][A-Z0-9./ -]*\d[A-Z0-9./ -]*)/i.exec(normalizedOpeningText)?.[1]
    ?.split(/\s+(?:DATE|DATED)\b/i)[0]
    .trim();
  const identifier = rawIdentifier
    ? rawIdentifier.replace(/^(\d{1,2})\s+(\d{1,2})(?=\s*\/)/, "$1$2")
      .replace(/\s*([/-])\s*/g, "$1")
      .replace(/\s+/g, " ")
    : null;
  return { title, identifier };
}

export function extractUpscExamDate(text: string): string | null {
  return /\bDate\s+of\s+(?:\((?:Preliminary|Main)\)\s+)?Examination\s*[:-]?\s*(\d{1,2}[./-]\d{1,2}[./-]\d{4})/i.exec(text)?.[1]
    || /\bDate\s*\/\s*\(s\)\s*of\s+Examination\s*[:-]?\s*(\d{1,2}[./-]\d{1,2}[./-]\d{4})/i.exec(text)?.[1]
    || null;
}
