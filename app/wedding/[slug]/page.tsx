import Link from "next/link";
import UploadForm from "@/components/UploadForm";
import WeddingShell from "@/components/WeddingShell";
import { galleryHref } from "@/lib/events/config";
import { verifyGuestCode } from "@/lib/security/hash";
import { getEventBySlug } from "@/lib/supabase/admin";

export default async function WeddingPage({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<{ code?: string | string[]; returnTo?: string | string[] }> }) {
  const { slug } = await params;
  const search = await searchParams;
  const codeParam = search.code;
  const returnToParam = search.returnTo;
  const code = Array.isArray(codeParam) ? codeParam[0] ?? "" : codeParam ?? "";
  const returnTo = Array.isArray(returnToParam) ? returnToParam[0] ?? "" : returnToParam ?? "";
  let locked = false;
  if (code) {
    try {
      const event = await getEventBySlug(slug);
      locked = !event || !verifyGuestCode(code, event);
    } catch {
      locked = false;
    }
  }
  const landingHref = code ? `/?code=${encodeURIComponent(code)}` : "/";
  const backHref = returnTo === "gallery" ? galleryHref(slug, code || undefined) : landingHref;
  return <WeddingShell screen>
    <header className="mobile-topbar">
      <Link href={backHref} aria-label="Wróć">‹</Link><span>NATALIA & ROBERT</span><Link className="mobile-topbar-heart-link" href={galleryHref(slug, code || undefined)} aria-label="Galeria">
        <span className="mobile-topbar-heart-icon mobile-topbar-heart-icon-outline" aria-hidden="true" />
      </Link>
    </header>
    <UploadForm slug={slug} initialCode={code} locked={locked} />
  </WeddingShell>;
}
