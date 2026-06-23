"use client";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import EmptyGalleryState from "@/components/EmptyGalleryState";
import GalleryGrid from "@/components/GalleryGrid";
import PhotoLightbox from "@/components/PhotoLightbox";
import WeddingHero from "@/components/WeddingHero";
import WeddingShell from "@/components/WeddingShell";

const DEFAULT_SLUG = process.env.NEXT_PUBLIC_DEFAULT_EVENT_SLUG ?? "robert-natalia";
type Photo = { id: string; url: string; guestName?: string; createdAt: string };

export default function GalleryClient({ initialSlug = DEFAULT_SLUG, initialCode = "" }: { initialSlug?: string; initialCode?: string }) {
  const [slug, setSlug] = useState(initialSlug);
  const [galleryCode, setGalleryCode] = useState(initialCode);
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const active = activeIndex === null ? null : photos[activeIndex];
  const initialLoadStarted = useRef(false);
  const uploadHref = `/wedding/${encodeURIComponent(slug)}${galleryCode ? `?code=${encodeURIComponent(galleryCode)}` : ""}`;

  const load = useCallback(async (nextSlug = slug, nextGalleryCode = galleryCode) => {
    setLoading(true); setError("");
    try {
      const res = await fetch("/api/gallery", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ slug: nextSlug, galleryCode: nextGalleryCode }) });
      const data = await res.json();
      if (!res.ok) { setPhotos([]); setError(data.error ?? "Nie udało się otworzyć galerii. Spróbuj ponownie."); }
      else setPhotos(data.photos ?? []);
    } catch {
      setPhotos([]); setError("Nie udało się otworzyć galerii. Spróbuj ponownie za chwilę.");
    } finally { setLoading(false); }
  }, [galleryCode, slug]);

  useEffect(() => {
    if (!initialCode || initialLoadStarted.current) return;
    initialLoadStarted.current = true;
    const timer = window.setTimeout(() => { void load(initialSlug, initialCode); }, 0);
    return () => window.clearTimeout(timer);
  }, [initialSlug, initialCode, load]);

  useEffect(() => {
    if (activeIndex === null) return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setActiveIndex(null);
      if (event.key === "ArrowRight") setActiveIndex((current) => current === null ? current : (current + 1) % photos.length);
      if (event.key === "ArrowLeft") setActiveIndex((current) => current === null ? current : (current - 1 + photos.length) % photos.length);
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [activeIndex, photos.length]);

  return <WeddingShell wide>
    <WeddingHero eyebrow="Robert & Natalia" subtitle="Galeria wspomnień" description="Zdjęcia dodane przez naszych gości" />
    <section className="memory-card gallery-panel">
      <div className="gallery-panel-heading"><span>Otwórz ścianę wspomnień</span><Link className="btn btn-primary" href={uploadHref}>Dodaj zdjęcia</Link></div>
      <div className="gallery-controls">
        <div className="floating-field"><label htmlFor="slug">Wydarzenie</label><input id="slug" value={slug} onChange={(e)=>setSlug(e.target.value)} placeholder="robert-natalia" /></div>
        <div className="floating-field"><label htmlFor="galleryCode">Kod galerii</label><input id="galleryCode" value={galleryCode} onChange={(e)=>setGalleryCode(e.target.value)} placeholder="kod galerii" /></div>
        <button className="btn btn-ghost" onClick={()=>load()} disabled={loading}>{loading ? "Przygotowujemy galerię…" : "Pokaż galerię"}</button>
      </div>
      {error && <p className="error gallery-error" role="alert">Ten link wygląda na nieprawidłowy. Poproś parę młodą o poprawny kod.</p>}
    </section>
    {loading && <div className="memory-grid" aria-label="Przygotowujemy galerię">{Array.from({ length: 8 }).map((_, i)=><div className="skeleton-tile" key={i} />)}</div>}
    {!loading && !error && photos.length > 0 && <GalleryGrid photos={photos} onOpen={setActiveIndex} />}
    {!loading && !error && photos.length === 0 && <EmptyGalleryState href={uploadHref} />}
    {active && <PhotoLightbox photo={active} current={(activeIndex ?? 0) + 1} total={photos.length} onClose={() => setActiveIndex(null)} onPrevious={() => setActiveIndex((current) => current === null ? current : (current - 1 + photos.length) % photos.length)} onNext={() => setActiveIndex((current) => current === null ? current : (current + 1) % photos.length)} />}
  </WeddingShell>;
}
