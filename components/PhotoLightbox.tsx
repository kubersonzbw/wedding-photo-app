"use client";
/* eslint-disable @next/next/no-img-element */

type Photo = { id: string; url: string; thumbnailUrl?: string; mediaType?: "image" | "video"; guestName?: string; createdAt: string };

const dateFormatter = new Intl.DateTimeFormat("pl-PL", {
  day: "2-digit",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "Europe/Warsaw",
});

function photoDetails(photo: Photo) {
  const date = new Date(photo.createdAt);
  const formattedDate = Number.isNaN(date.getTime()) ? "" : dateFormatter.format(date);
  const guestName = photo.guestName?.trim() || "gościa";

  return formattedDate ? `Dodane przez ${guestName} • ${formattedDate}` : `Dodane przez ${guestName}`;
}

export default function PhotoLightbox({ photo, current, total, onClose, onPrevious, onNext, onMediaError }: { photo: Photo; current: number; total: number; onClose: () => void; onPrevious: () => void; onNext: () => void; onMediaError?: () => void }) {
  return <div className="lightbox" onClick={onClose} role="dialog" aria-modal="true" aria-label="Podgląd pliku">
    <div className="lightbox-top" onClick={(e) => e.stopPropagation()}>
      <span>Galeria wspomnień</span>
      <strong>{current} / {total}</strong>
      <button className="round-control" onClick={onClose} aria-label="Zamknij podgląd pliku">×</button>
    </div>
    <button className="round-control lightbox-nav lightbox-prev" onClick={(e) => { e.stopPropagation(); onPrevious(); }} aria-label="Poprzedni plik">‹</button>
    {photo.mediaType === "video"
      ? <video src={photo.url} controls controlsList="nodownload noremoteplayback" disablePictureInPicture disableRemotePlayback playsInline preload="metadata" onError={onMediaError} onClick={(e) => e.stopPropagation()} onContextMenu={(e) => e.preventDefault()} />
      : <img src={photo.url} alt="Duże zdjęcie z wesela dodane przez gościa" onError={onMediaError} onClick={(e) => e.stopPropagation()} />}
    <span className="lightbox-author" onClick={(e) => e.stopPropagation()}>{photoDetails(photo)}</span>
    <button className="round-control lightbox-nav lightbox-next" onClick={(e) => { e.stopPropagation(); onNext(); }} aria-label="Następny plik">›</button>
  </div>;
}
