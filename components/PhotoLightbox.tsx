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
  const pointerStart = useRef<{ x: number; y: number; time: number; pointerId: number; moved: boolean } | null>(null);

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
    pointerStart.current = { x: event.clientX, y: event.clientY, time: performance.now(), pointerId: event.pointerId, moved: false };
    event.currentTarget.setPointerCapture?.(event.pointerId);
  }

  function handleMediaPointerMove(event: PointerEvent<HTMLElement>) {
    const start = pointerStart.current;
    if (!start || start.pointerId !== event.pointerId) return;

    const dx = event.clientX - start.x;
    const dy = event.clientY - start.y;
    if (Math.abs(dx) > 10 || Math.abs(dy) > 10) start.moved = true;
    if (Math.abs(dx) > 14 && Math.abs(dx) > Math.abs(dy) * 1.2) event.preventDefault();
  }

  function handleMediaPointerUp(event: PointerEvent<HTMLElement>) {
    event.stopPropagation();
    const start = pointerStart.current;
    pointerStart.current = null;
    if (!start) return;
    event.currentTarget.releasePointerCapture?.(event.pointerId);

    const dx = event.clientX - start.x;
    const dy = event.clientY - start.y;
    const elapsed = Math.max(performance.now() - start.time, 1);
    const velocity = Math.abs(dx) / elapsed;
    const threshold = typeof window === "undefined" ? 70 : Math.min(110, Math.max(58, window.innerWidth * 0.2));
    const isSwipe = Math.abs(dx) > Math.abs(dy) * 1.25 && (Math.abs(dx) > threshold || velocity > 0.55);

    if (isSwipe) {
      setControlsHidden(false);
      if (dx < 0) onNext();
      else onPrevious();
      return;
    }

    if (!start.moved) setControlsHidden((hidden) => !hidden);
  }

  function handleMediaPointerCancel(event: PointerEvent<HTMLElement>) {
    pointerStart.current = null;
    event.currentTarget.releasePointerCapture?.(event.pointerId);
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
      ? <video className="lightbox-media" src={photo.url} controls controlsList="nodownload noremoteplayback" disablePictureInPicture disableRemotePlayback playsInline preload="metadata" onError={onMediaError} onPointerDown={handleMediaPointerDown} onPointerMove={handleMediaPointerMove} onPointerUp={handleMediaPointerUp} onPointerCancel={handleMediaPointerCancel} onClick={(e) => e.stopPropagation()} onContextMenu={(e) => e.preventDefault()} />
      : <img className="lightbox-media" src={photo.url} alt="Duże zdjęcie z wesela dodane przez gościa" onError={onMediaError} onPointerDown={handleMediaPointerDown} onPointerMove={handleMediaPointerMove} onPointerUp={handleMediaPointerUp} onPointerCancel={handleMediaPointerCancel} onClick={(e) => e.stopPropagation()} />}
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
