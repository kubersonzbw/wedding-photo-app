export function normalizeEventDomain(host: string | null) {
  const domain = String(host ?? "")
    .split(",")[0]
    .trim()
    .toLowerCase()
    .replace(/:\d+$/, "")
    .replace(/^www\./, "");

  return domain || null;
}

export function isLocalDevelopmentDomain(domain: string) {
  return ["localhost", "127.0.0.1", "0.0.0.0"].includes(domain);
}
