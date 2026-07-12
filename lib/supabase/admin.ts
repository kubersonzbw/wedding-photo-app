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

export async function getEventByDomain(domain: string) {
  const rows = await supabaseFetch(`/rest/v1/events?domain=eq.${encodeURIComponent(domain)}&select=*`);
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

export async function listPhotos(status?: string) {
  const filter = status && status !== "all" ? `&status=eq.${encodeURIComponent(status)}` : "";
  return supabaseFetch(`/rest/v1/photos?select=*,guests(name),events(slug,title)&order=created_at.desc${filter}`);
}

export async function updatePhotoStatus(id: string, status: "approved" | "hidden" | "deleted") {
  return supabaseFetch(`/rest/v1/photos?id=eq.${encodeURIComponent(id)}`, { method: "PATCH", body: JSON.stringify({ status }) });
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

type ImageTransform = {
  width?: number;
  height?: number;
  quality?: number;
  resize?: "cover" | "contain" | "fill";
  format?: "origin";
};

function encodeStoragePath(path: string) {
  return path.split("/").map(encodeURIComponent).join("/");
}

export async function createSignedUploadUrl(path: string) {
  const data = await supabaseFetch(`/storage/v1/object/upload/sign/wedding-photos/${encodeStoragePath(path)}`, { method: "POST", body: JSON.stringify({}) });
  const env = assertSupabaseAdminEnv();
  const signedUrl = `${env.url}/storage/v1${data.url}`;
  const token = new URL(signedUrl).searchParams.get("token");
  if (!token) throw new Error("Missing signed upload token.");
  return { signedUrl, token, path };
}

export async function objectExists(path: string) {
  const env = assertSupabaseAdminEnv();
  const res = await fetch(`${env.url}/storage/v1/object/wedding-photos/${encodeStoragePath(path)}`, { method: "HEAD", headers: { apikey: env.serviceKey, Authorization: `Bearer ${env.serviceKey}` }, cache: "no-store" });
  if (res.status === 404) return false;
  if (!res.ok) throw new Error(await res.text());
  return true;
}

export async function removeObject(path: string) {
  await supabaseFetch("/storage/v1/object/wedding-photos", { method: "DELETE", body: JSON.stringify({ prefixes: [path] }) });
}

export async function removeObjects(paths: string[]) {
  if (paths.length === 0) return;
  await supabaseFetch("/storage/v1/object/wedding-photos", { method: "DELETE", body: JSON.stringify({ prefixes: paths }) });
}

export async function signedUrl(path: string, expiresIn = 300, transform?: ImageTransform) {
  const body = transform ? { expiresIn, transform } : { expiresIn };
  const data = await supabaseFetch(`/storage/v1/object/sign/wedding-photos/${encodeStoragePath(path)}`, { method: "POST", body: JSON.stringify(body) });
  const env = assertSupabaseAdminEnv();
  return `${env.url}/storage/v1${data.signedURL}`;
}
