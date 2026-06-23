export const DEFAULT_EVENT_SLUG = process.env.NEXT_PUBLIC_DEFAULT_EVENT_SLUG ?? "robert-natalia";
export const DEFAULT_GALLERY_CODE = process.env.NEXT_PUBLIC_DEFAULT_GALLERY_CODE ?? "gallery-2026";

export function galleryHref(slug = DEFAULT_EVENT_SLUG, code = DEFAULT_GALLERY_CODE) {
  const query = code ? `?code=${encodeURIComponent(code)}` : "";
  return `/gallery/${encodeURIComponent(slug)}${query}`;
}
