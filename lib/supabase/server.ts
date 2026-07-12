import { cookies } from "next/headers";

type SupabaseAuthUser = {
  id?: string;
  email?: string;
  user?: {
    id?: string;
    email?: string;
  };
};

export async function getSupabaseAccessToken() {
  const store = await cookies();
  return store.get("sb-access-token")?.value ?? store.get("supabase-auth-token")?.value;
}

export function isAllowedAdminEmail(email: string | null | undefined) {
  const configuredEmails = process.env.ADMIN_EMAILS?.split(",").map((item) => item.trim().toLowerCase()).filter(Boolean) ?? [];
  if (configuredEmails.length === 0) return false;
  return Boolean(email && configuredEmails.includes(email.toLowerCase()));
}

export async function requireAdminUser() {
  const token = await getSupabaseAccessToken();
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!token || !url || !anon) return null;
  const res = await fetch(`${url}/auth/v1/user`, { headers: { apikey: anon, Authorization: `Bearer ${token}` }, cache: "no-store" });
  if (!res.ok) return null;
  const user = await res.json() as SupabaseAuthUser;
  const email = user.email ?? user.user?.email;
  return isAllowedAdminEmail(email) ? user : null;
}
