import { approvedPhotos, getEventBySlug, signedUrl } from "@/lib/supabase/admin";
import { verifyGuestCode } from "@/lib/security/hash";

export async function POST(request: Request) {
  try {
    const { slug, galleryCode, guestCode } = await request.json();
    const code = String(guestCode ?? galleryCode ?? "");
    const event = await getEventBySlug(String(slug ?? ""));
    if (!event || !verifyGuestCode(code, event)) return Response.json({ error: "Niepoprawny kod." }, { status: 401 });
    const rows = await approvedPhotos(event.id);
    const photos = await Promise.all(rows.map(async (p: Record<string, unknown>) => ({ id: p.id, url: await signedUrl(String(p.storage_path), 300), guestName: (p.guests as { name?: string } | undefined)?.name, createdAt: p.created_at })));
    return Response.json({ photos });
  } catch { return Response.json({ error: "Nie udało się pobrać galerii." }, { status: 500 }); }
}
