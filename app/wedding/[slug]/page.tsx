import Link from "next/link";
import UploadForm from "@/components/UploadForm";
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
  return <main className="page-shell">
    <section className="hero">
      <p className="eyebrow">Robert & Natalia</p>
      <h1>Robert & Natalia</h1>
      <p className="hero-subtitle">Podziel się zdjęciami z naszego wesela</p>
      <p className="hero-note">Dodane zdjęcia pojawią się we wspólnej galerii</p>
      <Link className="btn btn-secondary hero-link" href={galleryHref(slug)}>Zobacz galerię zdjęć</Link>
    </section>
    <UploadForm slug={slug} initialCode={code} locked={Boolean(code) && !valid} />
  </main>;
}
