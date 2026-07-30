import { getEventBySlug } from "@/lib/supabase/admin";
import { verifyGuestCode } from "@/lib/security/hash";
import { completeMultipartUpload } from "@/lib/storage/backblaze";

type UploadedPart = {
  partNumber: number;
  etag: string;
};

function normalizeParts(value: unknown): UploadedPart[] {
  if (!Array.isArray(value)) return [];
  return value.map((part) => {
    const item = part as Partial<UploadedPart>;
    return {
      partNumber: Math.floor(Number(item.partNumber) || 0),
      etag: String(item.etag ?? "").trim(),
    };
  }).filter((part) => part.partNumber > 0 && part.etag);
}

export async function POST(request: Request) {
  try {
    const { slug, accessCode, guestId, storagePath, uploadId, parts: rawParts } = await request.json();
    const code = String(accessCode ?? "").trim();
    const guest = String(guestId ?? "").trim();
    const path = String(storagePath ?? "").trim();
    const multipartUploadId = String(uploadId ?? "").trim();
    const parts = normalizeParts(rawParts);

    if (!slug || !code || !guest || !path || !multipartUploadId || parts.length === 0) {
      return Response.json({ error: "Uzupełnij wymagane dane uploadu." }, { status: 400 });
    }

    const event = await getEventBySlug(String(slug));
    if (!event || !verifyGuestCode(code, event)) return Response.json({ error: "Niepoprawny kod weselny." }, { status: 401 });
    if (!path.startsWith(`${event.id}/${guest}/`)) return Response.json({ error: "Nieprawidłowe dane przesłanego filmu." }, { status: 400 });

    await completeMultipartUpload(path, multipartUploadId, parts);
    return Response.json({ ok: true });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Nie udało się zakończyć uploadu filmu." }, { status: 500 });
  }
}
