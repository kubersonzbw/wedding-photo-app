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
  const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob((b) => b ? resolve(b) : reject(new Error("Nie udało się skompresować zdjęcia.")), "image/jpeg", 0.86));
  return new File([blob], file.name.replace(/\.[^.]+$/, ".jpg"), { type: "image/jpeg" });
}

export default function UploadForm({ slug, initialCode = "", locked = false }: { slug: string; initialCode?: string; locked?: boolean }) {
  const [guestName, setGuestName] = useState("");
  const [accessCode, setAccessCode] = useState(initialCode);
  const [consent, setConsent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(locked ? "Poprawny kod z zaproszenia jest wymagany, aby dodać zdjęcia." : null);
  const [fileCount, setFileCount] = useState(0);
  const fileRef = useRef<HTMLInputElement>(null);
  const galleryUrl = galleryHref(slug);

  async function submit(formData: FormData) {
    setLoading(true); setError(null); setMessage(null);
    try {
      if (!consent) throw new Error("Zaznacz zgodę na dodanie zdjęć do galerii.");
      const selected = formData.getAll("photos").filter((f): f is File => f instanceof File && f.size > 0);
      const validation = validatePhotoList(selected);
      if (validation) throw new Error(validation);
      const upload = new FormData();
      upload.set("slug", slug); upload.set("accessCode", accessCode); upload.set("guestName", guestName);
      for (const file of selected) upload.append("photos", await compressImage(file));
      const res = await fetch("/api/upload", { method: "POST", body: upload });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Nie udało się dodać zdjęć.");
      setMessage("Dziękujemy! Zdjęcia zostały dodane do galerii ❤️");
      setGuestName("");
      setConsent(false);
      setFileCount(0);
      if (fileRef.current) fileRef.current.value = "";
    } catch (e) { setError(e instanceof Error ? e.message : "Wystąpił błąd."); }
    finally { setLoading(false); }
  }

  if (message) {
    return <section className="card success-card" aria-live="polite">
      <div className="success-icon">♥</div>
      <h2>Dziękujemy!</h2>
      <p>{message}</p>
      <Link className="btn w-full" href={galleryUrl}>Zobacz galerię</Link>
    </section>;
  }

  return <form action={submit} className="card upload-card space-y-5">
    <div className="form-intro"><h2>Dodaj zdjęcia do wspólnej galerii</h2><p>Wpisz imię, wybierz ulubione kadry i wyślij je jednym kliknięciem.</p></div>
    <div><label htmlFor="guestName">Imię gościa</label><input id="guestName" required name="guestName" value={guestName} onChange={(e)=>setGuestName(e.target.value)} placeholder="np. Kasia" /></div>
    {!initialCode && <div><label htmlFor="accessCode">Kod z zaproszenia</label><input id="accessCode" required name="accessCode" value={accessCode} onChange={(e)=>setAccessCode(e.target.value)} placeholder="Wpisz kod" /></div>}
    <div>
      <label htmlFor="photos">Zdjęcia</label>
      <label className="upload-zone" htmlFor="photos">
        <span className="upload-icon">⌁</span>
        <strong>Wybierz zdjęcia z telefonu</strong>
        <span>Maksymalnie 10 zdjęć</span>
        <small>{fileCount > 0 ? `Wybrano: ${fileCount}` : "JPG, PNG lub WebP, do 10 MB każde"}</small>
      </label>
      <input ref={fileRef} id="photos" className="sr-only" required name="photos" type="file" multiple accept="image/jpeg,image/png,image/webp" onChange={(e)=>setFileCount(e.target.files?.length ?? 0)} />
    </div>
    <label className="consent-row"><input type="checkbox" checked={consent} onChange={(e)=>setConsent(e.target.checked)} /> <span>Wyrażam zgodę na dodanie zdjęć do prywatnej galerii weselnej.</span></label>
    <button disabled={loading || locked} className="btn w-full">{loading ? "Dodawanie..." : "Dodaj zdjęcia"}</button>
    <Link className="btn btn-secondary w-full" href={galleryUrl}>Zobacz galerię zdjęć</Link>
    {error && <p className="error" role="alert">{error}</p>}
  </form>;
}
