"use client";
/* eslint-disable @next/next/no-img-element */
import { useRef, useState, type PointerEvent } from "react";

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

export default function PhotoLightbox({ photo, current, total, slug, guestCode, onClose, onPrevious, onNext, onMediaError }: { photo: Photo; current: number; total: number; slug: string; guestCode: string; onClose: () => void; onPrevious: () => void; onNext: () => void; onMediaError?: () => void }) {
  const [downloading, setDownloading] = useState(false);
  const [controlsHidden, setControlsHidden] = useState(false);
  const pointerStart = useRef<{ x: number; y: number } | null>(null);

  async function handleDownload() {
    if (downloading) return;
    setDownloading(true);
    try {
      const res = await fetch("/api/gallery/download", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug, guestCode, photoId: photo.id }),
      });
      const data = await res.json();
      if (!res.ok || !data.url) throw new Error(data.error ?? "Nie udało się przygotować pobierania.");
      window.location.href = data.url;
    } catch {
      window.alert("Nie udało się przygotować pobierania. Spróbuj ponownie za chwilę.");
    } finally {
      setDownloading(false);
    }
  }

  function handleMediaPointerDown(event: PointerEvent<HTMLElement>) {
    pointerStart.current = { x: event.clientX, y: event.clientY };
  }

  function handleMediaPointerUp(event: PointerEvent<HTMLElement>) {
    event.stopPropagation();
    const start = pointerStart.current;
    pointerStart.current = null;
    if (!start) return;

    const dx = event.clientX - start.x;
    const dy = event.clientY - start.y;
    const isSwipe = Math.abs(dx) > 56 && Math.abs(dx) > Math.abs(dy) * 1.35;
    if (isSwipe) {
      if (dx < 0) onNext();
      else onPrevious();
      return;
    }

    setControlsHidden((hidden) => !hidden);
  }

  function handleControlClick(action: () => void) {
    setControlsHidden(false);
    action();
  }

  return <div className={`lightbox${controlsHidden ? " is-controls-hidden" : ""}`} role="dialog" aria-modal="true" aria-label="Podgląd pliku">
    <div className="lightbox-top" onClick={(e) => e.stopPropagation()}>
      <span>Galeria wspomnień</span>
      <strong>{current} / {total}</strong>
      <button className="round-control" onClick={onClose} aria-label="Zamknij podgląd pliku">×</button>
    </div>
    <button className="round-control lightbox-nav lightbox-prev" onClick={(e) => { e.stopPropagation(); handleControlClick(onPrevious); }} aria-label="Poprzedni plik">‹</button>
    {photo.mediaType === "video"
      ? <video className="lightbox-media" src={photo.url} controls controlsList="nodownload noremoteplayback" disablePictureInPicture disableRemotePlayback playsInline preload="metadata" onError={onMediaError} onPointerDown={handleMediaPointerDown} onPointerUp={handleMediaPointerUp} onPointerCancel={() => { pointerStart.current = null; }} onClick={(e) => e.stopPropagation()} onContextMenu={(e) => e.preventDefault()} />
      : <img className="lightbox-media" src={photo.url} alt="Duże zdjęcie z wesela dodane przez gościa" onError={onMediaError} onPointerDown={handleMediaPointerDown} onPointerUp={handleMediaPointerUp} onPointerCancel={() => { pointerStart.current = null; }} onClick={(e) => e.stopPropagation()} />}
    <button className="lightbox-download" onClick={(e) => { e.stopPropagation(); void handleDownload(); }} disabled={downloading}>
      <svg className="lightbox-download-icon" viewBox="0 0 24 24" aria-hidden="true">
        <path d="M12 4v10" />
        <path d="m8 10 4 4 4-4" />
        <path d="M5 19h14" />
      </svg>
      <span>{downloading ? "Pobieramy…" : "Pobierz"}</span>
    </button>
    <span className="lightbox-author" onClick={(e) => e.stopPropagation()}>{photoDetails(photo)}</span>
    <button className="round-control lightbox-nav lightbox-next" onClick={(e) => { e.stopPropagation(); handleControlClick(onNext); }} aria-label="Następny plik">›</button>
  </div>;
}
