type UploadNotification = {
  eventTitle?: string;
  guestName: string;
  totalCount: number;
  imageCount: number;
  videoCount: number;
  galleryUrl: string;
};

function fileSummary(totalCount: number, imageCount: number, videoCount: number) {
  const parts = [];
  if (imageCount > 0) parts.push(`${imageCount} zdjęć`);
  if (videoCount > 0) parts.push(`${videoCount} filmów`);
  return parts.length > 0 ? parts.join(", ") : `${totalCount} plików`;
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export async function sendUploadNotificationEmail(notification: UploadNotification) {
  const apiKey = process.env.RESEND_API_KEY;
  const to = process.env.UPLOAD_NOTIFICATION_TO;
  const from = process.env.UPLOAD_NOTIFICATION_FROM ?? "Galeria weselna <onboarding@resend.dev>";

  if (!apiKey || !to) return;
  const recipients = to.split(",").map((item) => item.trim()).filter(Boolean);
  if (recipients.length === 0) return;

  const title = notification.eventTitle?.trim() || "Galeria wspomnień";
  const summary = fileSummary(notification.totalCount, notification.imageCount, notification.videoCount);
  const subject = `${notification.guestName} dodał(a) ${notification.totalCount} wspomnień`;
  const safeGuestName = escapeHtml(notification.guestName);
  const safeSummary = escapeHtml(summary);
  const safeGalleryUrl = escapeHtml(notification.galleryUrl);
  const text = [
    "Nowe wspomnienia w galerii",
    "",
    `${notification.guestName} dodał(a) ${notification.totalCount} plików: ${summary}.`,
    "",
    `Wydarzenie: ${title}`,
    `Galeria: ${notification.galleryUrl}`,
  ].join("\n");

  const html = `
    <div style="font-family:Arial,sans-serif;line-height:1.5;color:#2f241f">
      <h1 style="font-size:22px;margin:0 0 12px">Nowe wspomnienia w galerii</h1>
      <p><strong>${safeGuestName}</strong> dodał(a) <strong>${notification.totalCount}</strong> plików.</p>
      <p>${safeSummary}</p>
      <p style="margin-top:18px"><a href="${safeGalleryUrl}" style="color:#9d741e;font-weight:700">Zobacz galerię</a></p>
    </div>
  `;

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ from, to: recipients, subject, text, html }),
  });

  if (!res.ok) throw new Error(await res.text());
}
