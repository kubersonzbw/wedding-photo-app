"use client";
/* eslint-disable @next/next/no-img-element */
import { useEffect, useState } from "react";

type Photo = { id: string; url: string; storage_path: string; status: string; created_at: string; guests?: { name?: string } };
export default function AdminPage() {
  const [status, setStatus] = useState("all"); const [photos, setPhotos] = useState<Photo[]>([]); const [error, setError] = useState("");
  async function load(currentStatus = status) { const res = await fetch(`/api/admin/photos?status=${currentStatus}`); const data = await res.json(); if (!res.ok) setError("Zaloguj się do Supabase Auth, aby zobaczyć panel."); else { setError(""); setPhotos(data.photos); } }
  async function act(photo: Photo, next: "approved"|"hidden"|"deleted") { await fetch("/api/admin/photos", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: photo.id, status: next, storagePath: photo.storage_path }) }); await load(); }
  useEffect(()=>{ let cancelled = false; fetch(`/api/admin/photos?status=${status}`).then((res)=>res.json().then((data)=>({ ok: res.ok, data }))).then(({ ok, data })=>{ if (cancelled) return; if (!ok) setError("Zaloguj się do Supabase Auth, aby zobaczyć panel."); else { setError(""); setPhotos(data.photos); } }); return () => { cancelled = true; }; }, [status]);
  return <main className="page-shell wide"><section className="hero"><p className="eyebrow">Panel admina</p><h1>Zarządzanie zdjęciami</h1></section><select value={status} onChange={(e)=>setStatus(e.target.value)}><option value="all">Wszystkie</option><option value="pending">Pending</option><option value="approved">Approved</option><option value="hidden">Hidden</option><option value="deleted">Deleted</option></select>{error && <p className="error">{error}</p>}<div className="admin-list">{photos.map((p)=><article className="admin-card" key={p.id}><img src={p.url} alt="Podgląd" /><div><b>{p.guests?.name ?? "Gość"}</b><p>{new Date(p.created_at).toLocaleString("pl-PL")} · {p.status}</p><div className="actions"><button onClick={()=>act(p,"approved")}>Approve</button><button onClick={()=>act(p,"hidden")}>Hide</button><button onClick={()=>act(p,"deleted")}>Delete</button></div></div></article>)}</div></main>;
}
