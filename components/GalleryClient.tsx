"use client";
/* eslint-disable @next/next/no-img-element */
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";

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

  const load = useCallback(async (nextSlug = slug, nextGalleryCode = galleryCode) => {
    setLoading(true); setError("");
    try {
      const res = await fetch("/api/gallery", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ slug: nextSlug, galleryCode: nextGalleryCode }) });
      const data = await res.json();
      if (!res.ok) { setPhotos([]); setError(data.error ?? "Nie udało się pobrać galerii. Sprawdź kod galerii."); }
      else setPhotos(data.photos ?? []);
    } catch {
      setPhotos([]); setError("Nie udało się pobrać galerii. Spróbuj ponownie za chwilę.");
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

  return <main className="page-shell wide">
    <section className="hero gallery-hero"><p className="eyebrow">Robert & Natalia</p><h1>Galeria zdjęć</h1><p>Wspomnienia z wesela Roberta i Natalii</p></section>
    <div className="card gallery-controls">
      <div><label htmlFor="slug">Wydarzenie</label><input id="slug" value={slug} onChange={(e)=>setSlug(e.target.value)} placeholder="robert-natalia" /></div>
      <div><label htmlFor="galleryCode">Kod galerii</label><input id="galleryCode" value={galleryCode} onChange={(e)=>setGalleryCode(e.target.value)} placeholder="kod galerii" /></div>
      <button className="btn" onClick={()=>load()} disabled={loading}>{loading ? "Ładowanie..." : "Pokaż galerię"}</button>
      {error && <p className="error gallery-error" role="alert">Nie możemy otworzyć galerii. Sprawdź, czy kod galerii jest poprawny.</p>}
    </div>
    {loading && <div className="grid-gallery" aria-label="Ładowanie galerii">{Array.from({ length: 8 }).map((_, i)=><div className="skeleton-tile" key={i} />)}</div>}
    {!loading && !error && photos.length > 0 && <div className="grid-gallery">{photos.map((p, index)=><button key={p.id} onClick={()=>setActiveIndex(index)} className="photo-tile"><img src={p.url} alt="Zdjęcie z wesela dodane przez gościa" /></button>)}</div>}
    {!loading && !error && photos.length === 0 && <section className="card empty-card"><h2>Jeszcze nie ma zdjęć w galerii</h2><p>Bądź pierwszy i dodaj zdjęcia z wesela</p><Link className="btn btn-secondary" href={`/wedding/${encodeURIComponent(slug)}${galleryCode ? `?code=${encodeURIComponent(galleryCode)}` : ""}`}>Dodaj zdjęcia</Link></section>}
    {active && <div className="modal" onClick={()=>setActiveIndex(null)} role="dialog" aria-modal="true" aria-label="Podgląd zdjęcia">
      <button className="modal-close" onClick={()=>setActiveIndex(null)} aria-label="Zamknij podgląd zdjęcia">×</button>
      <button className="modal-nav modal-prev" onClick={(e)=>{ e.stopPropagation(); setActiveIndex((current) => current === null ? current : (current - 1 + photos.length) % photos.length); }} aria-label="Poprzednie zdjęcie">‹</button>
      <img src={active.url} alt="Duże zdjęcie z wesela dodane przez gościa" onClick={(e)=>e.stopPropagation()} />
      <button className="modal-nav modal-next" onClick={(e)=>{ e.stopPropagation(); setActiveIndex((current) => current === null ? current : (current + 1) % photos.length); }} aria-label="Następne zdjęcie">›</button>
    </div>}
  </main>;
}
