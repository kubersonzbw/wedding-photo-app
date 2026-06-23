const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

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

export async function insertGuest(eventId: string, name: string) {
  const rows = await supabaseFetch("/rest/v1/guests?select=*", { method: "POST", headers: { Prefer: "return=representation" }, body: JSON.stringify({ event_id: eventId, name }) });
  return rows[0];
}

export async function insertPhoto(photo: Record<string, unknown>) {
  const rows = await supabaseFetch("/rest/v1/photos?select=*", { method: "POST", headers: { Prefer: "return=representation" }, body: JSON.stringify(photo) });
  return rows[0];
}

export async function listPhotos(status?: string) {
  const filter = status && status !== "all" ? `&status=eq.${encodeURIComponent(status)}` : "";
  return supabaseFetch(`/rest/v1/photos?select=*,guests(name),events(slug,title)&order=created_at.desc${filter}`);
}

export async function updatePhotoStatus(id: string, status: "approved" | "hidden" | "deleted") {
  return supabaseFetch(`/rest/v1/photos?id=eq.${encodeURIComponent(id)}`, { method: "PATCH", body: JSON.stringify({ status }) });
}

export async function approvedPhotos(eventId: string) {
  return supabaseFetch(`/rest/v1/photos?event_id=eq.${eventId}&status=eq.approved&select=*,guests(name)&order=created_at.desc`);
}

export async function uploadObject(path: string, file: Blob) {
  const env = assertSupabaseAdminEnv();
  const res = await fetch(`${env.url}/storage/v1/object/wedding-photos/${path}`, { method: "POST", headers: { apikey: env.serviceKey, Authorization: `Bearer ${env.serviceKey}`, "Content-Type": "image/jpeg", "x-upsert": "false" }, body: file });
  if (!res.ok) throw new Error(await res.text());
}

export async function removeObject(path: string) {
  await supabaseFetch("/storage/v1/object/wedding-photos", { method: "DELETE", body: JSON.stringify({ prefixes: [path] }) });
}

export async function signedUrl(path: string, expiresIn = 300) {
  const data = await supabaseFetch(`/storage/v1/object/sign/wedding-photos/${path}`, { method: "POST", body: JSON.stringify({ expiresIn }) });
  const env = assertSupabaseAdminEnv();
  return `${env.url}/storage/v1${data.signedURL}`;
}
