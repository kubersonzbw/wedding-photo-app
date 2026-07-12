import { createSignedUploadUrl, deleteGuest, getEventBySlug, insertGuest } from "@/lib/supabase/admin";
import { verifyGuestCode } from "@/lib/security/hash";
import { checkRateLimit } from "@/lib/security/rate-limit";
import { validatePhotoFileInfoList, type PhotoFileInfo } from "@/lib/photos/validation";

const EXTENSION_BY_TYPE: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

type UploadStartFile = PhotoFileInfo;

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
    const { slug, accessCode, guestName, files: rawFiles } = await request.json();
    const files = normalizeFiles(rawFiles);
    const name = String(guestName ?? "").trim();
    const code = String(accessCode ?? "").trim();

    if (!slug || !code || !name) return Response.json({ error: "Uzupełnij wymagane pola." }, { status: 400 });
    const validation = validatePhotoFileInfoList(files);
    if (validation) return Response.json({ error: validation }, { status: 400 });

    const ip = request.headers.get("x-forwarded-for")?.split(",")[0] ?? "local";
    if (!checkRateLimit(`upload:${ip}`, undefined, undefined, files.length).allowed) {
      return Response.json({ error: "Limit 30 zdjęć / 10 minut został przekroczony." }, { status: 429 });
    }

    const event = await getEventBySlug(String(slug));
    if (!event || !verifyGuestCode(code, event)) return Response.json({ error: "Niepoprawny kod weselny." }, { status: 401 });

    const guest = await insertGuest(event.id, name);
    try {
      const uploads = await Promise.all(files.map(async (file) => {
        const photoId = crypto.randomUUID();
        const extension = EXTENSION_BY_TYPE[file.type] ?? "jpg";
        const storagePath = `${event.id}/${guest.id}/${photoId}.${extension}`;
        const signed = await createSignedUploadUrl(storagePath);

        return {
          photoId,
          storagePath,
          token: signed.token,
          signedUrl: signed.signedUrl,
          originalFilename: file.name,
          mimeType: file.type,
          sizeBytes: file.size,
        };
      }));

      return Response.json({ ok: true, guestId: guest.id, uploads });
    } catch (error) {
      await deleteGuest(guest.id).catch(() => null);
      throw error;
    }
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Nie udało się przygotować uploadu." }, { status: 500 });
  }
}
