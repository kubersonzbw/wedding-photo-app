/* eslint-disable @next/next/no-img-element */
import { useEffect, useRef, useState } from "react";
import { useWindowVirtualizer } from "@tanstack/react-virtual";

type Photo = { id: string; url: string; thumbnailUrl?: string; previewUrl?: string; mediaType?: "image" | "video"; guestName?: string; createdAt: string };

const GRID_COLUMNS = 3;
const GRID_GAP = 7;
const OVERSCAN_ROWS = 8;

export default function GalleryGrid({ photos, onOpen, onMediaError }: { photos: Photo[]; onOpen: (index: number) => void; onMediaError?: (index: number) => void }) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [containerWidth, setContainerWidth] = useState(0);
  const [scrollMargin, setScrollMargin] = useState(0);
  const rowCount = Math.ceil(photos.length / GRID_COLUMNS);
  const tileWidth = containerWidth > 0 ? (containerWidth - GRID_GAP * (GRID_COLUMNS - 1)) / GRID_COLUMNS : 118;
  const rowVirtualizer = useWindowVirtualizer({
    count: rowCount,
    estimateSize: () => tileWidth,
    gap: GRID_GAP,
    overscan: OVERSCAN_ROWS,
    scrollMargin,
  });

  useEffect(() => {
    const element = containerRef.current;
    if (!element) return;

    function measure() {
      const currentElement = containerRef.current;
      if (!currentElement) return;
      const rect = currentElement.getBoundingClientRect();
      setContainerWidth(rect.width);
      setScrollMargin(rect.top + window.scrollY);
      rowVirtualizer.measure();
    }

    let frame = 0;
    function scheduleMeasure() {
      window.cancelAnimationFrame(frame);
      frame = window.requestAnimationFrame(measure);
    }

    measure();
    const resizeObserver = new ResizeObserver(scheduleMeasure);
    resizeObserver.observe(element);
    window.addEventListener("resize", scheduleMeasure);
    return () => {
      window.cancelAnimationFrame(frame);
      resizeObserver.disconnect();
      window.removeEventListener("resize", scheduleMeasure);
    };
  }, [rowVirtualizer]);

  return <div className="memory-virtual-grid" ref={containerRef} aria-label="Zdjęcia i filmy dodane przez gości">
    <div className="memory-virtual-window" style={{ height: rowVirtualizer.getTotalSize() }}>
      {rowVirtualizer.getVirtualItems().map((virtualRow) => {
        const row = virtualRow.index;
        const rowPhotos = photos.slice(row * GRID_COLUMNS, row * GRID_COLUMNS + GRID_COLUMNS);
        return <div className="memory-grid memory-grid-row" key={virtualRow.key} style={{ transform: `translateY(${virtualRow.start - rowVirtualizer.options.scrollMargin}px)` }}>
          {rowPhotos.map((photo, column) => {
            const index = row * GRID_COLUMNS + column;
            return <button key={photo.id} onClick={() => onOpen(index)} className="memory-tile">
              {photo.mediaType === "video" ? <>
                {photo.thumbnailUrl
                  ? <img src={photo.thumbnailUrl} alt="Miniatura filmu z wesela dodanego przez gościa" loading="lazy" decoding="async" onError={() => onMediaError?.(index)} />
                  : <span className="memory-video-placeholder" aria-hidden="true" />}
                <span className="memory-video-badge" aria-hidden="true">▶</span>
              </> : <img src={photo.thumbnailUrl ?? photo.previewUrl ?? photo.url} alt="Zdjęcie z wesela dodane przez gościa" loading="lazy" decoding="async" onError={() => onMediaError?.(index)} />}
              {photo.guestName && <span className="memory-author">od {photo.guestName}</span>}
            </button>;
          })}
        </div>;
      })}
    </div>
  </div>;
}
