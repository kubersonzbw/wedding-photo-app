import { countPhotos, deletePhoto, listPhotos, updatePhotoStatus } from "@/lib/supabase/admin";
import { requireAdminUser } from "@/lib/supabase/server";
import { thumbnailPathForStoragePath } from "@/lib/photos/thumbnails";
import { removeObjects, signedUrl } from "@/lib/storage/backblaze";

const PHOTO_STATUSES = ["approved", "hidden"] as const;
type PhotoStatus = typeof PHOTO_STATUSES[number];
const ADMIN_ACTIONS = ["approved", "hidden", "deleted"] as const;
type AdminAction = typeof ADMIN_ACTIONS[number];
const ALLOWED_STATUSES = new Set<string>(PHOTO_STATUSES);
const ALLOWED_ACTIONS = new Set<string>(ADMIN_ACTIONS);

async function guard() { return Boolean(await requireAdminUser()); }

function isPhotoStatus(value: string): value is PhotoStatus {
  return ALLOWED_STATUSES.has(value);
}

function isAdminAction(value: string): value is AdminAction {
  return ALLOWED_ACTIONS.has(value);
}

async function adminCounts() {
  const [all, approved, hidden] = await Promise.all([
    countPhotos(),
    countPhotos("approved"),
    countPhotos("hidden"),
  ]);
  return { all, approved, hidden };
}

export async function GET(request: Request) {
  if (!(await guard())) return Response.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const searchParams = new URL(request.url).searchParams;
    const statusParam = searchParams.get("status") ?? "all";
    const status = isPhotoStatus(statusParam) ? statusParam : "all";
    const limit = Math.min(Math.max(Number(searchParams.get("limit")) || 30, 1), 60);
    const offset = Math.max(Number(searchParams.get("offset")) || 0, 0);
    const rows = await listPhotos(status, limit + 1, offset);
    const visibleRows = rows.slice(0, limit);
    const [photos, counts] = await Promise.all([Promise.all(visibleRows.map(async (p: Record<string, unknown>) => {
      const storagePath = String(p.storage_path ?? "");
      let url = "";
      if (storagePath) {
        url = await signedUrl(storagePath, 120).catch(() => "");
      }
      return { ...p, url };
    })), adminCounts()]);
    return Response.json({ photos, counts, hasMore: rows.length > limit });
  } catch {
    return Response.json({ error: "Nie udało się pobrać zdjęć." }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  if (!(await guard())) return Response.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const { id, status, storagePath } = await request.json();
    const nextStatus = String(status ?? "");
    if (!id || !isAdminAction(nextStatus)) {
      return Response.json({ error: "Nieprawidłowa akcja." }, { status: 400 });
    }
    if (nextStatus === "deleted") {
      if (storagePath) await removeObjects([String(storagePath), thumbnailPathForStoragePath(String(storagePath))]);
      await deletePhoto(String(id));
      return Response.json({ ok: true });
    }
    await updatePhotoStatus(String(id), nextStatus);
    return Response.json({ ok: true });
  } catch {
    return Response.json({ error: "Nie udało się zapisać zmian." }, { status: 500 });
  }
}
