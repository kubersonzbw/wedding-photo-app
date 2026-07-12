export function galleryHref(slug: string, code = "") {
  const query = code ? `?code=${encodeURIComponent(code)}` : "";
  return `/gallery/${encodeURIComponent(slug)}${query}`;
}
