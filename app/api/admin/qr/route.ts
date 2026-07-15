import QRCode from "qrcode";
import { requireAdminUser } from "@/lib/supabase/server";

async function guard() {
  return Boolean(await requireAdminUser());
}

function safeFilename(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9-]+/g, "-").replace(/^-+|-+$/g, "") || "qr";
}

export async function GET(request: Request) {
  if (!(await guard())) return Response.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const params = new URL(request.url).searchParams;
    const targetUrl = params.get("url")?.trim();
    const format = params.get("format") === "png" ? "png" : "svg";
    const filename = safeFilename(params.get("filename") ?? "qr-wedding-upload");

    if (!targetUrl || !/^https?:\/\//i.test(targetUrl)) {
      return Response.json({ error: "Podaj poprawny link do QR." }, { status: 400 });
    }

    if (format === "png") {
      const png = await QRCode.toBuffer(targetUrl, {
        type: "png",
        errorCorrectionLevel: "M",
        margin: 2,
        width: 1024,
        color: { dark: "#3a2a25", light: "#fffdf9" },
      });

      const body = png.buffer.slice(png.byteOffset, png.byteOffset + png.byteLength) as ArrayBuffer;
      return new Response(body, {
        headers: {
          "Content-Type": "image/png",
          "Content-Disposition": `attachment; filename="${filename}.png"`,
          "Cache-Control": "no-store",
        },
      });
    }

    const svg = await QRCode.toString(targetUrl, {
      type: "svg",
      errorCorrectionLevel: "M",
      margin: 2,
      width: 1024,
      color: { dark: "#3a2a25", light: "#fffdf9" },
    });

    return new Response(svg, {
      headers: {
        "Content-Type": "image/svg+xml; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}.svg"`,
        "Cache-Control": "no-store",
      },
    });
  } catch {
    return Response.json({ error: "Nie udało się wygenerować QR." }, { status: 500 });
  }
}
