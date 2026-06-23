"use client";
/* eslint-disable @next/next/no-img-element */
import { useState } from "react";

type Photo = { id: string; url: string; guestName?: string; createdAt: string };
export default function GalleryPage() {
  const [slug, setSlug] = useState(process.env.NEXT_PUBLIC_DEFAULT_EVENT_SLUG ?? "robert-natalia");
  const [galleryCode, setGalleryCode] = useState("");
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [active, setActive] = useState<Photo | null>(null);
  const [error, setError] = useState("");
  async function load() { setError(""); const res = await fetch("/api/gallery", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ slug, galleryCode }) }); const data = await res.json(); if (!res.ok) setError(data.error); else setPhotos(data.photos); }
  return <main className="page-shell"><section className="hero"><p className="eyebrow">Galeria</p><h1>Robert & Natalia</h1><p>Zdjęcia zatwierdzone przez parę młodą.</p></section><div className="card space-y-4"><input value={slug} onChange={(e)=>setSlug(e.target.value)} placeholder="slug wydarzenia" /><input value={galleryCode} onChange={(e)=>setGalleryCode(e.target.value)} placeholder="kod galerii" /><button className="btn" onClick={load}>Pokaż galerię</button>{error && <p className="error">{error}</p>}</div><div className="grid-gallery">{photos.map((p)=><button key={p.id} onClick={()=>setActive(p)} className="photo-tile"><img src={p.url} alt={`Zdjęcie od ${p.guestName ?? "gościa"}`} /></button>)}</div>{active && <div className="modal" onClick={()=>setActive(null)}><img src={active.url} alt="Podgląd zdjęcia" /><p>{active.guestName}</p></div>}</main>;
}
