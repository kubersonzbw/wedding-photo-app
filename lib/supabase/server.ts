import { cookies } from "next/headers";

export async function getSupabaseAccessToken() {
  const store = await cookies();
  return store.get("sb-access-token")?.value ?? store.get("supabase-auth-token")?.value;
}

export async function requireAdminUser() {
  const token = await getSupabaseAccessToken();
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!token || !url || !anon) return null;
  const res = await fetch(`${url}/auth/v1/user`, { headers: { apikey: anon, Authorization: `Bearer ${token}` }, cache: "no-store" });
  return res.ok ? res.json() : null;
}
