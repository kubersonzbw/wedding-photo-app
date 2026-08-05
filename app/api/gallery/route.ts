import { approvedPhotos, countApprovedPhotos, getEventBySlug } from "@/lib/supabase/admin";
import { verifyGuestCode } from "@/lib/security/hash";
import { checkRateLimit } from "@/lib/security/rate-limit";
import { previewPathForStoragePath, thumbnailPathForStoragePath } from "@/lib/photos/thumbnails";
import { objectExists, signedUrl } from "@/lib/storage/backblaze";

const GALLERY_SIGNED_URL_EXPIRES_IN = 900;

function optionalPath(value: unknown) {
  const path = String(value ?? "").trim();
  return path || undefined;
}

async function toGalleryPhoto(photo: Record<string, unknown>) {
  try {
    const path = String(photo.storage_path ?? "").trim();
    if (!path) return null;

    const mimeType = String(photo.mime_type ?? "");
    const mediaType = mimeType.startsWith("video/") ? "video" : "image";
    const storedThumbnailPath = optionalPath(photo.thumbnail_path);

    if (mediaType === "image") {
      const thumbnailPath = storedThumbnailPath ?? thumbnailPathForStoragePath(path);
      const previewPath = optionalPath(photo.preview_path) ?? previewPathForStoragePath(path);
      const [thumbnailUrl, previewUrl] = await Promise.all([
        signedUrl(thumbnailPath, GALLERY_SIGNED_URL_EXPIRES_IN),
        signedUrl(previewPath, GALLERY_SIGNED_URL_EXPIRES_IN),
      ]);

      return {
        id: photo.id,
        url: previewUrl,
        thumbnailUrl,
        previewUrl,
        mediaType,
        mimeType,
        guestName: (photo.guests as { name?: string } | undefined)?.name,
        createdAt: photo.created_at,
      };
    }

    const thumbnailPath = storedThumbnailPath && await objectExists(storedThumbnailPath).catch(() => false)
      ? storedThumbnailPath
      : undefined;
    const [url, thumbnailUrl] = await Promise.all([
      signedUrl(path, GALLERY_SIGNED_URL_EXPIRES_IN),
      thumbnailPath ? signedUrl(thumbnailPath, GALLERY_SIGNED_URL_EXPIRES_IN) : Promise.resolve(undefined),
    ]);

    return {
      id: photo.id,
      url,
      thumbnailUrl,
      previewUrl: undefined,
      mediaType,
      mimeType,
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
    const limit = Math.min(Math.max(Number(requestedLimit) || 30, 1), 120);
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
