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
  return <main className="page-shell"><section className="hero"><p className="eyebrow">Robert & Natalia</p><h1>Dodaj zdjęcia z naszego wesela ❤️</h1><p>Dodaj zdjęcia do wspólnej galerii. Zdjęcia pojawią się od razu w galerii.</p><p>Po dodaniu zdjęć możesz zobaczyć wspólną galerię gości.</p><Link className="btn btn-secondary hero-link" href={galleryHref(slug)}>Zobacz galerię zdjęć</Link></section><UploadForm slug={slug} initialCode={code} locked={!valid} /></main>;
}
