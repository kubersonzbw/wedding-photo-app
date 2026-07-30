import { approvedPhotoById, getEventBySlug } from "@/lib/supabase/admin";
import { verifyGuestCode } from "@/lib/security/hash";
import { signedDownloadUrl } from "@/lib/storage/backblaze";

const DOWNLOAD_SIGNED_URL_EXPIRES_IN = 120;

function filenameForPhoto(photo: Record<string, unknown>) {
  const original = String(photo.original_filename ?? "").trim();
  if (original) return original.replace(/[^\w .()+,\-[\]]+/g, "_").slice(0, 160);

  const path = String(photo.storage_path ?? "");
  const fallback = path.split("/").pop()?.trim();
  return fallback || "wspomnienie";
}

export async function POST(request: Request) {
  try {
    const { slug, galleryCode, guestCode, photoId } = await request.json();
    const code = String(guestCode ?? galleryCode ?? "").trim();
    const id = String(photoId ?? "").trim();

    if (!slug || !code || !id) return Response.json({ error: "Uzupełnij wymagane dane." }, { status: 400 });

    const event = await getEventBySlug(String(slug));
    if (!event || !verifyGuestCode(code, event)) return Response.json({ error: "Niepoprawny kod." }, { status: 401 });

    const photo = await approvedPhotoById(event.id, id);
    const storagePath = String(photo?.storage_path ?? "").trim();
    if (!photo || !storagePath) return Response.json({ error: "Nie znaleziono pliku." }, { status: 404 });

    const filename = filenameForPhoto(photo);
    const url = await signedDownloadUrl(storagePath, filename, DOWNLOAD_SIGNED_URL_EXPIRES_IN);
    return Response.json({
      url,
      filename,
      mimeType: String(photo.mime_type ?? ""),
      sizeBytes: Number(photo.size_bytes ?? 0),
    });
  } catch {
    return Response.json({ error: "Nie udało się przygotować pobierania." }, { status: 500 });
  }
}
