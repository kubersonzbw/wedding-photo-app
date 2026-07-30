"use client";
/* eslint-disable @next/next/no-img-element */
import { useCallback, useEffect, useState } from "react";
import useEmblaCarousel from "embla-carousel-react";

type Photo = {
  id: string;
  url: string;
  thumbnailUrl?: string;
  mediaType?: "image" | "video";
  guestName?: string;
  createdAt: string;
};

type DownloadPayload = {
  url: string;
  filename?: string;
  mimeType?: string;
  sizeBytes?: number;
};

const WEB_SHARE_MAX_BYTES = 75 * 1024 * 1024;

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

function mediaPreviewSrc(photo: Photo) {
  return photo.mediaType === "video" ? photo.thumbnailUrl ?? photo.url : photo.url;
}

function canTryNativeFileShare(payload: DownloadPayload) {
  const share = navigator.share;
  const canShare = navigator.canShare;
  if (typeof share !== "function" || typeof canShare !== "function") return false;
  if (!window.isSecureContext) return false;
  if (payload.sizeBytes && payload.sizeBytes > WEB_SHARE_MAX_BYTES) return false;
  return true;
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

async function tryNativeFileShare(payload: DownloadPayload) {
  if (!canTryNativeFileShare(payload)) return false;

  const response = await fetch(payload.url);
  if (!response.ok) throw new Error("Nie udało się pobrać pliku do zapisu.");

  const blob = await response.blob();
  const file = new File([blob], payload.filename || "wspomnienie", {
    type: payload.mimeType || blob.type || "application/octet-stream",
  });

  if (!navigator.canShare?.({ files: [file] })) return false;
  await navigator.share({ files: [file] });
  return true;
}

function MediaSlide({
  photo,
  active,
  onMediaClick,
  onMediaError,
}: {
  photo: Photo;
  active: boolean;
  onMediaClick: () => void;
  onMediaError?: () => void;
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
      <video
        className="lightbox-media"
        src={photo.url}
        muted
        playsInline
        preload="metadata"
        onClick={(event) => event.stopPropagation()}
        onError={onMediaError}
        onContextMenu={(event) => event.preventDefault()}
      />
    );
  }

  return (
    <img
      className="lightbox-media"
      src={mediaPreviewSrc(photo)}
      alt={active ? "Duże zdjęcie z wesela dodane przez gościa" : "Podgląd sąsiedniego wspomnienia"}
      onClick={(event) => {
        event.stopPropagation();
        onMediaClick();
      }}
      onError={onMediaError}
      draggable={false}
    />
  );
}

export default function PhotoLightbox({
  photos,
  activeIndex,
  slug,
  guestCode,
  onClose,
  onSelect,
  onMediaError,
}: {
  photos: Photo[];
  activeIndex: number;
  slug: string;
  guestCode: string;
  onClose: () => void;
  onSelect: (index: number) => void;
  onMediaError?: () => void;
}) {
  const [downloading, setDownloading] = useState(false);
  const [downloadLabel, setDownloadLabel] = useState("Pobierz");
  const [controlsHidden, setControlsHidden] = useState(false);
  const [emblaRef, emblaApi] = useEmblaCarousel({
    align: "center",
    containScroll: false,
    dragFree: false,
    duration: 24,
    loop: photos.length > 1,
    skipSnaps: false,
    startIndex: activeIndex,
  });
  const photo = photos[activeIndex];
  const total = photos.length;

  const selectCurrentSlide = useCallback(() => {
    if (!emblaApi) return;
    const nextIndex = emblaApi.selectedScrollSnap();
    onSelect(nextIndex);
    setControlsHidden(false);
    setDownloadLabel("Pobierz");
  }, [emblaApi, onSelect]);

  useEffect(() => {
    if (!emblaApi) return;
    emblaApi.on("select", selectCurrentSlide);
    emblaApi.on("reInit", selectCurrentSlide);

    return () => {
      emblaApi.off("select", selectCurrentSlide);
      emblaApi.off("reInit", selectCurrentSlide);
    };
  }, [emblaApi, selectCurrentSlide]);

  useEffect(() => {
    if (!emblaApi) return;
    if (emblaApi.selectedScrollSnap() !== activeIndex) emblaApi.scrollTo(activeIndex);
  }, [activeIndex, emblaApi]);

  async function handleDownload() {
    if (downloading || !photo) return;
    setDownloading(true);
    setDownloadLabel("Zapisujemy...");
    try {
      const res = await fetch("/api/gallery/download", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug, guestCode, photoId: photo.id }),
      });
      const data = await res.json();
      if (!res.ok || !data.url) throw new Error(data.error ?? "Nie udało się przygotować pobierania.");
      const payload: DownloadPayload = data;
      try {
        const shared = await tryNativeFileShare(payload);
        if (shared) {
          setDownloadLabel("Sprawdź galerię");
          return;
        }
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") {
          setDownloadLabel("Pobierz");
          return;
        }
      }

      startBrowserDownload(payload.url);
      setDownloadLabel("Sprawdź galerię");
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
    emblaApi?.scrollPrev();
  }

  function scrollNext() {
    setControlsHidden(false);
    setDownloadLabel("Pobierz");
    emblaApi?.scrollNext();
  }

  if (!photo) return null;
  const saved = downloadLabel === "Sprawdź galerię";

  return (
    <div className={`lightbox${controlsHidden ? " is-controls-hidden" : ""}`} role="dialog" aria-modal="true" aria-label="Podgląd pliku">
      <div className="lightbox-top" onClick={(event) => event.stopPropagation()}>
        <strong>
          {activeIndex + 1} / {total}
        </strong>
        <div className="lightbox-actions">
          <button
            className={`round-control lightbox-download${downloading ? " is-saving" : ""}${saved ? " is-saved" : ""}`}
            onClick={(event) => {
              event.stopPropagation();
              void handleDownload();
            }}
            disabled={downloading}
            aria-label={downloadLabel}
            title={downloadLabel}
          >
            <svg className="lightbox-download-icon" viewBox="0 0 24 24" aria-hidden="true">
              {saved ? <>
                <path d="m5 12 4.2 4.2L19 6.8" />
              </> : <>
                <path d="M12 4v10" />
                <path d="m8 10 4 4 4-4" />
                <path d="M5 19h14" />
              </>}
            </svg>
            <span className="sr-only">{downloadLabel}</span>
          </button>
          <button className="round-control" onClick={onClose} aria-label="Zamknij podgląd pliku">×</button>
        </div>
      </div>

      {total > 1 && <button className="round-control lightbox-nav lightbox-prev" onClick={scrollPrevious} aria-label="Poprzedni plik">‹</button>}

      <div className="lightbox-stage" ref={emblaRef} onClick={(event) => event.stopPropagation()}>
        <div className="lightbox-track">
          {photos.map((item, index) => (
            <div className="lightbox-slide" key={item.id} aria-hidden={index !== activeIndex}>
              <MediaSlide
                photo={item}
                active={index === activeIndex}
                onMediaClick={() => setControlsHidden((hidden) => !hidden)}
                onMediaError={onMediaError}
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
