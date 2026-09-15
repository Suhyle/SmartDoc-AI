export function normalizeCenNumber(value: string | null | undefined): string | null {
  if (!value) return null;
  const match = /\b(?:CEN\s*[-:]?\s*)?(\d{1,3})\s*\/\s*(\d{4})\b/i.exec(value.trim());
  return match ? `${match[1]}/${match[2]}` : null;
}

export function parseRailwayNotification(text: string): { title: string; cenNumber: string } | null {
  const openingText = text.slice(0, 12000);
  if (!/\b(?:Government of India|Ministry of Railways|Railway Recruitment Board)\b/i.test(openingText)) return null;
  if (/\b(?:result|admit\s+card|answer\s+key|question\s+paper)\b/i.test(text.split(/\r?\n/).slice(0, 10).join("\n"))) return null;
  if (!/\b(?:centralized|centralised)\s+(?:employment|recruitment)\s+(?:notice|notification)\b/i.test(openingText)) return null;

  const cenNumber = normalizeCenNumber(/\bCEN\b[\s\S]{0,80}/i.exec(openingText)?.[0]);
  if (!cenNumber) return null;
  const lines = text.split(/\r?\n/).map((line) => line.replace(/\s+/g, " ").trim()).filter(Boolean);
  const title = lines.slice(0, 30).find((line) =>
    line.length >= 12
    && line.length <= 220
    && /\b(?:centralized|centralised)\s+(?:employment|recruitment)\s+(?:notice|notification)\b/i.test(line)
  );
  if (!title) return null;
  return { title, cenNumber };
}
