"use client";
/* eslint-disable @next/next/no-img-element */
import { useEffect, useRef, useState, type PointerEvent } from "react";

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

function rubberbandOffset(offset: number) {
  if (typeof window === "undefined") return offset;
  const limit = Math.min(window.innerWidth * 0.42, 180);
  const distance = Math.abs(offset);
  if (distance <= limit) return offset;
  return Math.sign(offset) * (limit + (distance - limit) * 0.24);
}

export default function PhotoLightbox({ photo, current, total, slug, guestCode, onClose, onPrevious, onNext, onMediaError }: { photo: Photo; current: number; total: number; slug: string; guestCode: string; onClose: () => void; onPrevious: () => void; onNext: () => void; onMediaError?: () => void }) {
  const [downloading, setDownloading] = useState(false);
  const [controlsHidden, setControlsHidden] = useState(false);
  const [dragOffset, setDragOffset] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [isSettling, setIsSettling] = useState(false);
  const pointerStart = useRef<{ x: number; y: number; time: number; pointerId: number; dragging: boolean } | null>(null);
  const settleTimeout = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (settleTimeout.current) window.clearTimeout(settleTimeout.current);
    };
  }, []);

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
    if (isSettling) return;
    pointerStart.current = { x: event.clientX, y: event.clientY, time: performance.now(), pointerId: event.pointerId, dragging: false };
    event.currentTarget.setPointerCapture?.(event.pointerId);
  }

  function handleMediaPointerMove(event: PointerEvent<HTMLElement>) {
    const start = pointerStart.current;
    if (!start || start.pointerId !== event.pointerId || isSettling) return;

    const dx = event.clientX - start.x;
    const dy = event.clientY - start.y;
    const shouldDrag = Math.abs(dx) > 8 && Math.abs(dx) > Math.abs(dy) * 1.15;
    if (!start.dragging && !shouldDrag) return;

    start.dragging = true;
    event.preventDefault();
    setIsDragging(true);
    setControlsHidden(true);
    setDragOffset(rubberbandOffset(dx));
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
    const threshold = typeof window === "undefined" ? 72 : Math.min(116, Math.max(64, window.innerWidth * 0.22));
    const isSwipe = start.dragging && Math.abs(dx) > Math.abs(dy) * 1.15 && (Math.abs(dx) > threshold || velocity > 0.48);

    if (isSwipe) {
      const direction = dx < 0 ? -1 : 1;
      setIsDragging(false);
      setIsSettling(true);
      setControlsHidden(false);
      setDragOffset(direction * (typeof window === "undefined" ? 420 : window.innerWidth));
      settleTimeout.current = window.setTimeout(() => {
        if (dx < 0) onNext();
        else onPrevious();
        setIsSettling(false);
        setDragOffset(0);
      }, 130);
      return;
    }

    setIsDragging(false);
    setDragOffset(0);
    if (!start.dragging) setControlsHidden((hidden) => !hidden);
  }

  function handleMediaPointerCancel(event: PointerEvent<HTMLElement>) {
    pointerStart.current = null;
    event.currentTarget.releasePointerCapture?.(event.pointerId);
    setIsDragging(false);
    setDragOffset(0);
  }

  function handleControlClick(action: () => void) {
    setControlsHidden(false);
    setDragOffset(0);
    setIsDragging(false);
    setIsSettling(false);
    action();
  }

  const mediaStyle = {
    transform: `translate3d(${dragOffset}px, 0, 0) scale(${isDragging ? 0.985 : 1})`,
    opacity: isDragging ? Math.max(0.72, 1 - Math.abs(dragOffset) / 520) : 1,
  };
  const mediaClassName = `lightbox-media${isDragging ? " is-dragging" : ""}${isSettling ? " is-settling" : ""}`;

  return <div className={`lightbox${controlsHidden ? " is-controls-hidden" : ""}`} role="dialog" aria-modal="true" aria-label="Podgląd pliku">
    <div className="lightbox-top" onClick={(e) => e.stopPropagation()}>
      <span>Galeria wspomnień</span>
      <strong>{current} / {total}</strong>
      <button className="round-control" onClick={onClose} aria-label="Zamknij podgląd pliku">×</button>
    </div>
    <button className="round-control lightbox-nav lightbox-prev" onClick={(e) => { e.stopPropagation(); handleControlClick(onPrevious); }} aria-label="Poprzedni plik">‹</button>
    {photo.mediaType === "video"
      ? <video className={mediaClassName} style={mediaStyle} src={photo.url} controls controlsList="nodownload noremoteplayback" disablePictureInPicture disableRemotePlayback playsInline preload="metadata" onError={onMediaError} onPointerDown={handleMediaPointerDown} onPointerMove={handleMediaPointerMove} onPointerUp={handleMediaPointerUp} onPointerCancel={handleMediaPointerCancel} onClick={(e) => e.stopPropagation()} onContextMenu={(e) => e.preventDefault()} />
      : <img className={mediaClassName} style={mediaStyle} src={photo.url} alt="Duże zdjęcie z wesela dodane przez gościa" onError={onMediaError} onPointerDown={handleMediaPointerDown} onPointerMove={handleMediaPointerMove} onPointerUp={handleMediaPointerUp} onPointerCancel={handleMediaPointerCancel} onClick={(e) => e.stopPropagation()} />}
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
