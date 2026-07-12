import { headers } from "next/headers";
import Link from "next/link";
import ErrorState from "@/components/ErrorState";
import UploadForm from "@/components/UploadForm";
import WeddingShell from "@/components/WeddingShell";
import { galleryHref } from "@/lib/events/config";
import { resolveEventByHost } from "@/lib/events/resolve";
import { verifyGuestCode } from "@/lib/security/hash";

export default async function WeddingPage({ searchParams }: { searchParams: Promise<{ code?: string | string[]; returnTo?: string | string[] }> }) {
  const search = await searchParams;
  const codeParam = search.code;
  const returnToParam = search.returnTo;
  const code = Array.isArray(codeParam) ? codeParam[0] ?? "" : codeParam ?? "";
  const returnTo = Array.isArray(returnToParam) ? returnToParam[0] ?? "" : returnToParam ?? "";
  const headersList = await headers();
  const event = await resolveEventByHost(headersList.get("x-forwarded-host") ?? headersList.get("host"));

  if (!event?.slug) {
    return <WeddingShell screen>
      <ErrorState title="Link jest nieprawidłowy" description="Otwórz link otrzymany od pary młodej." />
    </WeddingShell>;
  }

  const locked = code ? !verifyGuestCode(code, event) : false;
  const landingHref = code ? `/?code=${encodeURIComponent(code)}` : "/";
  const backHref = returnTo === "gallery" ? galleryHref(event.slug, code || undefined) : landingHref;

  return <WeddingShell screen>
    <header className="mobile-topbar">
      <Link href={backHref} aria-label="Wróć">‹</Link><span>NATALIA & ROBERT</span><Link className="mobile-topbar-heart-link" href={galleryHref(event.slug, code || undefined)} aria-label="Galeria">
        <span className="mobile-topbar-heart-icon mobile-topbar-heart-icon-outline" aria-hidden="true" />
      </Link>
    </header>
    <UploadForm slug={event.slug} initialCode={code} locked={locked} />
  </WeddingShell>;
}
