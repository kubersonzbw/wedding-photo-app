"use client";
import Link from "next/link";
import { useRef, useState } from "react";
import { galleryHref } from "@/lib/events/config";
import { validatePhotoList } from "@/lib/photos/validation";

async function compressImage(file: File): Promise<File> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, 1600 / bitmap.width);
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d")?.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob((b) => b ? resolve(b) : reject(new Error("Nie udało się przygotować zdjęcia.")), "image/jpeg", 0.86));
  return new File([blob], file.name.replace(/\.[^.]+$/, ".jpg"), { type: "image/jpeg" });
}

export default function UploadForm({ slug, initialCode = "", locked = false }: { slug: string; initialCode?: string; locked?: boolean }) {
  const [guestName, setGuestName] = useState("");
  const [accessCode, setAccessCode] = useState(initialCode);
  const [consent, setConsent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(locked ? "Ten link wygląda na nieprawidłowy. Poproś parę młodą o poprawny kod." : null);
  const [fileCount, setFileCount] = useState(0);
  const fileRef = useRef<HTMLInputElement>(null);
  const galleryUrl = galleryHref(slug);

  async function submit(formData: FormData) {
    setLoading(true); setError(null); setMessage(null);
    try {
      if (!consent) throw new Error("Zaznacz zgodę, aby dodać zdjęcia do wspólnej galerii.");
      const selected = formData.getAll("photos").filter((f): f is File => f instanceof File && f.size > 0);
      const validation = validatePhotoList(selected);
      if (validation) throw new Error(validation);
      const upload = new FormData();
      upload.set("slug", slug); upload.set("accessCode", accessCode); upload.set("guestName", guestName);
      for (const file of selected) upload.append("photos", await compressImage(file));
      const res = await fetch("/api/upload", { method: "POST", body: upload });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Nie udało się dodać zdjęć. Spróbuj ponownie.");
      setMessage("Dziękujemy! Zdjęcia są już w galerii ❤️");
      setGuestName("");
      setConsent(false);
      setFileCount(0);
      if (fileRef.current) fileRef.current.value = "";
    } catch (e) { setError(e instanceof Error ? e.message : "Nie udało się dodać zdjęć. Spróbuj ponownie."); }
    finally { setLoading(false); }
  }

  if (message) {
    return <section className="memory-card success-state" aria-live="polite">
      <div className="success-bloom"><span>♥</span></div>
      <p className="script-note">Wspomnienie zapisane</p>
      <h2>{message}</h2>
      <p>Twoje kadry dołączyły do naszej ślubnej opowieści.</p>
      <div className="success-actions">
        <Link className="btn btn-primary" href={galleryUrl}>Zobacz galerię</Link>
        <button className="btn btn-ghost" onClick={() => setMessage(null)}>Dodaj kolejne zdjęcia</button>
      </div>
    </section>;
  }

  return <form action={submit} className="memory-card upload-card">
    <div className="card-heading">
      <span className="tiny-ornament">✦</span>
      <h2>Dodaj wspomnienie</h2>
      <p>Wpisz imię i wybierz ulubione kadry — resztą zajmiemy się za Ciebie.</p>
    </div>
    <div className="floating-field"><label htmlFor="guestName">Imię gościa</label><input id="guestName" required name="guestName" value={guestName} onChange={(e)=>setGuestName(e.target.value)} placeholder="np. Kasia" /></div>
    {!initialCode && <div className="floating-field"><label htmlFor="accessCode">Kod z zaproszenia</label><input id="accessCode" required name="accessCode" value={accessCode} onChange={(e)=>setAccessCode(e.target.value)} placeholder="Wpisz kod" /></div>}
    <div>
      <label className="sr-only" htmlFor="photos">Zdjęcia</label>
      <label className="upload-dropzone" htmlFor="photos">
        <span className="camera-icon">◌</span>
        <strong>Wybierz zdjęcia z telefonu</strong>
        <span>Możesz dodać do 10 zdjęć naraz</span>
        <small>{fileCount > 0 ? `Wybrano ${fileCount} zdjęć` : "JPG, PNG lub WebP — lekko i bezpiecznie"}</small>
      </label>
      <input ref={fileRef} id="photos" className="sr-only" required name="photos" type="file" multiple accept="image/jpeg,image/png,image/webp" onChange={(e)=>setFileCount(e.target.files?.length ?? 0)} />
    </div>
    <label className="consent-row"><input type="checkbox" checked={consent} onChange={(e)=>setConsent(e.target.checked)} /> <span>Wyrażam zgodę na dodanie zdjęć do prywatnej galerii weselnej.</span></label>
    <button disabled={loading || locked} className="btn btn-primary cta-button">{loading ? "Dodajemy zdjęcia…" : "Dodaj zdjęcia do galerii"}</button>
    <Link className="text-link" href={galleryUrl}>Zobacz wspólną galerię</Link>
    {error && <p className="error" role="alert">{error}</p>}
  </form>;
}
