import { headers } from "next/headers";
import ErrorState from "@/components/ErrorState";
import GalleryClient from "@/components/GalleryClient";
import WeddingShell from "@/components/WeddingShell";
import { resolveEventByHost } from "@/lib/events/resolve";

export default async function GalleryPage({ searchParams }: { searchParams: Promise<{ code?: string | string[] }> }) {
  const codeParam = (await searchParams).code;
  const code = Array.isArray(codeParam) ? codeParam[0] ?? "" : codeParam ?? "";
  const headersList = await headers();
  const event = await resolveEventByHost(headersList.get("x-forwarded-host") ?? headersList.get("host"));

  if (event?.slug) return <GalleryClient initialSlug={event.slug} initialCode={code} />;

  return <WeddingShell screen>
    <ErrorState title="Link jest nieprawidłowy" description="Otwórz link do galerii otrzymany od pary młodej." />
  </WeddingShell>;
}
