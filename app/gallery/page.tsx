import { headers } from "next/headers";
import ErrorState from "@/components/ErrorState";
import GalleryClient from "@/components/GalleryClient";
import WeddingShell from "@/components/WeddingShell";
import { normalizeEventDomain } from "@/lib/events/domain";
import { getEventByDomain } from "@/lib/supabase/admin";

export default async function GalleryPage({ searchParams }: { searchParams: Promise<{ code?: string | string[] }> }) {
  const codeParam = (await searchParams).code;
  const code = Array.isArray(codeParam) ? codeParam[0] ?? "" : codeParam ?? "";
  const headersList = await headers();
  const domain = normalizeEventDomain(headersList.get("x-forwarded-host") ?? headersList.get("host"));
  const event = domain ? await getEventByDomain(domain).catch(() => null) : null;

  if (event?.slug) return <GalleryClient initialSlug={event.slug} initialCode={code} />;

  return <WeddingShell screen>
    <ErrorState title="Link jest nieprawidłowy" description="Otwórz link do galerii otrzymany od pary młodej." />
  </WeddingShell>;
}
