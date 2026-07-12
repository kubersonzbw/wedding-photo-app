import Link from "next/link";
import UploadForm from "@/components/UploadForm";
import WeddingShell from "@/components/WeddingShell";
import { galleryHref } from "@/lib/events/config";

export default async function WeddingPage({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<{ code?: string | string[] }> }) {
  const { slug } = await params;
  const codeParam = (await searchParams).code;
  const code = Array.isArray(codeParam) ? codeParam[0] ?? "" : codeParam ?? "";
  let valid = false;
  if (code) {
    const base = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
    try { const res = await fetch(`${base}/api/validate-event`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ slug, accessCode: code }), cache: "no-store" }); valid = res.ok; } catch { valid = false; }
  }
  return <WeddingShell screen>
    <header className="mobile-topbar">
      <Link href="/" aria-label="Wróć">‹</Link><span>NATALIA & ROBERT</span><Link className="mobile-topbar-heart-link" href={galleryHref(slug, code || undefined)} aria-label="Galeria">
        <span className="mobile-topbar-heart-icon mobile-topbar-heart-icon-outline" aria-hidden="true" />
      </Link>
    </header>
    <UploadForm slug={slug} initialCode={code} locked={Boolean(code) && !valid} />
  </WeddingShell>;
}
