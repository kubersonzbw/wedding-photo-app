import { getEventBySlug } from "@/lib/supabase/admin";
import { verifyGuestCode } from "@/lib/security/hash";

export async function POST(request: Request) {
  try {
    const { slug, accessCode, guestCode } = await request.json();
    const code = String(guestCode ?? accessCode ?? "");
    if (!slug || !code) return Response.json({ error: "Brak kodu weselnego." }, { status: 400 });
    const event = await getEventBySlug(slug);
    if (!event || !verifyGuestCode(code, event)) return Response.json({ error: "Niepoprawny kod." }, { status: 401 });
    return Response.json({ ok: true, event: { slug: event.slug, title: event.title } });
  } catch { return Response.json({ error: "Nie udało się zweryfikować wydarzenia." }, { status: 500 }); }
}
