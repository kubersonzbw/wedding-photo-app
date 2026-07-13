import { getEventBySlug, insertPhotos } from "@/lib/supabase/admin";
import { verifyGuestCode } from "@/lib/security/hash";
import { validatePhotoFileInfoList, type PhotoFileInfo } from "@/lib/photos/validation";
import { createAndStoreImageThumbnail, isThumbnailSupported, thumbnailPathForStoragePath } from "@/lib/photos/thumbnails";
import { objectExists } from "@/lib/storage/backblaze";

type CompletedUpload = PhotoFileInfo & {
  photoId: string;
  storagePath: string;
};

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
    const { slug, accessCode, guestId, uploads: rawUploads } = await request.json();
    const code = String(accessCode ?? "").trim();
    const uploads = normalizeUploads(rawUploads);

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

      if (isThumbnailSupported(upload.type) && !(await objectExists(thumbnailPathForStoragePath(upload.storagePath)).catch(() => false))) {
        await createAndStoreImageThumbnail(upload.storagePath, upload.type);
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
      status: "approved",
    }));

    const inserted = await insertPhotos(photoRows);
    return Response.json({ ok: true, count: inserted.length });
  } catch (error) {
    if (error instanceof UploadCompleteError) return Response.json({ error: error.message }, { status: error.status });
    return Response.json({ error: error instanceof Error ? error.message : "Nie udało się zapisać zdjęć w galerii." }, { status: 500 });
  }
}
