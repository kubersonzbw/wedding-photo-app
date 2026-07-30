import { getEventBySlug } from "@/lib/supabase/admin";
import { verifyGuestCode } from "@/lib/security/hash";
import { abortMultipartUpload } from "@/lib/storage/backblaze";

export async function POST(request: Request) {
  try {
    const { slug, accessCode, guestId, storagePath, uploadId } = await request.json();
    const code = String(accessCode ?? "").trim();
    const guest = String(guestId ?? "").trim();
    const path = String(storagePath ?? "").trim();
    const multipartUploadId = String(uploadId ?? "").trim();

    if (!slug || !code || !guest || !path || !multipartUploadId) {
      return Response.json({ error: "Uzupełnij wymagane dane uploadu." }, { status: 400 });
    }

    const event = await getEventBySlug(String(slug));
    if (!event || !verifyGuestCode(code, event)) return Response.json({ error: "Niepoprawny kod weselny." }, { status: 401 });
    if (!path.startsWith(`${event.id}/${guest}/`)) return Response.json({ error: "Nieprawidłowe dane przesłanego filmu." }, { status: 400 });

    await abortMultipartUpload(path, multipartUploadId);
    return Response.json({ ok: true });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Nie udało się anulować uploadu filmu." }, { status: 500 });
  }
}
