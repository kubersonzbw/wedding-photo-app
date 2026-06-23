export const DEFAULT_EVENT_SLUG = process.env.NEXT_PUBLIC_DEFAULT_EVENT_SLUG ?? "robert-natalia";
export function galleryHref(slug = DEFAULT_EVENT_SLUG, code = "") {
  const query = code ? `?code=${encodeURIComponent(code)}` : "";
  return `/gallery/${encodeURIComponent(slug)}${query}`;
}
