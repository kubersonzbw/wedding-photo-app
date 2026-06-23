import UploadForm from "@/components/UploadForm";
import WeddingHero from "@/components/WeddingHero";
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
  return <WeddingShell>
    <WeddingHero subtitle="Podziel się zdjęciami z naszego wesela" description="Dodane zdjęcia pojawią się we wspólnej galerii" primaryHref="#upload" primaryLabel="Dodaj zdjęcia" actionHref={galleryHref(slug, code || undefined)} actionLabel="Zobacz galerię" />
    <UploadForm slug={slug} initialCode={code} locked={Boolean(code) && !valid} />
  </WeddingShell>;
}
