import { deleteGuest, getEventBySlug, getGuestById, insertGuest } from "@/lib/supabase/admin";
import { verifyGuestCode } from "@/lib/security/hash";
import { checkRateLimit } from "@/lib/security/rate-limit";
import { ALLOWED_IMAGE_TYPES, isVideoType, validatePhotoFileInfoList, type PhotoFileInfo } from "@/lib/photos/validation";
import { thumbnailPathForStoragePath } from "@/lib/photos/thumbnails";
import { createSignedUploadUrl } from "@/lib/storage/backblaze";

const EXTENSION_BY_TYPE: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "video/mp4": "mp4",
  "video/quicktime": "mov",
  "video/webm": "webm",
};

type UploadStartFile = PhotoFileInfo;
const UPLOAD_RATE_LIMIT_FILES = Number(process.env.UPLOAD_RATE_LIMIT_PHOTOS ?? 120);
const UPLOAD_RATE_LIMIT_WINDOW_MS = Number(process.env.UPLOAD_RATE_LIMIT_WINDOW_MS ?? 600000);

function normalizeFiles(value: unknown): UploadStartFile[] {
  if (!Array.isArray(value)) return [];
  return value.map((file) => {
    const item = file as Partial<UploadStartFile>;
    return {
      name: String(item.name ?? ""),
      type: String(item.type ?? ""),
      size: Number(item.size ?? 0),
    };
  });
}

export async function POST(request: Request) {
  try {
    const { slug, accessCode, guestName, guestId: rawGuestId, files: rawFiles } = await request.json();
    const files = normalizeFiles(rawFiles);
    const name = String(guestName ?? "").trim();
    const code = String(accessCode ?? "").trim();
    const existingGuestId = String(rawGuestId ?? "").trim();

    if (!slug || !code || !name) return Response.json({ error: "Uzupełnij wymagane pola." }, { status: 400 });
    const validation = validatePhotoFileInfoList(files);
    if (validation) return Response.json({ error: validation }, { status: 400 });

    const ip = request.headers.get("x-forwarded-for")?.split(",")[0] ?? "local";
    if (!checkRateLimit(`upload:${ip}`, UPLOAD_RATE_LIMIT_FILES, UPLOAD_RATE_LIMIT_WINDOW_MS, files.length).allowed) {
      return Response.json({ error: `Limit ${UPLOAD_RATE_LIMIT_FILES} plików / 10 minut został przekroczony.` }, { status: 429 });
    }

    const event = await getEventBySlug(String(slug));
    if (!event || !verifyGuestCode(code, event)) return Response.json({ error: "Niepoprawny kod weselny." }, { status: 401 });

    const guest = existingGuestId ? await getGuestById(event.id, existingGuestId) : await insertGuest(event.id, name);
    if (!guest) return Response.json({ error: "Nie udało się znaleźć gościa dla tego uploadu." }, { status: 400 });
    const createdGuest = !existingGuestId;

    try {
      const uploads = await Promise.all(files.map(async (file) => {
        const photoId = crypto.randomUUID();
        const extension = EXTENSION_BY_TYPE[file.type] ?? "jpg";
        const storagePath = `${event.id}/${guest.id}/${photoId}.${extension}`;
        const [signed, signedThumbnail] = await Promise.all([
          createSignedUploadUrl(storagePath, file.type),
          (isVideoType(file.type) || ALLOWED_IMAGE_TYPES.includes(file.type as (typeof ALLOWED_IMAGE_TYPES)[number]))
            ? createSignedUploadUrl(thumbnailPathForStoragePath(storagePath), "image/jpeg")
            : Promise.resolve(null),
        ]);

        return {
          photoId,
          storagePath,
          signedUrl: signed.signedUrl,
          thumbnailStoragePath: signedThumbnail?.path,
          signedThumbnailUrl: signedThumbnail?.signedUrl,
          originalFilename: file.name,
          mimeType: file.type,
          sizeBytes: file.size,
        };
      }));

      return Response.json({ ok: true, guestId: guest.id, uploads });
    } catch (error) {
      if (createdGuest) await deleteGuest(guest.id).catch(() => null);
      throw error;
    }
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Nie udało się przygotować uploadu." }, { status: 500 });
  }
}
