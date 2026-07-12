import { isLocalDevelopmentDomain, normalizeEventDomain } from "@/lib/events/domain";
import { getEventByDomain, getOnlyEvent } from "@/lib/supabase/admin";

export async function resolveEventByHost(host: string | null) {
  const domain = normalizeEventDomain(host);
  if (!domain) return null;

  const event = await getEventByDomain(domain).catch(() => null);
  if (event) return event;

  if (process.env.NODE_ENV !== "production" && isLocalDevelopmentDomain(domain)) {
    return getOnlyEvent().catch(() => null);
  }

  return null;
}
