"use client";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import EmptyGalleryState from "@/components/EmptyGalleryState";
import ErrorState from "@/components/ErrorState";
import GalleryGrid from "@/components/GalleryGrid";
import LoadingGalleryState from "@/components/LoadingGalleryState";
import PhotoLightbox from "@/components/PhotoLightbox";
import WeddingShell from "@/components/WeddingShell";

const DEFAULT_SLUG = process.env.NEXT_PUBLIC_DEFAULT_EVENT_SLUG ?? "robert-natalia";
type Photo = { id: string; url: string; guestName?: string; createdAt: string };

export default function GalleryClient({ initialSlug = DEFAULT_SLUG, initialCode = "" }: { initialSlug?: string; initialCode?: string }) {
  const [slug] = useState(initialSlug);
  const [galleryCode, setGalleryCode] = useState(initialCode);
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [hasRequested, setHasRequested] = useState(Boolean(initialCode));
  const active = activeIndex === null ? null : photos[activeIndex];
  const initialLoadStarted = useRef(false);
  const uploadHref = `/wedding/${encodeURIComponent(slug)}${galleryCode ? `?code=${encodeURIComponent(galleryCode)}` : ""}`;

  const load = useCallback(async (nextSlug = slug, nextGalleryCode = galleryCode) => {
    setHasRequested(true); setLoading(true); setError("");
    try {
      const res = await fetch("/api/gallery", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ slug: nextSlug, galleryCode: nextGalleryCode }) });
      const data = await res.json();
      if (!res.ok) { setPhotos([]); setError(data.error ?? "Spróbuj ponownie później"); }
      else setPhotos(data.photos ?? []);
    } catch { setPhotos([]); setError("Spróbuj ponownie później"); }
    finally { setLoading(false); }
  }, [galleryCode, slug]);

  useEffect(() => { if (!initialCode || initialLoadStarted.current) return; initialLoadStarted.current = true; const timer = window.setTimeout(() => { void load(initialSlug, initialCode); }, 0); return () => window.clearTimeout(timer); }, [initialSlug, initialCode, load]);
  useEffect(() => { if (activeIndex === null) return; function onKeyDown(event: KeyboardEvent) { if (event.key === "Escape") setActiveIndex(null); if (event.key === "ArrowRight") setActiveIndex((c) => c === null ? c : (c + 1) % photos.length); if (event.key === "ArrowLeft") setActiveIndex((c) => c === null ? c : (c - 1 + photos.length) % photos.length); } window.addEventListener("keydown", onKeyDown); return () => window.removeEventListener("keydown", onKeyDown); }, [activeIndex, photos.length]);

  return <WeddingShell wide screen>
    <header className="mobile-topbar"><Link href={`/wedding/${slug}${galleryCode ? `?code=${galleryCode}` : ""}`} aria-label="Dodaj zdjęcia">☰</Link><span>NATALIA & ROBERT</span><span aria-hidden="true">♥</span></header>
    <section className="gallery-intro"><h1>Galeria wspomnień</h1><p>Zdjęcia dodane przez naszych gości</p><Link className="btn btn-primary" href={uploadHref}><span aria-hidden="true">▣</span>Dodaj zdjęcia</Link></section>
    {!initialCode && <section className="gallery-code-card"><div className="floating-field"><label htmlFor="galleryCode">Kod galerii</label><input id="galleryCode" value={galleryCode} onChange={(e)=>setGalleryCode(e.target.value)} placeholder="Wpisz kod z zaproszenia" /></div><button className="btn btn-ghost" onClick={()=>load()} disabled={loading || !galleryCode}>{loading ? "Przygotowujemy galerię…" : "Pokaż galerię"}</button></section>}
    {loading && <LoadingGalleryState />}
    {!loading && error && <ErrorState title="Coś poszło nie tak" description="Spróbuj ponownie później" onRefresh={() => load()} />}
    {!loading && !error && hasRequested && photos.length > 0 && <GalleryGrid photos={photos} onOpen={setActiveIndex} />}
    {!loading && !error && hasRequested && photos.length === 0 && <EmptyGalleryState href={uploadHref} />}
    {active && <PhotoLightbox photo={active} current={(activeIndex ?? 0) + 1} total={photos.length} onClose={() => setActiveIndex(null)} onPrevious={() => setActiveIndex((c) => c === null ? c : (c - 1 + photos.length) % photos.length)} onNext={() => setActiveIndex((c) => c === null ? c : (c + 1) % photos.length)} />}
  </WeddingShell>;
}
