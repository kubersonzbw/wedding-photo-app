"use client";
import Link from "next/link";
import type { FormEvent } from "react";
import { useEffect, useRef, useState } from "react";
import { galleryHref } from "@/lib/events/config";
import { validatePhotoList } from "@/lib/photos/validation";
import BrokenHeartIcon from "@/components/BrokenHeartIcon";
import UploadDropzone from "@/components/UploadDropzone";

type UploadStartResponse = {
  guestId: string;
  uploads: Array<{
    photoId: string;
    storagePath: string;
    uploadMethod?: "single" | "multipart";
    signedUrl?: string;
    originalFilename: string;
    mimeType: string;
    sizeBytes: number;
    thumbnailStoragePath?: string;
    signedThumbnailUrl?: string;
    multipart?: {
      uploadId: string;
      partSize: number;
      parts: Array<{
        partNumber: number;
        signedUrl: string;
      }>;
    };
  }>;
};

type UploadItem = UploadStartResponse["uploads"][number];
type PendingMultipartUpload = {
  storagePath: string;
  uploadId: string;
};
type UploadContext = {
  slug: string;
  accessCode: string;
  guestId: string;
};

class UserVisibleError extends Error {}
class UploadStepError extends Error {
  constructor(message: string, public stage: string) {
    super(message);
  }
}
const UPLOAD_BATCH_SIZE = 10;
const UPLOAD_CONCURRENCY = 3;
const MULTIPART_PART_CONCURRENCY = 3;
const UPLOAD_RETRY_ATTEMPTS = 3;
const UPLOAD_API_RETRY_ATTEMPTS = 5;
const UPLOAD_API_RETRY_BASE_DELAY_MS = 800;
const RESUME_WARMUP_AFTER_MS = 2 * 60 * 1000;
const PROXY_IMAGE_FALLBACK_MAX_BYTES = 4 * 1024 * 1024;
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

async function reportUploadClientError({
  slug,
  guestId,
  stage,
  error,
  files,
  uploadedCount,
  totalCount,
}: {
  slug: string;
  guestId: string | null;
  stage: string;
  error: unknown;
  files: File[];
  uploadedCount: number;
  totalCount: number;
}) {
  const item = error instanceof Error ? error : null;
  await fetch("/api/upload/client-error", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      slug,
      guestId,
      stage,
      errorName: item?.name ?? typeof error,
      message: item?.message ?? String(error ?? "Unknown upload error"),
      uploadedCount,
      totalCount,
      online: typeof navigator === "undefined" ? true : navigator.onLine,
      userAgent: typeof navigator === "undefined" ? "" : navigator.userAgent,
      pageOrigin: typeof window === "undefined" ? "" : window.location.origin,
      pageHref: typeof window === "undefined" ? "" : window.location.href,
      files: files.map((file) => ({ name: file.name, type: file.type, size: file.size })),
    }),
  }).catch(() => null);
}

async function abortMultipartUpload(context: UploadContext, upload: PendingMultipartUpload) {
  await fetch("/api/upload/multipart/abort", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      slug: context.slug,
      accessCode: context.accessCode,
      guestId: context.guestId,
      storagePath: upload.storagePath,
      uploadId: upload.uploadId,
    }),
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

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function waitForOnline() {
  if (typeof navigator === "undefined" || navigator.onLine) return Promise.resolve();

  return new Promise<void>((resolve) => {
    window.addEventListener("online", () => resolve(), { once: true });
  });
}

function isRetryableStatus(status: number) {
  return status === 408 || status === 429 || status >= 500;
}

async function fetchWithRetry(input: RequestInfo | URL, init: RequestInit, attempts = UPLOAD_RETRY_ATTEMPTS, baseDelayMs = 450) {
  let lastError: unknown = null;

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      await waitForOnline();
      const response = await fetch(input, init);
      if (response.ok || !isRetryableStatus(response.status) || attempt === attempts) return response;
    } catch (error) {
      lastError = error;
      if (attempt === attempts) throw error;
    }

    await waitForOnline();
    await sleep(baseDelayMs * attempt);
  }

  throw lastError instanceof Error ? lastError : new Error("Nie udało się połączyć z internetem.");
}

