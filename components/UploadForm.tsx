"use client";
import Link from "next/link";
import type { FormEvent } from "react";
import { useRef, useState } from "react";
import { galleryHref } from "@/lib/events/config";
import { validatePhotoList } from "@/lib/photos/validation";
import BrokenHeartIcon from "@/components/BrokenHeartIcon";
import UploadDropzone from "@/components/UploadDropzone";

type UploadStartResponse = {
  guestId: string;
  uploads: Array<{
    photoId: string;
    storagePath: string;
    signedUrl: string;
    originalFilename: string;
    mimeType: string;
    sizeBytes: number;
    thumbnailStoragePath?: string;
    signedThumbnailUrl?: string;
  }>;
};

class UserVisibleError extends Error {}
const UPLOAD_BATCH_SIZE = 10;
const UPLOAD_CONCURRENCY = 3;
const THUMBNAIL_WIDTH = 640;
const THUMBNAIL_QUALITY = 0.72;

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

function chunkFiles(files: File[], size: number) {
  const chunks: File[][] = [];
  for (let index = 0; index < files.length; index += size) chunks.push(files.slice(index, index + size));
  return chunks;
}

async function runWithConcurrency<T>(items: T[], limit: number, task: (item: T, index: number) => Promise<void>) {
  let nextIndex = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (nextIndex < items.length) {
      const index = nextIndex;
      nextIndex += 1;
      await task(items[index], index);
    }
  });

  await Promise.all(workers);
}

function isVideoFile(file: File) {
  return file.type.startsWith("video/");
}

function isImageFile(file: File) {
  return file.type.startsWith("image/");
}

function canvasToJpegBlob(canvas: HTMLCanvasElement) {
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error("Nie udało się przygotować miniatury."));
    }, "image/jpeg", THUMBNAIL_QUALITY);
  });
}

function scaledThumbnailSize(width: number, height: number) {
  const safeWidth = Math.max(width, 1);
  const safeHeight = Math.max(height, 1);
  const scale = THUMBNAIL_WIDTH / safeWidth;
  return {
    width: Math.min(THUMBNAIL_WIDTH, safeWidth),
    height: Math.max(1, Math.round(safeHeight * Math.min(scale, 1))),
  };
}

function waitForVideoEvent(video: HTMLVideoElement, eventName: keyof HTMLMediaElementEventMap) {
  return new Promise<void>((resolve, reject) => {
    const cleanup = () => {
      video.removeEventListener(eventName, onEvent);
      video.removeEventListener("error", onError);
    };
    const onEvent = () => {
      cleanup();
      resolve();
    };
    const onError = () => {
      cleanup();
      reject(new Error("Nie udało się przygotować miniatury filmu."));
    };

    video.addEventListener(eventName, onEvent, { once: true });
    video.addEventListener("error", onError, { once: true });
  });
}

async function createVideoThumbnail(file: File) {
  const objectUrl = URL.createObjectURL(file);
  const video = document.createElement("video");

  try {
    video.preload = "metadata";
    video.muted = true;
    video.playsInline = true;
    video.src = objectUrl;

    await waitForVideoEvent(video, "loadedmetadata");
    video.currentTime = Math.min(0.25, Math.max(0, (video.duration || 1) / 10));
    await waitForVideoEvent(video, "seeked");

    const { width, height } = scaledThumbnailSize(video.videoWidth || THUMBNAIL_WIDTH, video.videoHeight || THUMBNAIL_WIDTH);
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Nie udało się przygotować miniatury filmu.");
    context.drawImage(video, 0, 0, width, height);
    return await canvasToJpegBlob(canvas);
  } finally {
    video.removeAttribute("src");
    video.load();
    URL.revokeObjectURL(objectUrl);
  }
}

async function createImageThumbnail(file: File) {
  const image = await createImageBitmap(file);
  try {
    const { width, height } = scaledThumbnailSize(image.width, image.height);
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Nie udało się przygotować miniatury zdjęcia.");
    context.drawImage(image, 0, 0, width, height);
    return await canvasToJpegBlob(canvas);
  } finally {
    image.close();
  }
}

async function uploadSignedFile(file: File, upload: UploadStartResponse["uploads"][number]) {
  const uploadRes: Response = await fetch(upload.signedUrl, {
    method: "PUT",
    headers: { "Content-Type": file.type },
    body: file,
  });

  if (!uploadRes.ok) throw new Error("Nie udało się przesłać pliku do galerii.");

  if ((isImageFile(file) || isVideoFile(file)) && upload.signedThumbnailUrl) {
    try {
      const thumbnail = isVideoFile(file) ? await createVideoThumbnail(file) : await createImageThumbnail(file);
      const thumbnailRes: Response = await fetch(upload.signedThumbnailUrl, {
        method: "PUT",
        headers: { "Content-Type": "image/jpeg" },
        body: thumbnail,
      });

      if (!thumbnailRes.ok) throw new Error("Nie udało się przesłać miniatury.");
    } catch (thumbnailError) {
      console.warn("Nie udało się przygotować miniatury.", thumbnailError);
    }
  }
}

function isNetworkError(error: unknown) {
  if (!(error instanceof Error)) return true;
  if (error instanceof TypeError) return true;
  return /fetch|network|load failed/i.test(`${error.name} ${error.message}`);
}

function uploadErrorMessage(error: unknown, guestId: string | null) {
  if (error instanceof UserVisibleError) return error.message;
  if (guestId || isNetworkError(error)) return "Nie udało się dodać plików. Spróbuj ponownie.";
  return "Nie udało się dodać plików. Spróbuj ponownie.";
}

