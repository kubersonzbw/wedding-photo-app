"use client";
import { useState } from "react";
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
      setMessage("Dziękujemy! Zdjęcia zostały dodane i czekają na zatwierdzenie ❤️");
      setGuestName("");
    } catch (e) { setError(e instanceof Error ? e.message : "Wystąpił błąd."); }
    finally { setLoading(false); }
  }

  return <form action={submit} className="card space-y-5">
    <div><label>Imię gościa</label><input required name="guestName" value={guestName} onChange={(e)=>setGuestName(e.target.value)} placeholder="np. Kasia" /></div>
    {!initialCode && <div><label>Kod z zaproszenia</label><input required name="accessCode" value={accessCode} onChange={(e)=>setAccessCode(e.target.value)} /></div>}
    <div><label>Zdjęcia (maks. 10, JPG/PNG/WebP, do 10 MB)</label><input required name="photos" type="file" multiple accept="image/jpeg,image/png,image/webp" /></div>
    <label className="flex gap-3 text-sm"><input type="checkbox" checked={consent} onChange={(e)=>setConsent(e.target.checked)} /> Wyrażam zgodę na dodanie zdjęć do prywatnej galerii weselnej.</label>
    <button disabled={loading || locked} className="btn w-full">{loading ? "Dodawanie..." : "Dodaj zdjęcia"}</button>
    {message && <p className="success">{message}</p>}{error && <p className="error">{error}</p>}
  </form>;
}
