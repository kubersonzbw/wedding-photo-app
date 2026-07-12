import WeddingLanding from "@/components/WeddingLanding";
import { DEFAULT_EVENT_SLUG, galleryHref } from "@/lib/events/config";

export default async function Home({ searchParams }: { searchParams: Promise<{ code?: string | string[]; slug?: string | string[] }> }) {
  const params = await searchParams;
  const codeParam = params.code;
  const slugParam = params.slug;
  const code = Array.isArray(codeParam) ? codeParam[0] ?? "" : codeParam ?? "";
  const slug = Array.isArray(slugParam) ? slugParam[0] ?? DEFAULT_EVENT_SLUG : slugParam ?? DEFAULT_EVENT_SLUG;
  const query = code ? `?code=${encodeURIComponent(code)}` : "";

  return <WeddingLanding uploadHref={`/wedding/${encodeURIComponent(slug)}${query}`} galleryHref={galleryHref(slug, code)} />;
}
