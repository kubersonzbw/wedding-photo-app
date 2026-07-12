import { countPhotos, listPhotos, removeObject, signedUrl, updatePhotoStatus } from "@/lib/supabase/admin";
import { requireAdminUser } from "@/lib/supabase/server";

const PHOTO_STATUSES = ["approved", "hidden", "deleted"] as const;
type PhotoStatus = typeof PHOTO_STATUSES[number];
const ALLOWED_STATUSES = new Set<string>(PHOTO_STATUSES);

async function guard() { return Boolean(await requireAdminUser()); }

function isPhotoStatus(value: string): value is PhotoStatus {
  return ALLOWED_STATUSES.has(value);
}

async function adminCounts() {
  const [all, approved, hidden, deleted] = await Promise.all([
    countPhotos(),
    countPhotos("approved"),
    countPhotos("hidden"),
    countPhotos("deleted"),
  ]);
  return { all, approved, hidden, deleted };
}

export async function GET(request: Request) {
  if (!(await guard())) return Response.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const statusParam = new URL(request.url).searchParams.get("status") ?? "all";
    const status = isPhotoStatus(statusParam) ? statusParam : "all";
    const rows = await listPhotos(status);
    const [photos, counts] = await Promise.all([Promise.all(rows.map(async (p: Record<string, unknown>) => {
      const storagePath = String(p.storage_path ?? "");
      let url = "";
      if (storagePath) {
        url = await signedUrl(storagePath, 120).catch(() => "");
      }
      return { ...p, url };
    })), adminCounts()]);
    return Response.json({ photos, counts });
  } catch {
    return Response.json({ error: "Nie udało się pobrać zdjęć." }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  if (!(await guard())) return Response.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const { id, status, storagePath } = await request.json();
    const nextStatus = String(status ?? "");
    if (!id || !isPhotoStatus(nextStatus)) {
      return Response.json({ error: "Nieprawidłowa akcja." }, { status: 400 });
    }
    if (nextStatus === "deleted" && storagePath) await removeObject(String(storagePath)).catch(() => null);
    await updatePhotoStatus(String(id), nextStatus);
    return Response.json({ ok: true });
  } catch {
    return Response.json({ error: "Nie udało się zapisać zmian." }, { status: 500 });
  }
}
