import { getOnlyEvent } from "@/lib/supabase/admin";
import { requireAdminUser } from "@/lib/supabase/server";

async function guard() {
  return Boolean(await requireAdminUser());
}

export async function GET() {
  if (!(await guard())) return Response.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const event = await getOnlyEvent();
    if (!event) return Response.json({ error: "Nie udało się znaleźć wydarzenia." }, { status: 404 });

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
