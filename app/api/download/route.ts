import { downloadObject, getApprovedPhoto, getEventBySlug } from "@/lib/supabase/admin";
import { verifyGuestCode } from "@/lib/security/hash";

function safeFilename(value: unknown, fallback: string) {
  const rawName = String(value ?? "").split(/[\\/]/).pop()?.trim() || fallback;
  const filename = rawName.replace(/[^a-zA-Z0-9._-]+/g, "_").replace(/^_+|_+$/g, "");
  return filename || fallback;
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const slug = searchParams.get("slug") ?? "";
    const code = searchParams.get("code") ?? "";
    const photoId = searchParams.get("id") ?? "";
    const event = await getEventBySlug(slug);

    if (!event || !verifyGuestCode(code, event)) {
      return new Response("Niepoprawny kod.", { status: 401 });
    }

    const photo = await getApprovedPhoto(event.id, photoId);
    if (!photo) return new Response("Nie znaleziono zdjęcia.", { status: 404 });

    const objectResponse = await downloadObject(String(photo.storage_path));
    const fallbackName = `wedding-photo-${photoId}.jpg`;
    const filename = safeFilename(photo.original_filename, fallbackName);
    const headers = new Headers({
      "Cache-Control": "private, no-store",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Content-Type": objectResponse.headers.get("Content-Type") ?? "image/jpeg",
      "X-Content-Type-Options": "nosniff",
    });
    const contentLength = objectResponse.headers.get("Content-Length");
    if (contentLength) headers.set("Content-Length", contentLength);

    return new Response(objectResponse.body, { headers });
  } catch {
    return new Response("Nie udało się pobrać zdjęcia.", { status: 500 });
  }
}
