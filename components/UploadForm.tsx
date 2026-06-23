"use client";
import Link from "next/link";
import { useRef, useState } from "react";
import { galleryHref } from "@/lib/events/config";
import { validatePhotoList } from "@/lib/photos/validation";
import UploadDropzone from "@/components/UploadDropzone";

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
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(locked ? "Ten link wygląda na nieprawidłowy. Poproś parę młodą o poprawny kod." : null);
  const [fileCount, setFileCount] = useState(0);
  const fileRef = useRef<HTMLInputElement>(null);
  const galleryUrl = galleryHref(slug, accessCode || undefined);

  async function submit(formData: FormData) {
    setLoading(true); setError(null); setSuccess(false);
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
      setSuccess(true);
      setGuestName("");
      setConsent(false);
      setFileCount(0);
      if (fileRef.current) fileRef.current.value = "";
    } catch (e) { setError(e instanceof Error ? e.message : "Nie udało się dodać zdjęć. Spróbuj ponownie."); }
    finally { setLoading(false); }
  }

  if (success) {
    return <section className="memory-card success-state" aria-live="polite">
      <div className="success-bloom"><span>📷</span></div>
      <h2>Dziękujemy!</h2>
      <p>Zdjęcia są już w galerii 🧡</p>
      <div className="success-actions">
        <Link className="btn btn-primary" href={galleryUrl}>Zobacz galerię zdjęć</Link>
        <button className="btn btn-ghost" onClick={() => setSuccess(false)}>Dodaj kolejne zdjęcia</button>
      </div>
    <div className="heart-divider" aria-hidden="true"><span />♡<span /></div>
    </section>;
  }

  return <form id="upload" action={submit} className="upload-card">
    <div className="card-heading">
      <h2>Dodaj zdjęcia do wspólnej galerii</h2>
      <p>Wpisz imię, wybierz ulubione kadry i wyślij je jednym kliknięciem.</p>
    </div>
    <div className="floating-field person-field"><label htmlFor="guestName">Twoje imię</label><input id="guestName" required name="guestName" value={guestName} onChange={(e)=>setGuestName(e.target.value)} placeholder="np. Kasia" /></div>
    {!initialCode && <div className="floating-field"><label htmlFor="accessCode">Kod z zaproszenia</label><input id="accessCode" required name="accessCode" value={accessCode} onChange={(e)=>setAccessCode(e.target.value)} placeholder="Wpisz kod z zaproszenia" /></div>}
    <UploadDropzone fileRef={fileRef} fileCount={fileCount} onChange={setFileCount} />
    <label className="consent-row"><input type="checkbox" checked={consent} onChange={(e)=>setConsent(e.target.checked)} /> <span>Wyrażam zgodę na dodanie zdjęć do prywatnej galerii weselnej.</span><b aria-hidden="true">❤</b></label>
    <button disabled={loading || locked} className="btn btn-primary cta-button"><span aria-hidden="true">▣</span>{loading ? "Dodajemy zdjęcia…" : "Dodaj zdjęcia"}<span aria-hidden="true">✦</span></button>
    <Link className="text-link" href={galleryUrl}>Zobacz galerię zdjęć</Link>
    {error && <p className="error" role="alert">{error}</p>}
  </form>;
}
