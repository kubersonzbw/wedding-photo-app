"use client";
/* eslint-disable @next/next/no-img-element */
import { type TouchEvent as ReactTouchEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import useEmblaCarousel from "embla-carousel-react";

type Photo = {
  id: string;
  url: string;
  thumbnailUrl?: string;
  previewUrl?: string;
  mediaType?: "image" | "video";
  guestName?: string;
  createdAt: string;
};

type DownloadPayload = {
  url: string;
};

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

function mediaPreviewSrc(photo: Photo, active: boolean) {
  if (active) return photo.previewUrl ?? photo.thumbnailUrl ?? photo.url;
  return photo.thumbnailUrl ?? photo.previewUrl ?? photo.url;
}

function startBrowserDownload(url: string) {
  const link = document.createElement("a");
  link.href = url;
  link.download = "";
  link.rel = "noopener";
  link.style.display = "none";
  document.body.appendChild(link);
  link.click();
  link.remove();
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function touchDistance(touches: ReactTouchEvent["touches"]) {
  const first = touches[0];
  const second = touches[1];
  if (!first || !second) return 0;
  return Math.hypot(second.clientX - first.clientX, second.clientY - first.clientY);
}

function ZoomableImage({
  photo,
  active,
  onMediaClick,
  onMediaError,
  onZoomChange,
  onZoomGestureChange,
}: {
  photo: Photo;
  active: boolean;
  onMediaClick: () => void;
  onMediaError?: () => void;
  onZoomChange: (zoomed: boolean) => void;
  onZoomGestureChange: (active: boolean) => void;
}) {
  const [scale, setScale] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const pinchRef = useRef<{ distance: number; scale: number } | null>(null);
  const panRef = useRef<{ x: number; y: number; offsetX: number; offsetY: number } | null>(null);
  const movedRef = useRef(false);
  const zoomed = scale > 1.02;

  useEffect(() => {
    onZoomChange(active && zoomed);
  }, [active, onZoomChange, zoomed]);

  useEffect(() => {
    if (active) return;
    const timer = window.setTimeout(() => {
      setScale(1);
      setOffset({ x: 0, y: 0 });
      pinchRef.current = null;
      panRef.current = null;
      onZoomGestureChange(false);
    }, 0);
    return () => window.clearTimeout(timer);
  }, [active, onZoomGestureChange]);

  function resetZoom() {
    setScale(1);
    setOffset({ x: 0, y: 0 });
    onZoomChange(false);
    onZoomGestureChange(false);
  }

  function handleTouchStartCapture(event: ReactTouchEvent<HTMLDivElement>) {
    if (!active) return;
    if (event.touches.length >= 2 || zoomed) onZoomGestureChange(true);
  }

  function handleTouchStart(event: ReactTouchEvent<HTMLDivElement>) {
    if (!active) return;
    movedRef.current = false;
    if (event.touches.length === 2) {
      onZoomGestureChange(true);
      pinchRef.current = { distance: touchDistance(event.touches), scale };
      panRef.current = null;
      if (event.cancelable) event.preventDefault();
      event.stopPropagation();
      return;
    }
    if (event.touches.length === 1 && zoomed) {
      const touch = event.touches[0];
      if (!touch) return;
      onZoomGestureChange(true);
      panRef.current = { x: touch.clientX, y: touch.clientY, offsetX: offset.x, offsetY: offset.y };
      if (event.cancelable) event.preventDefault();
      event.stopPropagation();
    }
  }

  function handleTouchMove(event: ReactTouchEvent<HTMLDivElement>) {
    if (!active) return;
    if (event.touches.length === 2 && pinchRef.current) {
      const distance = touchDistance(event.touches);
      if (distance <= 0) return;
      const nextScale = clamp(pinchRef.current.scale * (distance / pinchRef.current.distance), 1, 4);
      movedRef.current = true;
      event.preventDefault();
      event.stopPropagation();
      setScale(nextScale);
      if (nextScale <= 1.02) setOffset({ x: 0, y: 0 });
      return;
    }

    if (event.touches.length === 1 && panRef.current && zoomed) {
      const touch = event.touches[0];
      if (!touch) return;
      const maxOffset = 140 * scale;
      movedRef.current = true;
      event.preventDefault();
      event.stopPropagation();
      setOffset({
        x: clamp(panRef.current.offsetX + touch.clientX - panRef.current.x, -maxOffset, maxOffset),
        y: clamp(panRef.current.offsetY + touch.clientY - panRef.current.y, -maxOffset, maxOffset),
      });
    }
  }

  function handleTouchEnd(event: ReactTouchEvent<HTMLDivElement>) {
    pinchRef.current = null;
    panRef.current = null;
    if (event.touches.length === 0) onZoomGestureChange(false);
    if (scale <= 1.02) resetZoom();
  }

  return (
    <div
      className={`lightbox-zoom-wrap${zoomed ? " is-zoomed" : ""}`}
      onTouchStartCapture={handleTouchStartCapture}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      onTouchCancel={handleTouchEnd}
      onDoubleClick={(event) => {
        event.stopPropagation();
        if (zoomed) resetZoom();
        else setScale(2.25);
      }}
    >
      <img
        className="lightbox-media"
        src={mediaPreviewSrc(photo, active)}
        alt={active ? "Duże zdjęcie z wesela dodane przez gościa" : "Podgląd sąsiedniego wspomnienia"}
        loading={active ? "eager" : "lazy"}
        decoding="async"
        onClick={(event) => {
          event.stopPropagation();
          if (movedRef.current) {
            movedRef.current = false;
            return;
          }
          onMediaClick();
        }}
        onError={onMediaError}
        draggable={false}
        style={{ transform: `translate3d(${offset.x}px, ${offset.y}px, 0) scale(${scale})` }}
      />
    </div>
  );
}

function MediaSlide({
  photo,
  active,
  onMediaClick,
  onMediaError,
  onZoomChange,
  onZoomGestureChange,
}: {
  photo: Photo;
  active: boolean;
  onMediaClick: () => void;
  onMediaError?: () => void;
  onZoomChange: (zoomed: boolean) => void;
  onZoomGestureChange: (active: boolean) => void;
}) {
  if (photo.mediaType === "video" && active) {
    return (
      <video
        className="lightbox-media"
        src={photo.url}
        controls
        controlsList="nodownload noremoteplayback"
        disablePictureInPicture
        disableRemotePlayback
        playsInline
        preload="metadata"
        onClick={(event) => event.stopPropagation()}
        onError={onMediaError}
        onContextMenu={(event) => event.preventDefault()}
      />
    );
  }

  if (photo.mediaType === "video" && !photo.thumbnailUrl) {
    return (
      <div className="lightbox-media lightbox-video-placeholder" onClick={(event) => event.stopPropagation()}>
        <span aria-hidden="true">▶</span>
      </div>
    );
  }

  return <ZoomableImage photo={photo} active={active} onMediaClick={onMediaClick} onMediaError={onMediaError} onZoomChange={onZoomChange} onZoomGestureChange={onZoomGestureChange} />;
}

function adjacentPhotoIndex(index: number, direction: -1 | 1, loadedCount: number, canLoop: boolean) {
  const nextIndex = index + direction;
  if (nextIndex >= 0 && nextIndex < loadedCount) return nextIndex;
  if (!canLoop || loadedCount <= 1) return null;
  return direction === -1 ? loadedCount - 1 : 0;
}

function getLightboxSlides(photos: Photo[], activeIndex: number, canLoop: boolean) {
  const previousIndex = adjacentPhotoIndex(activeIndex, -1, photos.length, canLoop);
  const nextIndex = adjacentPhotoIndex(activeIndex, 1, photos.length, canLoop);
  const indexes = [previousIndex, activeIndex, nextIndex].filter((index): index is number => index !== null);
  const uniqueIndexes = [...new Set(indexes)];

  return uniqueIndexes.map((index) => ({ index, photo: photos[index] })).filter((slide): slide is { index: number; photo: Photo } => Boolean(slide.photo));
}

export default function PhotoLightbox({
  photos,
  activeIndex,
  totalCount,
  hasMore,
  slug,
  guestCode,
  onClose,
  onSelect,
  onMediaError,
}: {
  photos: Photo[];
  activeIndex: number;
  totalCount?: number;
  hasMore?: boolean;
  slug: string;
  guestCode: string;
  onClose: () => void;
  onSelect: (index: number) => void;
  onMediaError?: (index: number) => void;
}) {
  const [downloading, setDownloading] = useState(false);
  const [downloadLabel, setDownloadLabel] = useState("Pobierz");
  const [controlsHidden, setControlsHidden] = useState(false);
  const [zoomedMedia, setZoomedMedia] = useState(false);
  const zoomedMediaRef = useRef(false);
  const zoomGestureActiveRef = useRef(false);
  const lightboxLoops = photos.length > 1 && !hasMore;
  const lightboxSlides = useMemo(() => getLightboxSlides(photos, activeIndex, lightboxLoops), [activeIndex, lightboxLoops, photos]);
  const activeSlideIndex = Math.max(0, lightboxSlides.findIndex((slide) => slide.index === activeIndex));
  const setLightboxZoomedMedia = useCallback((zoomed: boolean) => {
    zoomedMediaRef.current = zoomed;
    setZoomedMedia(zoomed);
  }, []);
  const setLightboxZoomGestureActive = useCallback((active: boolean) => {
    zoomGestureActiveRef.current = active;
  }, []);
  const clearZoomLocks = useCallback(() => {
    zoomedMediaRef.current = false;
    zoomGestureActiveRef.current = false;
    setZoomedMedia(false);
  }, []);
  const watchLightboxDrag = useCallback((_api: unknown, event: MouseEvent | TouchEvent) => {
    if (zoomedMediaRef.current || zoomGestureActiveRef.current) return false;
    if (event instanceof TouchEvent && event.touches.length > 1) return false;
    const target = event.target instanceof Element ? event.target : null;
    if (target?.closest(".lightbox-zoom-wrap.is-zoomed")) return false;
    return true;
  }, []);
  const [emblaRef, emblaApi] = useEmblaCarousel({
    align: "center",
    containScroll: false,
    dragFree: false,
    duration: 24,
    loop: false,
    skipSnaps: false,
    startIndex: activeSlideIndex,
    watchDrag: watchLightboxDrag,
  });
  const photo = photos[activeIndex];
  const total = Math.max(totalCount ?? photos.length, photos.length);

  const selectCurrentSlide = useCallback(() => {
    if (!emblaApi) return;
    const selectedSlide = lightboxSlides[emblaApi.selectedScrollSnap()];
    if (!selectedSlide) return;
    if (selectedSlide.index !== activeIndex) onSelect(selectedSlide.index);
    setControlsHidden(false);
    setDownloadLabel("Pobierz");
    clearZoomLocks();
  }, [activeIndex, clearZoomLocks, emblaApi, lightboxSlides, onSelect]);

  useEffect(() => {
    if (!emblaApi) return;
    emblaApi.on("select", selectCurrentSlide);

    return () => {
      emblaApi.off("select", selectCurrentSlide);
    };
  }, [emblaApi, selectCurrentSlide]);

  useEffect(() => {
    if (!emblaApi) return;
    emblaApi.reInit();
    emblaApi.scrollTo(activeSlideIndex, true);
  }, [activeIndex, activeSlideIndex, emblaApi, lightboxSlides.length]);

  async function handleDownload() {
    if (downloading || !photo) return;
    setDownloading(true);
    setDownloadLabel("Pobieranie...");
    try {
      const res = await fetch("/api/gallery/download", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug, guestCode, photoId: photo.id }),
      });
      const data = await res.json();
      if (!res.ok || !data.url) throw new Error(data.error ?? "Nie udało się przygotować pobierania.");
      const payload: DownloadPayload = data;
      startBrowserDownload(payload.url);
      setDownloadLabel("Pobierz");
    } catch {
      setDownloadLabel("Pobierz");
      window.alert("Nie udało się przygotować pobierania. Spróbuj ponownie za chwilę.");
    } finally {
      setDownloading(false);
    }
  }

  function scrollPrevious() {
    setControlsHidden(false);
    setDownloadLabel("Pobierz");
    clearZoomLocks();
    emblaApi?.scrollPrev();
  }

  function scrollNext() {
    setControlsHidden(false);
    setDownloadLabel("Pobierz");
    clearZoomLocks();
    emblaApi?.scrollNext();
  }

  if (!photo) return null;

  return (
    <div className={`lightbox${controlsHidden ? " is-controls-hidden" : ""}`} role="dialog" aria-modal="true" aria-label="Podgląd pliku">
      <div className="lightbox-top" onClick={(event) => event.stopPropagation()}>
        <strong>
          {activeIndex + 1} / {total}
        </strong>
        <div className="lightbox-actions">
          <button
            className={`round-control lightbox-download${downloading ? " is-saving" : ""}`}
            onClick={(event) => {
              event.stopPropagation();
              void handleDownload();
            }}
            disabled={downloading}
            aria-label={downloadLabel}
            title={downloadLabel}
          >
            <svg className="lightbox-download-icon" viewBox="0 0 24 24" aria-hidden="true">
              <path d="M12 4v10" />
              <path d="m8 10 4 4 4-4" />
              <path d="M5 19h14" />
            </svg>
            <span className="sr-only">{downloadLabel}</span>
          </button>
          <button className="round-control" onClick={onClose} aria-label="Zamknij podgląd pliku">×</button>
        </div>
      </div>

      {total > 1 && <button className="round-control lightbox-nav lightbox-prev" onClick={scrollPrevious} aria-label="Poprzedni plik">‹</button>}

      <div className={`lightbox-stage${zoomedMedia ? " is-zoom-locked" : ""}`} ref={emblaRef} onClick={(event) => event.stopPropagation()}>
        <div className="lightbox-track">
          {lightboxSlides.map(({ photo: item, index }) => (
            <div className="lightbox-slide" key={item.id} aria-hidden={index !== activeIndex}>
              <MediaSlide
                photo={item}
                active={index === activeIndex}
                onMediaClick={() => setControlsHidden((hidden) => !hidden)}
                onMediaError={() => onMediaError?.(index)}
                onZoomChange={setLightboxZoomedMedia}
                onZoomGestureChange={setLightboxZoomGestureActive}
              />
            </div>
          ))}
        </div>
      </div>

      <span className="lightbox-author" onClick={(event) => event.stopPropagation()}>{photoDetails(photo)}</span>

      {total > 1 && <button className="round-control lightbox-nav lightbox-next" onClick={scrollNext} aria-label="Następny plik">›</button>}
    </div>
  );
}