async function fetchUploadApiWithRetry(input: RequestInfo | URL, init: RequestInit, networkStage: string) {
  try {
    return await fetchWithRetry(input, { cache: "no-store", ...init }, UPLOAD_API_RETRY_ATTEMPTS, UPLOAD_API_RETRY_BASE_DELAY_MS);
  } catch (error) {
    throw new UploadStepError(error instanceof Error ? error.message : "Nie udało się połączyć z serwerem.", networkStage);
  }
}

async function warmUploadApi(slug: string, accessCode: string) {
  const res = await fetchUploadApiWithRetry("/api/validate-event", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ slug, accessCode }),
  }, "resume-warmup-network");
  const data = await readApiResponse<{ ok: boolean }>(res);
  if (!res.ok) throw new UserVisibleError(data.error ?? "Nie udało się odświeżyć dostępu do wydarzenia.");
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

async function uploadThumbnail(file: File, upload: UploadItem) {
  if ((!isImageFile(file) && !isVideoFile(file)) || !upload.signedThumbnailUrl) return;

  try {
    const thumbnail = isVideoFile(file) ? await createVideoThumbnail(file) : await createImageThumbnail(file);
    const thumbnailRes: Response = await fetchWithRetry(upload.signedThumbnailUrl, {
      method: "PUT",
      headers: { "Content-Type": "image/jpeg" },
      body: thumbnail,
    });

    if (!thumbnailRes.ok) throw new UploadStepError(`Miniatura nie przeszła do Backblaze. Status: ${thumbnailRes.status}.`, "thumbnail-put");
  } catch (thumbnailError) {
    console.warn("Nie udało się przygotować miniatury.", thumbnailError);
  }
}

async function completeMultipartUpload(context: UploadContext, upload: UploadItem, parts: Array<{ partNumber: number; etag: string }>) {
  const completeRes = await fetchUploadApiWithRetry("/api/upload/multipart/complete", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      slug: context.slug,
      accessCode: context.accessCode,
      guestId: context.guestId,
      storagePath: upload.storagePath,
      uploadId: upload.multipart?.uploadId,
      parts,
    }),
  }, "multipart-complete-network");
  const completeData = await readApiResponse<{ ok: boolean }>(completeRes);
  if (!completeRes.ok) throw new UploadStepError(completeData.error ?? "Nie udało się zakończyć uploadu filmu.", "multipart-complete");
}

async function uploadMultipartFile(file: File, upload: UploadItem, context: UploadContext) {
  if (!upload.multipart) throw new Error("Brakuje danych uploadu filmu.");

  const uploadedParts: Array<{ partNumber: number; etag: string }> = [];
  await runWithConcurrency(upload.multipart.parts, MULTIPART_PART_CONCURRENCY, async (part) => {
    const start = (part.partNumber - 1) * upload.multipart!.partSize;
    const end = Math.min(start + upload.multipart!.partSize, file.size);
    const body = file.slice(start, end);
    const partRes = await fetchWithRetry(part.signedUrl, {
      method: "PUT",
      body,
    });

    if (!partRes.ok) throw new UploadStepError(`Część filmu nie przeszła do Backblaze. Status: ${partRes.status}.`, "multipart-part-put");
    const etag = partRes.headers.get("ETag");
    if (!etag) throw new UploadStepError("Nie udało się potwierdzić części filmu. Sprawdź CORS Backblaze dla nagłówka ETag.", "multipart-part-etag");
    uploadedParts.push({ partNumber: part.partNumber, etag });
  });

  await completeMultipartUpload(context, upload, uploadedParts);
}

async function uploadSingleFileViaProxy(file: File, upload: UploadItem, context: UploadContext) {
  const formData = new FormData();
  formData.set("slug", context.slug);
  formData.set("accessCode", context.accessCode);
  formData.set("guestId", context.guestId);
  formData.set("storagePath", upload.storagePath);
  formData.set("file", file, file.name);

  const proxyRes = await fetchWithRetry("/api/upload/proxy", { method: "POST", body: formData });
  const proxyData = await readApiResponse<{ ok: boolean }>(proxyRes);
  if (!proxyRes.ok) throw new UploadStepError(proxyData.error ?? "Nie udało się awaryjnie przesłać zdjęcia.", "single-proxy");
}

