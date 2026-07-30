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

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function mediaPreviewSrc(photo: Photo) {
  return photo.mediaType === "video" ? photo.thumbnailUrl ?? photo.url : photo.url;
}

function MediaSlide({ photo, active, onMediaError }: { photo: Photo; active: boolean; onMediaError?: () => void }) {
  if (photo.mediaType === "video" && active) {
    return <video className="lightbox-media" src={photo.url} controls controlsList="nodownload noremoteplayback" disablePictureInPicture disableRemotePlayback playsInline preload="metadata" onError={onMediaError} onContextMenu={(e) => e.preventDefault()} />;
  }

  if (photo.mediaType === "video" && !photo.thumbnailUrl) {
    return <video className="lightbox-media" src={photo.url} muted playsInline preload="metadata" onError={onMediaError} onContextMenu={(e) => e.preventDefault()} />;
  }

  return <img className="lightbox-media" src={mediaPreviewSrc(photo)} alt={active ? "Duże zdjęcie z wesela dodane przez gościa" : "Podgląd sąsiedniego wspomnienia"} onError={onMediaError} draggable={false} />;
}

export default function PhotoLightbox({ photo, previousPhoto, nextPhoto, current, total, slug, guestCode, onClose, onPrevious, onNext, onMediaError }: { photo: Photo; previousPhoto: Photo; nextPhoto: Photo; current: number; total: number; slug: string; guestCode: string; onClose: () => void; onPrevious: () => void; onNext: () => void; onMediaError?: () => void }) {
  const [downloading, setDownloading] = useState(false);
  const [controlsHidden, setControlsHidden] = useState(false);
  const [dragOffset, setDragOffset] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [isAnimating, setIsAnimating] = useState(false);
  const pointerStart = useRef<{ x: number; y: number; time: number; pointerId: number; moved: boolean; dragging: boolean; width: number } | null>(null);
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

  function handleStagePointerDown(event: PointerEvent<HTMLDivElement>) {
    if (isAnimating) return;
    pointerStart.current = { x: event.clientX, y: event.clientY, time: performance.now(), pointerId: event.pointerId, moved: false, dragging: false, width: event.currentTarget.clientWidth || window.innerWidth };
    event.currentTarget.setPointerCapture?.(event.pointerId);
  }

  function handleStagePointerMove(event: PointerEvent<HTMLDivElement>) {
    const start = pointerStart.current;
    if (!start || start.pointerId !== event.pointerId || isAnimating) return;

    const dx = event.clientX - start.x;
    const dy = event.clientY - start.y;
    if (Math.abs(dx) > 10 || Math.abs(dy) > 10) start.moved = true;
    if (total < 2) return;

    const shouldDrag = Math.abs(dx) > 8 && Math.abs(dx) > Math.abs(dy) * 1.15;
    if (!start.dragging && !shouldDrag) return;

    start.dragging = true;
    setIsDragging(true);
    setControlsHidden(true);
    event.preventDefault();
    setDragOffset(clamp(dx, -start.width, start.width));
  }

  function handleStagePointerUp(event: PointerEvent<HTMLDivElement>) {
    event.stopPropagation();
    const start = pointerStart.current;
    pointerStart.current = null;
    if (!start) return;
    event.currentTarget.releasePointerCapture?.(event.pointerId);

    const dx = event.clientX - start.x;
    const dy = event.clientY - start.y;
    const elapsed = Math.max(performance.now() - start.time, 1);
    const velocity = Math.abs(dx) / elapsed;
    const threshold = Math.min(120, Math.max(64, start.width * 0.22));
    const isSwipe = total > 1 && start.dragging && Math.abs(dx) > Math.abs(dy) * 1.2 && (Math.abs(dx) > threshold || velocity > 0.48);

    if (isSwipe) {
      const direction = dx < 0 ? -1 : 1;
      setIsDragging(false);
      setIsAnimating(true);
      setControlsHidden(false);
      setDragOffset(direction * start.width);
      settleTimeout.current = window.setTimeout(() => {
        if (dx < 0) onNext();
        else onPrevious();
        setIsAnimating(false);
        setDragOffset(0);
      }, 160);
      return;
    }

    setIsDragging(false);
    setDragOffset(0);
    if (!start.moved) setControlsHidden((hidden) => !hidden);
  }

  function handleStagePointerCancel(event: PointerEvent<HTMLDivElement>) {
    pointerStart.current = null;
    event.currentTarget.releasePointerCapture?.(event.pointerId);
    setIsDragging(false);
    setDragOffset(0);
  }

  function handleControlClick(action: () => void) {
    setControlsHidden(false);
    setIsDragging(false);
    setIsAnimating(false);
    setDragOffset(0);
    action();
  }

  const trackStyle = { transform: `translate3d(calc(-100% + ${dragOffset}px),0,0)` };
  const trackClassName = `lightbox-track${isDragging ? " is-dragging" : ""}${isAnimating ? " is-animating" : ""}`;

  return <div className={`lightbox${controlsHidden ? " is-controls-hidden" : ""}`} role="dialog" aria-modal="true" aria-label="Podgląd pliku">
    <div className="lightbox-top" onClick={(e) => e.stopPropagation()}>
      <span>Galeria wspomnień</span>
      <strong>{current} / {total}</strong>
      <button className="round-control" onClick={onClose} aria-label="Zamknij podgląd pliku">×</button>
    </div>
    <button className="round-control lightbox-nav lightbox-prev" onClick={(e) => { e.stopPropagation(); handleControlClick(onPrevious); }} aria-label="Poprzedni plik">‹</button>
    <div className="lightbox-stage" onPointerDown={handleStagePointerDown} onPointerMove={handleStagePointerMove} onPointerUp={handleStagePointerUp} onPointerCancel={handleStagePointerCancel} onClick={(e) => e.stopPropagation()}>
      <div className={trackClassName} style={trackStyle}>
        <div className="lightbox-slide" aria-hidden="true"><MediaSlide photo={previousPhoto} active={false} onMediaError={onMediaError} /></div>
        <div className="lightbox-slide"><MediaSlide photo={photo} active onMediaError={onMediaError} /></div>
        <div className="lightbox-slide" aria-hidden="true"><MediaSlide photo={nextPhoto} active={false} onMediaError={onMediaError} /></div>
      </div>
    </div>
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
