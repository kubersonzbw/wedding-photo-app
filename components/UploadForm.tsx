"use client";
import Link from "next/link";
import type { FormEvent } from "react";
import { useRef, useState } from "react";
import { galleryHref } from "@/lib/events/config";
import { validatePhotoList } from "@/lib/photos/validation";
import UploadDropzone from "@/components/UploadDropzone";

export default function UploadForm({ slug, initialCode = "", locked = false }: { slug: string; initialCode?: string; locked?: boolean }) {
  const [guestName, setGuestName] = useState("");
  const [accessCode, setAccessCode] = useState(initialCode);
  const [consent, setConsent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(locked ? "Ten link wygląda na nieprawidłowy. Poproś parę młodą o poprawny kod." : null);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);
  const galleryUrl = galleryHref(slug, accessCode.trim() || undefined);

  function handleFilesChange(files: File[]) {
    setSelectedFiles(files);
    setError(null);
  }

  async function submit() {
    setLoading(true); setError(null); setSuccess(false);
    try {
      if (!guestName.trim()) throw new Error("Podaj swoje imię, żebyśmy wiedzieli, kto dodał zdjęcia.");
      if (!accessCode.trim()) throw new Error("Wpisz kod weselny, aby dodać zdjęcia.");
      if (!consent) throw new Error("Zaznacz zgodę, aby dodać zdjęcia do wspólnej galerii.");
      const validation = validatePhotoList(selectedFiles);
      if (validation) throw new Error(validation);
      const upload = new FormData();
      upload.set("slug", slug); upload.set("accessCode", accessCode); upload.set("guestName", guestName);
      for (const file of selectedFiles) upload.append("photos", file);
      const res = await fetch("/api/upload", { method: "POST", body: upload });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Nie udało się dodać zdjęć. Spróbuj ponownie.");
      setSuccess(true);
      setGuestName("");
      setConsent(false);
      setSelectedFiles([]);
      if (fileRef.current) fileRef.current.value = "";
    } catch (e) { setError(e instanceof Error ? e.message : "Nie udało się dodać zdjęć. Spróbuj ponownie."); }
    finally { setLoading(false); }
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void submit();
  }

  if (success) {
    return <section className="memory-card success-state" aria-live="polite">
      <div className="success-bloom"><span className="success-camera-icon" aria-hidden="true" /></div>
      <h2>Dziękujemy!</h2>
      <p>Zdjęcia są już w galerii <span className="success-inline-heart" aria-hidden="true" /></p>
      <div className="success-actions">
        <Link className="btn btn-primary" href={galleryUrl}>Zobacz galerię zdjęć</Link>
        <button className="btn btn-ghost" onClick={() => setSuccess(false)}>Dodaj kolejne zdjęcia</button>
      </div>
    <div className="heart-divider" aria-hidden="true"><span /><i className="heart-divider-icon" /><span /></div>
    </section>;
  }

  return <form id="upload" onSubmit={handleSubmit} className="upload-card">
    <div className="card-heading">
      <h2>Dodaj zdjęcia do wspólnej galerii</h2>
      <p>Wpisz imię, wybierz ulubione kadry i wyślij je jednym kliknięciem.</p>
    </div>
    <div className="floating-field person-field">
      <label htmlFor="guestName">Twoje imię</label>
      <input id="guestName" name="guestName" value={guestName} onChange={(e)=>setGuestName(e.target.value)} placeholder="np. Kasia" />
      <span className="person-input-icon" aria-hidden="true">
        <svg viewBox="0 0 24 24">
          <circle cx="12" cy="8" r="3.25" />
          <path d="M5.75 20.2v-1.55c0-3.15 2.55-5.7 5.7-5.7h1.1c3.15 0 5.7 2.55 5.7 5.7v1.55" />
        </svg>
      </span>
    </div>
    {!initialCode && <div className="floating-field"><label htmlFor="accessCode">Kod weselny</label><input id="accessCode" name="accessCode" value={accessCode} onChange={(e)=>setAccessCode(e.target.value)} placeholder="Wpisz kod weselny" /></div>}
    <UploadDropzone fileRef={fileRef} fileCount={selectedFiles.length} onChange={handleFilesChange} />
    <label className="consent-row"><input type="checkbox" checked={consent} onChange={(e)=>setConsent(e.target.checked)} /> <span>Wyrażam zgodę na dodanie zdjęć do prywatnej galerii weselnej.</span><span className="consent-heart-icon" aria-hidden="true" /></label>
    <button disabled={loading || locked} className="btn btn-primary cta-button"><span className="cta-camera-icon" aria-hidden="true" /><span className="cta-button-label">{loading ? "Dodajemy zdjęcia…" : "Dodaj zdjęcia"}</span></button>
    <Link className="text-link" href={galleryUrl}>Zobacz galerię zdjęć</Link>
    {error && <p className="error" role="alert">
      <span className="error-broken-heart" aria-hidden="true" />
      <span>{error}</span>
    </p>}
  </form>;
}
