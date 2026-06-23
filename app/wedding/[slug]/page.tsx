import UploadForm from "@/components/UploadForm";

export default async function WeddingPage({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<{ code?: string | string[] }> }) {
  const { slug } = await params;
  const codeParam = (await searchParams).code;
  const code = Array.isArray(codeParam) ? codeParam[0] ?? "" : codeParam ?? "";
  let valid = false;
  if (code) {
    const base = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
    try { const res = await fetch(`${base}/api/validate-event`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ slug, accessCode: code }), cache: "no-store" }); valid = res.ok; } catch { valid = false; }
  }
  return <main className="page-shell"><section className="hero"><p className="eyebrow">Robert & Natalia</p><h1>Dodaj zdjęcia z naszego wesela ❤️</h1><p>Użyj linku lub kodu QR z zaproszenia.</p></section><UploadForm slug={slug} initialCode={code} locked={!valid} /></main>;
}
