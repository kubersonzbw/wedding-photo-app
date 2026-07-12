export function normalizeEventDomain(host: string | null) {
  const domain = String(host ?? "")
    .split(",")[0]
    .trim()
    .toLowerCase()
    .replace(/:\d+$/, "")
    .replace(/^www\./, "");

  return domain || null;
}
