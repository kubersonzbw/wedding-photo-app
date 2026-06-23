import { listPhotos, removeObject, signedUrl, updatePhotoStatus } from "@/lib/supabase/admin";
import { requireAdminUser } from "@/lib/supabase/server";

async function guard() { return Boolean(await requireAdminUser()); }
export async function GET(request: Request) {
  if (!(await guard())) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const status = new URL(request.url).searchParams.get("status") ?? "all";
  const rows = await listPhotos(status);
  const photos = await Promise.all(rows.map(async (p: Record<string, unknown>) => ({ ...p, url: await signedUrl(String(p.storage_path), 120) })));
  return Response.json({ photos });
}
export async function PATCH(request: Request) {
  if (!(await guard())) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const { id, status, storagePath } = await request.json();
  if (status === "deleted" && storagePath) await removeObject(storagePath);
  await updatePhotoStatus(id, status);
  return Response.json({ ok: true });
}
