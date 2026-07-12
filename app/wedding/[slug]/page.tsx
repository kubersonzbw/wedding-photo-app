import Link from "next/link";
import UploadForm from "@/components/UploadForm";
import WeddingShell from "@/components/WeddingShell";
import { galleryHref } from "@/lib/events/config";
import { verifyGuestCode } from "@/lib/security/hash";
import { getEventBySlug } from "@/lib/supabase/admin";

export default async function WeddingPage({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<{ code?: string | string[] }> }) {
  const { slug } = await params;
  const codeParam = (await searchParams).code;
  const code = Array.isArray(codeParam) ? codeParam[0] ?? "" : codeParam ?? "";
  let locked = false;
  if (code) {
    try {
      const event = await getEventBySlug(slug);
      locked = !event || !verifyGuestCode(code, event);
    } catch {
      locked = false;
    }
  }
  return <WeddingShell screen>
    <header className="mobile-topbar">
      <Link href="/" aria-label="Wróć">‹</Link><span>NATALIA & ROBERT</span><Link className="mobile-topbar-heart-link" href={galleryHref(slug, code || undefined)} aria-label="Galeria">
        <span className="mobile-topbar-heart-icon mobile-topbar-heart-icon-outline" aria-hidden="true" />
      </Link>
    </header>
    <UploadForm slug={slug} initialCode={code} locked={locked} />
  </WeddingShell>;
}
