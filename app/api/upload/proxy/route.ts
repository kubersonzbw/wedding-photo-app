import { getEventBySlug, getGuestById } from "@/lib/supabase/admin";
import { verifyGuestCode } from "@/lib/security/hash";
import { checkRateLimit } from "@/lib/security/rate-limit";
import { ALLOWED_IMAGE_TYPES, validateMediaFileInfo } from "@/lib/photos/validation";
import { putObject } from "@/lib/storage/backblaze";

const PROXY_MAX_IMAGE_BYTES = Number(process.env.UPLOAD_PROXY_MAX_IMAGE_BYTES ?? 4 * 1024 * 1024);
const PROXY_RATE_LIMIT_FILES = Number(process.env.UPLOAD_RATE_LIMIT_PHOTOS ?? 120);
const PROXY_RATE_LIMIT_WINDOW_MS = Number(process.env.UPLOAD_RATE_LIMIT_WINDOW_MS ?? 600000);

function field(formData: FormData, name: string) {
  return String(formData.get(name) ?? "").trim();
}

export async function POST(request: Request) {
  try {
    const ip = request.headers.get("x-forwarded-for")?.split(",")[0] ?? "local";
    if (!checkRateLimit(`upload-proxy:${ip}`, PROXY_RATE_LIMIT_FILES, PROXY_RATE_LIMIT_WINDOW_MS).allowed) {
      return Response.json({ error: `Limit ${PROXY_RATE_LIMIT_FILES} plików / 10 minut został przekroczony.` }, { status: 429 });
    }

    const formData = await request.formData();
    const slug = field(formData, "slug");
    const code = field(formData, "accessCode");
    const guestId = field(formData, "guestId");
    const storagePath = field(formData, "storagePath");
    const file = formData.get("file");

    if (!slug || !code || !guestId || !storagePath || !(file instanceof File)) {
      return Response.json({ error: "Uzupełnij wymagane dane uploadu." }, { status: 400 });
    }

    if (!ALLOWED_IMAGE_TYPES.includes(file.type as (typeof ALLOWED_IMAGE_TYPES)[number])) {
      return Response.json({ error: "Awaryjny upload obsługuje tylko zdjęcia." }, { status: 400 });
    }

    if (file.size > PROXY_MAX_IMAGE_BYTES) {
      return Response.json({ error: "Zdjęcie jest za duże dla awaryjnego uploadu. Spróbuj ponownie z innej sieci." }, { status: 413 });
    }

    const validation = validateMediaFileInfo({ name: file.name, type: file.type, size: file.size });
    if (validation) return Response.json({ error: validation }, { status: 400 });

    const event = await getEventBySlug(slug);
    if (!event || !verifyGuestCode(code, event)) return Response.json({ error: "Niepoprawny kod weselny." }, { status: 401 });

    const guest = await getGuestById(event.id, guestId);
    if (!guest) return Response.json({ error: "Nie udało się znaleźć gościa dla tego uploadu." }, { status: 400 });

    if (!storagePath.startsWith(`${event.id}/${guestId}/`)) {
      return Response.json({ error: "Nieprawidłowe dane przesłanego zdjęcia." }, { status: 400 });
    }

    await putObject(storagePath, Buffer.from(await file.arrayBuffer()), file.type);
    return Response.json({ ok: true });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Nie udało się awaryjnie przesłać zdjęcia." }, { status: 500 });
  }
}
