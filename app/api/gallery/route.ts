import { approvedPhotos, getEventBySlug, signedUrl } from "@/lib/supabase/admin";
import { verifyGuestCode } from "@/lib/security/hash";

export async function POST(request: Request) {
  try {
    const { slug, galleryCode, guestCode, limit: requestedLimit, offset: requestedOffset } = await request.json();
    const code = String(guestCode ?? galleryCode ?? "");
    const limit = Math.min(Math.max(Number(requestedLimit) || 30, 1), 60);
    const offset = Math.max(Number(requestedOffset) || 0, 0);
    const event = await getEventBySlug(String(slug ?? ""));
    if (!event || !verifyGuestCode(code, event)) return Response.json({ error: "Niepoprawny kod." }, { status: 401 });
    const rows = await approvedPhotos(event.id, limit + 1, offset);
    const visibleRows = rows.slice(0, limit);
    const photos = await Promise.all(visibleRows.map(async (p: Record<string, unknown>) => {
      const path = String(p.storage_path);
      const [url, thumbnailUrl] = await Promise.all([
        signedUrl(path, 300, { width: 2000, quality: 86, resize: "contain" }),
        signedUrl(path, 300, { width: 700, quality: 76, resize: "contain" }),
      ]);

      return { id: p.id, url, thumbnailUrl, guestName: (p.guests as { name?: string } | undefined)?.name, createdAt: p.created_at };
    }));
    return Response.json({ photos, hasMore: rows.length > limit });
  } catch { return Response.json({ error: "Nie udało się pobrać galerii." }, { status: 500 }); }
}
