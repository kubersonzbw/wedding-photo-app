"use client";
import Link from "next/link";
import type { FormEvent } from "react";
import { useRef, useState } from "react";
import { galleryHref } from "@/lib/events/config";
import { validatePhotoList } from "@/lib/photos/validation";
import { createBrowserSupabaseClient } from "@/lib/supabase/browser";
import BrokenHeartIcon from "@/components/BrokenHeartIcon";
import UploadDropzone from "@/components/UploadDropzone";

type UploadStartResponse = {
  guestId: string;
  uploads: Array<{
    photoId: string;
    storagePath: string;
    token: string;
    originalFilename: string;
    mimeType: string;
    sizeBytes: number;
  }>;
};

class UserVisibleError extends Error {}

async function readApiResponse<T>(res: Response): Promise<T & { error?: string }> {
  const responseText = await res.text();
  try {
    return (responseText ? JSON.parse(responseText) : {}) as T & { error?: string };
  } catch {
    return { error: responseText } as T & { error?: string };
  }
}

async function cleanupUpload(slug: string, accessCode: string, guestId: string, storagePaths: string[]) {
  await fetch("/api/upload/cleanup", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ slug, accessCode, guestId, storagePaths }),
  });
}

function isNetworkError(error: unknown) {
  if (!(error instanceof Error)) return true;
  if (error instanceof TypeError) return true;
  return /fetch|network|load failed/i.test(`${error.name} ${error.message}`);
}

function uploadErrorMessage(error: unknown, guestId: string | null) {
  if (error instanceof UserVisibleError) return error.message;
  if (guestId || isNetworkError(error)) return "Nie udało się dodać zdjęć. Spróbuj ponownie.";
  return "Nie udało się dodać zdjęć. Spróbuj ponownie.";
}

export default function UploadForm({ slug, initialCode = "", locked = false }: { slug: string; initialCode?: string; locked?: boolean }) {
  const [guestName, setGuestName] = useState("");
  const [accessCode, setAccessCode] = useState(initialCode);
  const [codeConfirmed, setCodeConfirmed] = useState(Boolean(initialCode));
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
    let guestId: string | null = null;
    const uploadedStoragePaths: string[] = [];
    setLoading(true); setError(null); setSuccess(false);
    try {
      if (!guestName.trim()) throw new UserVisibleError("Podaj swoje imię, żebyśmy wiedzieli, kto dodał zdjęcia.");
      if (!accessCode.trim()) throw new UserVisibleError("Wpisz kod weselny, aby dodać zdjęcia.");
      if (!consent) throw new UserVisibleError("Zaznacz zgodę, aby dodać zdjęcia do wspólnej galerii.");
      const validation = validatePhotoList(selectedFiles);
      if (validation) throw new UserVisibleError(validation);
      const startRes = await fetch("/api/upload/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          slug,
          accessCode,
          guestName,
          files: selectedFiles.map((file) => ({ name: file.name, type: file.type, size: file.size })),
        }),
      });
      const startData = await readApiResponse<UploadStartResponse>(startRes);
      if (!startRes.ok) {
        if ([400, 401, 429].includes(startRes.status) && startData.error) throw new UserVisibleError(startData.error);
        throw new Error(startData.error ?? "Nie udało się przygotować uploadu.");
      }
      guestId = startData.guestId;

      const supabase = createBrowserSupabaseClient();
      for (const [index, upload] of startData.uploads.entries()) {
        const file = selectedFiles[index];
        const { error: uploadError } = await supabase.storage
          .from("wedding-photos")
          .uploadToSignedUrl(upload.storagePath, upload.token, file, { contentType: file.type });

        if (uploadError) throw new Error(uploadError.message || "Nie udało się przesłać zdjęcia do galerii.");
        uploadedStoragePaths.push(upload.storagePath);
      }

      const completeRes = await fetch("/api/upload/complete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          slug,
          accessCode,
          guestId: startData.guestId,
          uploads: startData.uploads.map((upload) => ({
            photoId: upload.photoId,
            storagePath: upload.storagePath,
            name: upload.originalFilename,
            type: upload.mimeType,
            size: upload.sizeBytes,
          })),
        }),
      });
      const completeData = await readApiResponse<{ count: number }>(completeRes);
      if (!completeRes.ok) throw new Error(completeData.error ?? "Zdjęcia zostały przesłane, ale nie udało się zapisać ich w galerii.");
      setCodeConfirmed(true);
      setSuccess(true);
      setGuestName("");
      setConsent(false);
      setSelectedFiles([]);
      if (fileRef.current) fileRef.current.value = "";
    } catch (e) {
      if (guestId) {
        await cleanupUpload(slug, accessCode, guestId, uploadedStoragePaths).catch(() => null);
      }
      setError(uploadErrorMessage(e, guestId));
    }
    finally { setLoading(false); }
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void submit();
  }

  if (success) {
    return <section className="success-state" aria-live="polite">
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

  return <form id="upload" onSubmit={handleSubmit} className="upload-card" aria-busy={loading}>
    <div className="card-heading">
      <h2>Dodaj zdjęcia do wspólnej galerii</h2>
      <p>Wpisz imię, wybierz ulubione kadry i wyślij je jednym kliknięciem.</p>
    </div>
    {error && <p className="error upload-error-top" role="alert">
      <BrokenHeartIcon className="error-broken-heart" />
      <span>{error}</span>
    </p>}
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
    {!codeConfirmed && <div className="floating-field"><label htmlFor="accessCode">Kod weselny</label><input id="accessCode" name="accessCode" value={accessCode} onChange={(e)=>setAccessCode(e.target.value)} placeholder="Wpisz kod weselny" /></div>}
    <UploadDropzone fileRef={fileRef} fileCount={selectedFiles.length} uploading={loading} onChange={handleFilesChange} />
    <label className="consent-row"><input type="checkbox" checked={consent} onChange={(e)=>setConsent(e.target.checked)} /> <span>Wyrażam zgodę na dodanie zdjęć do prywatnej galerii weselnej.</span><span className="consent-heart-icon" aria-hidden="true" /></label>
    <button disabled={loading || locked} className="btn btn-primary cta-button"><span className="cta-camera-icon" aria-hidden="true" /><span className="cta-button-label">{loading ? "Dodajemy zdjęcia…" : "Dodaj zdjęcia"}</span></button>
    {!loading && <Link className="text-link" href={galleryUrl}>Zobacz galerię zdjęć</Link>}
  </form>;
}