export default function UploadForm({ slug, initialCode = "", locked = false }: { slug: string; initialCode?: string; locked?: boolean }) {
  const [guestName, setGuestName] = useState("");
  const [accessCode, setAccessCode] = useState(initialCode);
  const [codeConfirmed, setCodeConfirmed] = useState(Boolean(initialCode));
  const [consent, setConsent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [uploadedCount, setUploadedCount] = useState(0);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(locked ? "Ten link wygląda na nieprawidłowy. Poproś parę młodą o poprawny kod." : null);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [retryPending, setRetryPending] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const galleryUrl = galleryHref(slug, accessCode.trim() || undefined);
  const submitLabel = loading ? "Dodajemy pliki…" : retryPending && selectedFiles.length > 0 ? "Ponów wysyłanie" : "Dodaj pliki";

  function handleFilesChange(files: File[]) {
    setSelectedFiles(files);
    setUploadedCount(0);
    setError(null);
    setRetryPending(false);
  }

  async function submit() {
    let guestId: string | null = null;
    let pendingStoragePaths: string[] = [];
    let completedCount = 0;
    const totalCount = selectedFiles.length;
    setLoading(true); setUploadedCount(0); setError(null); setSuccess(false); setRetryPending(false);
    try {
      if (!guestName.trim()) throw new UserVisibleError("Podaj swoje imię, żebyśmy wiedzieli, kto dodał zdjęcia.");
      if (!accessCode.trim()) throw new UserVisibleError("Wpisz kod weselny, aby dodać zdjęcia.");
      if (!consent) throw new UserVisibleError("Zaznacz zgodę, aby dodać pliki do wspólnej galerii.");
      const validation = validatePhotoList(selectedFiles);
      if (validation) throw new UserVisibleError(validation);
      for (const batch of chunkFiles(selectedFiles, UPLOAD_BATCH_SIZE)) {
        pendingStoragePaths = [];
        const startRes: Response = await fetch("/api/upload/start", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            slug,
            accessCode,
            guestName,
            guestId,
            files: batch.map((file) => ({ name: file.name, type: file.type, size: file.size })),
          }),
        });
        const startData = await readApiResponse<UploadStartResponse>(startRes);
        if (!startRes.ok) {
          if ([400, 401, 429].includes(startRes.status) && startData.error) throw new UserVisibleError(startData.error);
          throw new Error(startData.error ?? "Nie udało się przygotować uploadu.");
        }
        guestId = startData.guestId;

        pendingStoragePaths = startData.uploads.map((upload) => upload.storagePath);
        await runWithConcurrency(startData.uploads, UPLOAD_CONCURRENCY, async (upload, index) => {
          await uploadSignedFile(batch[index], upload);
          setUploadedCount((count) => count + 1);
        });

        const completeRes: Response = await fetch("/api/upload/complete", {
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
        if (!completeRes.ok) throw new Error(completeData.error ?? "Pliki zostały przesłane, ale nie udało się zapisać ich w galerii.");
        completedCount += batch.length;
        setUploadedCount(completedCount);
        pendingStoragePaths = [];
      }

      setCodeConfirmed(true);
      setSuccess(true);
      setGuestName("");
      setConsent(false);
      setSelectedFiles([]);
      setRetryPending(false);
      if (fileRef.current) fileRef.current.value = "";
    } catch (e) {
      if (guestId) {
        await cleanupUpload(slug, accessCode, guestId, pendingStoragePaths).catch(() => null);
      }
      setError(completedCount > 0 && completedCount < totalCount
        ? `Wysłano ${completedCount} z ${totalCount} plików. Część plików nie została dodana. Spróbuj wysłać pozostałe ponownie.`
        : uploadErrorMessage(e, guestId));
      if (completedCount > 0) {
        setSelectedFiles((files) => files.slice(completedCount));
        setRetryPending(true);
        if (fileRef.current) fileRef.current.value = "";
      }
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
      <p>Pliki są już w galerii <span className="success-inline-heart" aria-hidden="true" /></p>
      <div className="success-actions">
        <Link className="btn btn-primary" href={galleryUrl}>Zobacz galerię</Link>
        <button className="btn btn-ghost" onClick={() => setSuccess(false)}>Dodaj kolejne pliki</button>
      </div>
    <div className="heart-divider" aria-hidden="true"><span /><i className="heart-divider-icon" /><span /></div>
    </section>;
  }

  return <form id="upload" onSubmit={handleSubmit} className="upload-card" aria-busy={loading}>
    <div className="card-heading">
      <h2>Dodaj zdjęcia i filmy do wspólnej galerii</h2>
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
    <UploadDropzone fileRef={fileRef} fileCount={selectedFiles.length} uploading={loading} progressLabel={selectedFiles.length > 0 ? `Wysłano ${uploadedCount} / ${selectedFiles.length}` : undefined} onChange={handleFilesChange} />
    <label className="consent-row"><input type="checkbox" checked={consent} onChange={(e)=>setConsent(e.target.checked)} /> <span>Wyrażam zgodę na dodanie zdjęć i filmów do prywatnej galerii weselnej.</span><span className="consent-heart-icon" aria-hidden="true" /></label>
    <button disabled={loading || locked} className="btn btn-primary cta-button"><span className="cta-camera-icon" aria-hidden="true" /><span className="cta-button-label">{submitLabel}</span></button>
    {!loading && <Link className="text-link" href={galleryUrl}>Zobacz galerię</Link>}
  </form>;
}
