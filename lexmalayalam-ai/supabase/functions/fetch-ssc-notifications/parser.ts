export function parseSscNotification(text: string): { title: string; identifier: string | null } | null {
  const lines = text.split(/\r?\n/).map((line) => line.replace(/\s+/g, " ").trim()).filter(Boolean);
  const openingLines = lines.slice(0, 40);
  const openingText = openingLines.join("\n");
  if (!/staff\s+selection\s+commission/i.test(openingText)) return null;
  if (/\b(?:result|admit\s+card|answer\s+key|calendar|press\s+release)\b/i.test(openingText)) return null;
  if (!/\b(?:notice|notification|advertisement)\b/i.test(openingText)) return null;

  const title = openingLines.find((line) =>
    line.length >= 12
    && line.length <= 200
    && /\b(?:examination|recruitment|constable|stenographer|graduate|matriculation|multi.tasking|selection\s+posts?)\b/i.test(line)
    && !/\b(?:result|admit\s+card|answer\s+key|calendar|press\s+release)\b/i.test(line)
  );
  if (!title) return null;

  const identifier = /(?:notification|advertisement|notice)\s*(?:no\.?|number)?\s*[:#-]?\s*([A-Z0-9][A-Z0-9./-]*\d[A-Z0-9./-]*)/i.exec(openingText)?.[1]
    || /\bNo\.?\s+(HQ-[A-Z0-9./-]*\d[A-Z0-9./-]*)/i.exec(openingText)?.[1]
    || null;
  return { title, identifier };
}