async function uploadSingleFile(file: File, upload: UploadItem, context: UploadContext) {
  if (!upload.signedUrl) throw new UploadStepError("Brakuje podpisanego linku uploadu.", "single-missing-signed-url");
  let uploadRes: Response;
  try {
    uploadRes = await fetchWithRetry(upload.signedUrl, {
      method: "PUT",
      headers: { "Content-Type": file.type },
      body: file,
    });
  } catch (error) {
    if (isImageFile(file) && file.size <= PROXY_IMAGE_FALLBACK_MAX_BYTES) {
      await uploadSingleFileViaProxy(file, upload, context);
      return;
    }
    throw new UploadStepError(error instanceof Error ? error.message : "Nie udało się połączyć z Backblaze.", "single-put-network");
  }

  if (!uploadRes.ok) {
    if (isImageFile(file) && file.size <= PROXY_IMAGE_FALLBACK_MAX_BYTES && isRetryableStatus(uploadRes.status)) {
      await uploadSingleFileViaProxy(file, upload, context);
      return;
    }
    throw new UploadStepError(`Plik nie przeszedł do Backblaze. Status: ${uploadRes.status}.`, "single-put-status");
  }
}

async function uploadSignedFile(file: File, upload: UploadItem, context: UploadContext) {
  if (upload.uploadMethod === "multipart") await uploadMultipartFile(file, upload, context);
  else await uploadSingleFile(file, upload, context);

  await uploadThumbnail(file, upload);
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
  const hiddenAtRef = useRef<number | null>(null);
  const needsResumeWarmupRef = useRef(false);
  const galleryUrl = galleryHref(slug, accessCode.trim() || undefined);
  const submitLabel = loading ? "Dodajemy wspomnienia…" : retryPending && selectedFiles.length > 0 ? "Ponów wysyłanie" : "Dodaj wspomnienia";

  useEffect(() => {
    function markNeedsWarmupIfStale() {
      if (hiddenAtRef.current && Date.now() - hiddenAtRef.current >= RESUME_WARMUP_AFTER_MS) {
        needsResumeWarmupRef.current = true;
      }
    }

    function handleVisibilityChange() {
      if (document.visibilityState === "hidden") {
        hiddenAtRef.current = Date.now();
        return;
      }

      markNeedsWarmupIfStale();
    }

    function handlePageShow(event: PageTransitionEvent) {
      const wasDiscarded = "wasDiscarded" in document && Boolean((document as Document & { wasDiscarded?: boolean }).wasDiscarded);
      if (event.persisted || wasDiscarded) needsResumeWarmupRef.current = true;
      markNeedsWarmupIfStale();
    }

    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("focus", markNeedsWarmupIfStale);
    window.addEventListener("pageshow", handlePageShow);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("focus", markNeedsWarmupIfStale);
      window.removeEventListener("pageshow", handlePageShow);
    };
  }, []);

  function handleFilesChange(files: File[]) {
    setSelectedFiles(files);
    setUploadedCount(0);
    setError(null);
    setRetryPending(false);
  }

  async function submit() {
    let guestId: string | null = null;
    let pendingStoragePaths: string[] = [];
    let pendingMultipartUploads: PendingMultipartUpload[] = [];
    let completedCount = 0;
    let currentStage = "idle";
    const totalCount = selectedFiles.length;
    const uploadSummary = {
      totalCount,
      imageCount: selectedFiles.filter(isImageFile).length,
      videoCount: selectedFiles.filter(isVideoFile).length,
    };
    setLoading(true); setUploadedCount(0); setError(null); setSuccess(false); setRetryPending(false);
    try {
      if (!guestName.trim()) throw new UserVisibleError("Podaj swoje imię, żebyśmy wiedzieli, kto dodał zdjęcia.");
      if (!accessCode.trim()) throw new UserVisibleError("Wpisz kod weselny, aby dodać zdjęcia.");
      if (!consent) throw new UserVisibleError("Zaznacz zgodę, aby dodać pliki do wspólnej galerii.");
      const validation = validatePhotoList(selectedFiles);
      if (validation) throw new UserVisibleError(validation);
      if (needsResumeWarmupRef.current) {
        currentStage = "resume-warmup-network";
        await warmUploadApi(slug, accessCode);
        needsResumeWarmupRef.current = false;
      }
      const batches = chunkFiles(selectedFiles, UPLOAD_BATCH_SIZE);
      for (let batchIndex = 0; batchIndex < batches.length; batchIndex += 1) {
        const batch = batches[batchIndex];
        const isLastBatch = batchIndex === batches.length - 1;
        pendingStoragePaths = [];
        currentStage = "start-network";
        const startRes = await fetchUploadApiWithRetry("/api/upload/start", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            slug,
            accessCode,
            guestName,
            guestId,
            files: batch.map((file) => ({ name: file.name, type: file.type, size: file.size })),
          }),
        }, "start-network");
        const startData = await readApiResponse<UploadStartResponse>(startRes);
        if (!startRes.ok) {
          if ([400, 401, 429].includes(startRes.status) && startData.error) throw new UserVisibleError(startData.error);
          throw new UploadStepError(startData.error ?? "Nie udało się przygotować uploadu.", "start");
        }
        guestId = startData.guestId;

        pendingStoragePaths = startData.uploads.map((upload) => upload.storagePath);
        pendingMultipartUploads = startData.uploads
          .filter((upload) => upload.uploadMethod === "multipart" && upload.multipart)
          .map((upload) => ({ storagePath: upload.storagePath, uploadId: upload.multipart!.uploadId }));
        const uploadContext = { slug, accessCode, guestId: startData.guestId };
        await runWithConcurrency(startData.uploads, UPLOAD_CONCURRENCY, async (upload, index) => {
          currentStage = upload.uploadMethod === "multipart" ? "multipart-upload" : "single-upload";
          await uploadSignedFile(batch[index], upload, uploadContext);
          if (upload.uploadMethod === "multipart" && upload.multipart) {
            pendingMultipartUploads = pendingMultipartUploads.filter((pending) => pending.uploadId !== upload.multipart!.uploadId);
          }
          setUploadedCount((count) => count + 1);
        });

        currentStage = "complete-network";
        const completeRes = await fetchUploadApiWithRetry("/api/upload/complete", {
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
            notification: isLastBatch ? uploadSummary : undefined,
          }),
        }, "complete-network");
        const completeData = await readApiResponse<{ count: number }>(completeRes);
        if (!completeRes.ok) throw new UploadStepError(completeData.error ?? "Pliki zostały przesłane, ale nie udało się zapisać ich w galerii.", "complete");
        completedCount += batch.length;
        setUploadedCount(completedCount);
        pendingStoragePaths = [];
        pendingMultipartUploads = [];
      }

      setCodeConfirmed(true);
      setSuccess(true);
      setGuestName("");
      setConsent(false);
      setSelectedFiles([]);
      setRetryPending(false);
      if (fileRef.current) fileRef.current.value = "";
    } catch (e) {
      const stage = e instanceof UploadStepError ? e.stage : currentStage;
      await reportUploadClientError({
        slug,
        guestId,
        stage,
        error: e,
        files: selectedFiles,
        uploadedCount: completedCount,
        totalCount,
      });
      if (guestId) {
        const uploadContext = { slug, accessCode, guestId };
        await Promise.all(pendingMultipartUploads.map((upload) => abortMultipartUpload(uploadContext, upload).catch(() => null)));
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
        <button className="btn btn-ghost" onClick={() => setSuccess(false)}>Dodaj kolejne wspomnienia</button>
      </div>
    <div className="heart-divider" aria-hidden="true"><span /><i className="heart-divider-icon" /><span /></div>
    </section>;
  }

  return <form id="upload" onSubmit={handleSubmit} className="upload-card" aria-busy={loading}>
    <div className="card-heading">
      <h2>Dodaj wspomnienia do wspólnej galerii</h2>
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
