import { resolveEventByHost } from "@/lib/events/resolve";
import { requireAdminUser } from "@/lib/supabase/server";

async function guard() {
  return Boolean(await requireAdminUser());
}

export async function GET(request: Request) {
  if (!(await guard())) return Response.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
    const event = await resolveEventByHost(host);
    if (!event) return Response.json({ error: "Nie udało się rozpoznać wydarzenia dla tej domeny." }, { status: 404 });

    return Response.json({
      event: {
        slug: event.slug,
        title: event.title,
        domain: event.domain,
      },
    });
  } catch {
    return Response.json({ error: "Nie udało się pobrać wydarzenia." }, { status: 500 });
  }
}
