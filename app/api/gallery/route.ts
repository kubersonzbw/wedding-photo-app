import { approvedPhotos, countApprovedPhotos, getEventBySlug, signedUrl } from "@/lib/supabase/admin";
import { verifyGuestCode } from "@/lib/security/hash";
import { checkRateLimit } from "@/lib/security/rate-limit";

async function toGalleryPhoto(photo: Record<string, unknown>) {
  try {
    const path = String(photo.storage_path ?? "").trim();
    if (!path) return null;

    const [url, thumbnailUrl] = await Promise.all([
      signedUrl(path, 300, { width: 2000, quality: 86, resize: "contain" }),
      signedUrl(path, 300, { width: 700, quality: 76, resize: "contain" }),
    ]);

    return {
      id: photo.id,
      url,
      thumbnailUrl,
      guestName: (photo.guests as { name?: string } | undefined)?.name,
      createdAt: photo.created_at,
    };
  } catch {
    return null;
  }
}

export async function POST(request: Request) {
  try {
    const { slug, galleryCode, guestCode, limit: requestedLimit, offset: requestedOffset } = await request.json();
    const code = String(guestCode ?? galleryCode ?? "");
    const limit = Math.min(Math.max(Number(requestedLimit) || 30, 1), 60);
    const offset = Math.max(Number(requestedOffset) || 0, 0);
    const ip = request.headers.get("x-forwarded-for")?.split(",")[0] ?? "local";
    if (!checkRateLimit(`gallery:${ip}`, 40, 60000).allowed) {
      return Response.json({ error: "Za dużo prób. Spróbuj ponownie za chwilę." }, { status: 429 });
    }

    const event = await getEventBySlug(String(slug ?? ""));
    if (!event || !verifyGuestCode(code, event)) return Response.json({ error: "Niepoprawny kod." }, { status: 401 });
    const [rows, totalCount] = await Promise.all([
      approvedPhotos(event.id, limit + 1, offset),
      countApprovedPhotos(event.id),
    ]);
    const visibleRows = rows.slice(0, limit);
    const photos = (await Promise.all(visibleRows.map(toGalleryPhoto))).filter((photo) => photo !== null);
    return Response.json({ photos, hasMore: rows.length > limit, totalCount });
  } catch { return Response.json({ error: "Nie udało się pobrać galerii." }, { status: 500 }); }
}
