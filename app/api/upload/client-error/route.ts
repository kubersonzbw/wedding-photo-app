import { checkRateLimit } from "@/lib/security/rate-limit";

type UploadClientErrorPayload = {
  slug?: unknown;
  guestId?: unknown;
  stage?: unknown;
  message?: unknown;
  errorName?: unknown;
  uploadedCount?: unknown;
  totalCount?: unknown;
  online?: unknown;
  userAgent?: unknown;
  pageOrigin?: unknown;
  pageHref?: unknown;
  files?: unknown;
};

function text(value: unknown, maxLength = 240) {
  return String(value ?? "").slice(0, maxLength);
}

function numberValue(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function normalizeFiles(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value.slice(0, 8).map((file) => {
    const item = file as { name?: unknown; type?: unknown; size?: unknown; uploadMethod?: unknown };
    return {
      name: text(item.name, 160),
      type: text(item.type, 80),
      size: numberValue(item.size),
      uploadMethod: text(item.uploadMethod, 40),
    };
  });
}

export async function POST(request: Request) {
  try {
    const ip = request.headers.get("x-forwarded-for")?.split(",")[0] ?? "local";
    if (!checkRateLimit(`upload-client-error:${ip}`, 30, 10 * 60 * 1000).allowed) {
      return Response.json({ ok: true });
    }

    const payload = (await request.json()) as UploadClientErrorPayload;
    console.error("Upload client error", {
      slug: text(payload.slug, 120),
      guestId: text(payload.guestId, 120),
      stage: text(payload.stage, 80),
      message: text(payload.message, 500),
      errorName: text(payload.errorName, 120),
      uploadedCount: numberValue(payload.uploadedCount),
      totalCount: numberValue(payload.totalCount),
      online: Boolean(payload.online),
      userAgent: text(payload.userAgent, 300),
      pageOrigin: text(payload.pageOrigin, 180),
      pageHref: text(payload.pageHref, 300),
      files: normalizeFiles(payload.files),
    });

    return Response.json({ ok: true });
  } catch (error) {
    console.error("Upload client error reporter failed", error);
    return Response.json({ ok: true });
  }
}
