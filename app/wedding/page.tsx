import { headers } from "next/headers";
import Link from "next/link";
import ErrorState from "@/components/ErrorState";
import UploadForm from "@/components/UploadForm";
import WeddingShell from "@/components/WeddingShell";
import { galleryHref } from "@/lib/events/config";
import { resolveEventByHost } from "@/lib/events/resolve";
import { verifyGuestCode } from "@/lib/security/hash";

export default async function WeddingPage({ searchParams }: { searchParams: Promise<{ code?: string | string[] }> }) {
  const codeParam = (await searchParams).code;
  const code = Array.isArray(codeParam) ? codeParam[0] ?? "" : codeParam ?? "";
  const headersList = await headers();
  const event = await resolveEventByHost(headersList.get("x-forwarded-host") ?? headersList.get("host"));

  if (!event?.slug) {
    return <WeddingShell screen>
      <ErrorState title="Link jest nieprawidłowy" description="Otwórz link otrzymany od pary młodej." />
    </WeddingShell>;
  }

  const locked = code ? !verifyGuestCode(code, event) : false;
  const landingQuery = new URLSearchParams({ slug: event.slug });
  if (code) landingQuery.set("code", code);

  return <WeddingShell screen>
    <header className="mobile-topbar">
      <Link href={`/?${landingQuery.toString()}`} aria-label="Wróć">‹</Link><span>NATALIA & ROBERT</span><Link className="mobile-topbar-heart-link" href={galleryHref(event.slug, code || undefined)} aria-label="Galeria">
        <span className="mobile-topbar-heart-icon mobile-topbar-heart-icon-outline" aria-hidden="true" />
      </Link>
    </header>
    <UploadForm slug={event.slug} initialCode={code} locked={locked} />
  </WeddingShell>;
}
