import { getEventBySlug } from "@/lib/supabase/admin";
import { verifySecret } from "@/lib/security/hash";

export async function POST(request: Request) {
  try {
    const { slug, accessCode } = await request.json();
    if (!slug || !accessCode) return Response.json({ error: "Brak kodu wydarzenia." }, { status: 400 });
    const event = await getEventBySlug(slug);
    if (!event || !verifySecret(accessCode, event.access_code_hash)) return Response.json({ error: "Niepoprawny kod." }, { status: 401 });
    return Response.json({ ok: true, event: { slug: event.slug, title: event.title } });
  } catch { return Response.json({ error: "Nie udało się zweryfikować wydarzenia." }, { status: 500 }); }
}
