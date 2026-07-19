const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
type PhotoStatus = "approved" | "hidden";

export function assertSupabaseAdminEnv() {
  if (!url || !serviceKey) throw new Error("Missing Supabase server environment variables.");
  return { url, serviceKey };
}

async function supabaseFetch(path: string, init: RequestInit = {}) {
  const env = assertSupabaseAdminEnv();
  const headers = new Headers(init.headers);
  headers.set("apikey", env.serviceKey);
  headers.set("Authorization", `Bearer ${env.serviceKey}`);
  if (!headers.has("Content-Type") && init.body && !(init.body instanceof FormData) && !(init.body instanceof Blob)) headers.set("Content-Type", "application/json");
  const res = await fetch(`${env.url}${path}`, { ...init, headers, cache: "no-store" });
  if (!res.ok) throw new Error(await res.text());
  if (res.status === 204) return null;
  return res.json();
}

export async function getEventBySlug(slug: string) {
  const rows = await supabaseFetch(`/rest/v1/events?slug=eq.${encodeURIComponent(slug)}&select=*`);
  return rows?.[0] ?? null;
}

export async function getEventByDomain(domain: string) {
  const rows = await supabaseFetch(`/rest/v1/events?domain=eq.${encodeURIComponent(domain)}&select=*`);
  return rows?.[0] ?? null;
}

export async function getOnlyEvent() {
  const rows = await supabaseFetch("/rest/v1/events?select=*&order=created_at.asc&limit=2");
  return Array.isArray(rows) && rows.length === 1 ? rows[0] : null;
}

export async function insertGuest(eventId: string, name: string) {
  const rows = await supabaseFetch("/rest/v1/guests?select=*", { method: "POST", headers: { Prefer: "return=representation" }, body: JSON.stringify({ event_id: eventId, name }) });
  return rows[0];
}

export async function getGuestById(eventId: string, guestId: string) {
  const rows = await supabaseFetch(`/rest/v1/guests?id=eq.${encodeURIComponent(guestId)}&event_id=eq.${encodeURIComponent(eventId)}&select=*`);
  return rows?.[0] ?? null;
}

export async function insertPhoto(photo: Record<string, unknown>) {
  const rows = await supabaseFetch("/rest/v1/photos?select=*", { method: "POST", headers: { Prefer: "return=representation" }, body: JSON.stringify(photo) });
  return rows[0];
}

export async function insertPhotos(photos: Array<Record<string, unknown>>) {
  return supabaseFetch("/rest/v1/photos?select=*", { method: "POST", headers: { Prefer: "return=representation" }, body: JSON.stringify(photos) });
}

export async function photoExistsByStoragePath(path: string) {
  const rows = await supabaseFetch(`/rest/v1/photos?storage_path=eq.${encodeURIComponent(path)}&select=id&limit=1`);
  return Array.isArray(rows) && rows.length > 0;
}

export async function guestHasPhotos(guestId: string) {
  const rows = await supabaseFetch(`/rest/v1/photos?guest_id=eq.${encodeURIComponent(guestId)}&select=id&limit=1`);
  return Array.isArray(rows) && rows.length > 0;
}

export async function deleteGuest(guestId: string) {
  return supabaseFetch(`/rest/v1/guests?id=eq.${encodeURIComponent(guestId)}`, { method: "DELETE" });
}

export async function listPhotos(status?: string, limit?: number, offset = 0) {
  const filter = status && status !== "all" ? `&status=eq.${encodeURIComponent(status)}` : "&status=neq.deleted";
  const pagination = limit ? `&limit=${limit}&offset=${offset}` : "";
  return supabaseFetch(`/rest/v1/photos?select=*,guests(name),events(slug,title)&order=created_at.desc${filter}${pagination}`);
}

export async function countPhotos(status?: PhotoStatus) {
  const env = assertSupabaseAdminEnv();
  const filter = status ? `&status=eq.${encodeURIComponent(status)}` : "&status=neq.deleted";
  const res = await fetch(`${env.url}/rest/v1/photos?select=id&limit=1${filter}`, {
    headers: {
      apikey: env.serviceKey,
      Authorization: `Bearer ${env.serviceKey}`,
      Prefer: "count=exact",
      Range: "0-0",
    },
    cache: "no-store",
  });
  if (!res.ok) throw new Error(await res.text());
  const total = Number(res.headers.get("content-range")?.split("/")[1] ?? 0);
  return Number.isFinite(total) ? total : 0;
}

export async function updatePhotoStatus(id: string, status: PhotoStatus) {
  return supabaseFetch(`/rest/v1/photos?id=eq.${encodeURIComponent(id)}`, { method: "PATCH", body: JSON.stringify({ status }) });
}

export async function deletePhoto(id: string) {
  return supabaseFetch(`/rest/v1/photos?id=eq.${encodeURIComponent(id)}`, { method: "DELETE" });
}

export async function approvedPhotos(eventId: string, limit?: number, offset = 0) {
  const pagination = limit ? `&limit=${limit}&offset=${offset}` : "";
  return supabaseFetch(`/rest/v1/photos?event_id=eq.${encodeURIComponent(eventId)}&status=eq.approved&select=*,guests(name)&order=created_at.desc,id.desc${pagination}`);
}

export async function countApprovedPhotos(eventId: string) {
  const env = assertSupabaseAdminEnv();
  const res = await fetch(`${env.url}/rest/v1/photos?event_id=eq.${encodeURIComponent(eventId)}&status=eq.approved&select=id&limit=1`, {
    headers: {
      apikey: env.serviceKey,
      Authorization: `Bearer ${env.serviceKey}`,
      Prefer: "count=exact",
      Range: "0-0",
    },
    cache: "no-store",
  });
  if (!res.ok) throw new Error(await res.text());
  const contentRange = res.headers.get("content-range");
  return Number(contentRange?.split("/")[1] ?? 0);
}
