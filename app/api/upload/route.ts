import { getEventBySlug, insertGuest, insertPhoto, uploadObject } from "@/lib/supabase/admin";
import { verifyGuestCode } from "@/lib/security/hash";
import { checkRateLimit } from "@/lib/security/rate-limit";
import { validatePhotoList } from "@/lib/photos/validation";

const EXTENSION_BY_TYPE: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

export async function POST(request: Request) {
  try {
    const form = await request.formData();
    const slug = String(form.get("slug") ?? "");
    const accessCode = String(form.get("accessCode") ?? form.get("guestCode") ?? "");
    const guestName = String(form.get("guestName") ?? "").trim();
    const files = form.getAll("photos").filter((f): f is File => f instanceof File && f.size > 0);
    if (!slug || !accessCode || !guestName) return Response.json({ error: "Uzupełnij wymagane pola." }, { status: 400 });
    const validation = validatePhotoList(files); if (validation) return Response.json({ error: validation }, { status: 400 });
    const ip = request.headers.get("x-forwarded-for")?.split(",")[0] ?? "local";
    if (!checkRateLimit(`upload:${ip}`, undefined, undefined, files.length).allowed) return Response.json({ error: "Limit 30 zdjęć / 10 minut został przekroczony." }, { status: 429 });
    const event = await getEventBySlug(slug);
    if (!event || !verifyGuestCode(accessCode, event)) return Response.json({ error: "Niepoprawny kod weselny." }, { status: 401 });
    const guest = await insertGuest(event.id, guestName);
    const uploaded = [];
    for (const file of files) {
      const photoId = crypto.randomUUID();
      const extension = EXTENSION_BY_TYPE[file.type] ?? "jpg";
      const storagePath = `${event.id}/${guest.id}/${photoId}.${extension}`;
      await uploadObject(storagePath, file, file.type);
      uploaded.push(await insertPhoto({ id: photoId, event_id: event.id, guest_id: guest.id, storage_path: storagePath, original_filename: file.name, mime_type: file.type, size_bytes: file.size, status: "approved" }));
    }
    return Response.json({ ok: true, count: uploaded.length });
  } catch (error) { return Response.json({ error: error instanceof Error ? error.message : "Błąd uploadu." }, { status: 500 }); }
}
