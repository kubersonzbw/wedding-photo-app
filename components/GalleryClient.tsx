"use client";
/* eslint-disable @next/next/no-img-element */
import { useEffect, useState } from "react";

const DEFAULT_SLUG = process.env.NEXT_PUBLIC_DEFAULT_EVENT_SLUG ?? "robert-natalia";

type Photo = { id: string; url: string; guestName?: string; createdAt: string };

export default function GalleryClient({ initialSlug = DEFAULT_SLUG, initialCode = "" }: { initialSlug?: string; initialCode?: string }) {
  const [slug, setSlug] = useState(initialSlug);
  const [galleryCode, setGalleryCode] = useState(initialCode);
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [active, setActive] = useState<Photo | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function load(nextSlug = slug, nextGalleryCode = galleryCode) {
    setLoading(true); setError("");
    const res = await fetch("/api/gallery", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ slug: nextSlug, galleryCode: nextGalleryCode }) });
    const data = await res.json();
    if (!res.ok) setError(data.error);
    else setPhotos(data.photos);
    setLoading(false);
  }

  useEffect(() => {
    if (!initialCode) return;

    let cancelled = false;
    async function loadInitialGallery() {
      const res = await fetch("/api/gallery", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ slug: initialSlug, galleryCode: initialCode }) });
      const data = await res.json();
      if (cancelled) return;
      if (!res.ok) setError(data.error);
      else setPhotos(data.photos);
    }

    void loadInitialGallery();
    return () => { cancelled = true; };
  }, [initialSlug, initialCode]);

  return <main className="page-shell"><section className="hero"><p className="eyebrow">Galeria</p><h1>Robert & Natalia</h1><p>Wspólna galeria gości. Wpisz kod galerii albo użyj linku z zaproszenia.</p></section><div className="card space-y-4"><input value={slug} onChange={(e)=>setSlug(e.target.value)} placeholder="slug wydarzenia" /><input value={galleryCode} onChange={(e)=>setGalleryCode(e.target.value)} placeholder="kod galerii" /><button className="btn w-full" onClick={()=>load()} disabled={loading}>{loading ? "Ładowanie..." : "Pokaż galerię"}</button>{error && <p className="error">{error}</p>}</div><div className="grid-gallery">{photos.map((p)=><button key={p.id} onClick={()=>setActive(p)} className="photo-tile"><img src={p.url} alt={`Zdjęcie od ${p.guestName ?? "gościa"}`} /></button>)}</div>{photos.length === 0 && !error && !loading && initialCode && <p className="empty-state">Tu pojawią się zdjęcia dodane przez gości.</p>}{active && <div className="modal" onClick={()=>setActive(null)}><img src={active.url} alt="Podgląd zdjęcia" /><p>{active.guestName}</p></div>}</main>;
}
