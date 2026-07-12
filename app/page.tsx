import { headers } from "next/headers";
import ErrorState from "@/components/ErrorState";
import WeddingLanding from "@/components/WeddingLanding";
import WeddingShell from "@/components/WeddingShell";
import { galleryHref } from "@/lib/events/config";
import { resolveEventByHost } from "@/lib/events/resolve";

export default async function Home({ searchParams }: { searchParams: Promise<{ code?: string | string[]; slug?: string | string[] }> }) {
  const params = await searchParams;
  const codeParam = params.code;
  const slugParam = params.slug;
  const code = Array.isArray(codeParam) ? codeParam[0] ?? "" : codeParam ?? "";
  let slug = Array.isArray(slugParam) ? slugParam[0] ?? "" : slugParam ?? "";
  if (!slug) {
    const headersList = await headers();
    const event = await resolveEventByHost(headersList.get("x-forwarded-host") ?? headersList.get("host"));
    slug = event?.slug ?? "";
  }

  if (!slug) {
    return <WeddingShell screen>
      <ErrorState title="Link jest nieprawidłowy" description="Otwórz link otrzymany od pary młodej." />
    </WeddingShell>;
  }
  const query = code ? `?code=${encodeURIComponent(code)}` : "";

  return <WeddingLanding uploadHref={`/wedding/${encodeURIComponent(slug)}${query}`} galleryHref={galleryHref(slug, code)} />;
}
