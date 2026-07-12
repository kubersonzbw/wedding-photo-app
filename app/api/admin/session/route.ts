import { cookies } from "next/headers";
import { isAllowedAdminEmail, requireAdminUser } from "@/lib/supabase/server";

type SupabasePasswordResponse = {
  access_token?: string;
  expires_in?: number;
  user?: {
    email?: string;
  };
};

function adminAuthEnv() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) throw new Error("Brakuje konfiguracji Supabase Auth.");
  return { url, anonKey };
}

function publicUser(user: { email?: string } | null | undefined) {
  return { email: user?.email ?? "" };
}

export async function GET() {
  const user = await requireAdminUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });
  return Response.json({ user: publicUser(user.user ?? user) });
}

export async function POST(request: Request) {
  try {
    const { email, password } = await request.json();
    const normalizedEmail = String(email ?? "").trim().toLowerCase();
    const adminPassword = String(password ?? "");

    if (!normalizedEmail || !adminPassword) {
      return Response.json({ error: "Podaj email i hasło." }, { status: 400 });
    }

    const { url, anonKey } = adminAuthEnv();
    const res = await fetch(`${url}/auth/v1/token?grant_type=password`, {
      method: "POST",
      headers: {
        apikey: anonKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ email: normalizedEmail, password: adminPassword }),
      cache: "no-store",
    });

    const data = await res.json().catch(() => ({})) as SupabasePasswordResponse;
    const userEmail = data.user?.email ?? normalizedEmail;

    if (!res.ok || !data.access_token) {
      return Response.json({ error: "Nieprawidłowy email lub hasło." }, { status: 401 });
    }

    if (!isAllowedAdminEmail(userEmail)) {
      return Response.json({ error: "To konto nie ma dostępu do panelu." }, { status: 403 });
    }

    const cookieStore = await cookies();
    cookieStore.set("sb-access-token", data.access_token, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: Math.max(Number(data.expires_in) || 3600, 60),
    });

    return Response.json({ ok: true, user: publicUser(data.user) });
  } catch {
    return Response.json({ error: "Nie udało się zalogować do panelu." }, { status: 500 });
  }
}

export async function DELETE() {
  const cookieStore = await cookies();
  cookieStore.delete("sb-access-token");
  cookieStore.delete("supabase-auth-token");
  return Response.json({ ok: true });
}
