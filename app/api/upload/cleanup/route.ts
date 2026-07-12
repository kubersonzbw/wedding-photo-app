import { deleteGuest, getEventBySlug, guestHasPhotos, photoExistsByStoragePath, removeObjects } from "@/lib/supabase/admin";
import { verifyGuestCode } from "@/lib/security/hash";

function normalizeStoragePaths(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map((path) => String(path ?? "").trim()).filter(Boolean).slice(0, 10);
}

export async function POST(request: Request) {
  try {
    const { slug, accessCode, guestId, storagePaths: rawStoragePaths } = await request.json();
    const code = String(accessCode ?? "").trim();
    const guest = String(guestId ?? "").trim();
    const storagePaths = normalizeStoragePaths(rawStoragePaths);

    if (!slug || !code || !guest) return Response.json({ error: "Uzupełnij wymagane pola." }, { status: 400 });

    const event = await getEventBySlug(String(slug));
    if (!event || !verifyGuestCode(code, event)) return Response.json({ error: "Niepoprawny kod weselny." }, { status: 401 });

    const expectedPrefix = `${event.id}/${guest}/`;
    if (storagePaths.some((path) => !path.startsWith(expectedPrefix))) {
      return Response.json({ error: "Nieprawidłowe dane przesłanego zdjęcia." }, { status: 400 });
    }

    const unregisteredPaths = [];
    for (const path of storagePaths) {
      if (!(await photoExistsByStoragePath(path))) unregisteredPaths.push(path);
    }

    await removeObjects(unregisteredPaths);

    if (!(await guestHasPhotos(guest))) {
      await deleteGuest(guest);
    }

    return Response.json({ ok: true, removed: unregisteredPaths.length });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Nie udało się posprzątać nieudanego uploadu." }, { status: 500 });
  }
}
