import { inngest } from "@/lib/inngest/client";
import { UPLOAD_BATCH_COMPLETED_EVENT, type CompletedUploadEventFile, type UploadNotificationPayload } from "@/lib/inngest/events";
import { getEventBySlug, insertPhotos } from "@/lib/supabase/admin";
import { verifyGuestCode } from "@/lib/security/hash";
import { validatePhotoFileInfoList } from "@/lib/photos/validation";
import { objectExists } from "@/lib/storage/backblaze";

type CompletedUpload = CompletedUploadEventFile;

class UploadCompleteError extends Error {
  constructor(message: string, public status = 400) {
    super(message);
  }
}

const COMPLETE_CONCURRENCY = Number(process.env.UPLOAD_COMPLETE_CONCURRENCY ?? 5);

function normalizeUploads(value: unknown): CompletedUpload[] {
  if (!Array.isArray(value)) return [];
  return value.map((file) => {
    const item = file as Partial<CompletedUpload>;
    return {
      photoId: String(item.photoId ?? ""),
      storagePath: String(item.storagePath ?? ""),
      name: String(item.name ?? ""),
      type: String(item.type ?? ""),
      size: Number(item.size ?? 0),
    };
  });
}

function normalizeNotification(value: unknown): UploadNotificationPayload | null {
  if (!value || typeof value !== "object") return null;
  const item = value as Partial<UploadNotificationPayload>;
  const totalCount = Math.max(0, Math.floor(Number(item.totalCount) || 0));
  const imageCount = Math.max(0, Math.floor(Number(item.imageCount) || 0));
  const videoCount = Math.max(0, Math.floor(Number(item.videoCount) || 0));
  if (totalCount < 1) return null;
  return {
    totalCount,
    imageCount: Math.min(imageCount, totalCount),
    videoCount: Math.min(videoCount, totalCount),
  };
}

function requestOrigin(request: Request) {
  const origin = request.headers.get("origin");
  if (origin) return origin;

  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  const proto = request.headers.get("x-forwarded-proto") ?? "https";
  return host ? `${proto}://${host}` : "";
}

async function runWithConcurrency<T>(items: T[], limit: number, task: (item: T) => Promise<void>) {
  let nextIndex = 0;
  const workers = Array.from({ length: Math.min(Math.max(limit, 1), items.length) }, async () => {
    while (nextIndex < items.length) {
      const index = nextIndex;
      nextIndex += 1;
      await task(items[index]);
    }
  });

  await Promise.all(workers);
}

export async function POST(request: Request) {
  try {
    const { slug, accessCode, guestId, uploads: rawUploads, notification: rawNotification } = await request.json();
    const code = String(accessCode ?? "").trim();
    const uploads = normalizeUploads(rawUploads);
    const notification = normalizeNotification(rawNotification);

    if (!slug || !code || !guestId) return Response.json({ error: "Uzupełnij wymagane pola." }, { status: 400 });
    const validation = validatePhotoFileInfoList(uploads);
    if (validation) return Response.json({ error: validation }, { status: 400 });

    const event = await getEventBySlug(String(slug));
    if (!event || !verifyGuestCode(code, event)) return Response.json({ error: "Niepoprawny kod weselny." }, { status: 401 });

    for (const upload of uploads) {
      if (!upload.photoId || !upload.storagePath.startsWith(`${event.id}/${guestId}/`)) {
        return Response.json({ error: "Nieprawidłowe dane przesłanego zdjęcia." }, { status: 400 });
      }
    }

    await runWithConcurrency(uploads, COMPLETE_CONCURRENCY, async (upload) => {
      if (!(await objectExists(upload.storagePath))) {
        throw new UploadCompleteError("Nie udało się potwierdzić przesłanego zdjęcia.");
      }
    });

    const photoRows = uploads.map((upload) => ({
      id: upload.photoId,
      event_id: event.id,
      guest_id: guestId,
      storage_path: upload.storagePath,
      original_filename: upload.name,
      mime_type: upload.type,
      size_bytes: upload.size,
      status: "pending",
    }));

    const inserted = await insertPhotos(photoRows);
    const batchId = crypto.randomUUID();
    const origin = requestOrigin(request);
    await inngest.send({
      id: `upload-batch-${batchId}`,
      name: UPLOAD_BATCH_COMPLETED_EVENT,
      data: {
        batchId,
        eventId: String(event.id),
        slug: String(slug),
        guestId: String(guestId),
        eventTitle: String(event.title ?? ""),
        galleryUrl: `${origin}/gallery/${encodeURIComponent(String(slug))}?code=${encodeURIComponent(code)}`,
        uploads,
        notification,
      },
    });

    return Response.json({ ok: true, count: inserted.length });
  } catch (error) {
    if (error instanceof UploadCompleteError) return Response.json({ error: error.message }, { status: error.status });
    return Response.json({ error: error instanceof Error ? error.message : "Nie udało się zapisać zdjęć w galerii." }, { status: 500 });
  }
}
