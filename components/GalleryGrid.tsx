/* eslint-disable @next/next/no-img-element */

type Photo = { id: string; url: string; thumbnailUrl?: string; mediaType?: "image" | "video"; guestName?: string; createdAt: string };

export default function GalleryGrid({ photos, onOpen, onMediaError }: { photos: Photo[]; onOpen: (index: number) => void; onMediaError?: () => void }) {
  return <div className="memory-grid" aria-label="Zdjęcia i filmy dodane przez gości">
    {photos.map((photo, index) => <button key={photo.id} onClick={() => onOpen(index)} className="memory-tile">
      {photo.mediaType === "video" ? <>
        {photo.thumbnailUrl ? <img src={photo.thumbnailUrl} alt="Miniatura filmu z wesela dodanego przez gościa" loading="lazy" decoding="async" onError={onMediaError} /> : <video src={photo.url} muted playsInline preload="metadata" onError={onMediaError} />}
        <span className="memory-video-badge" aria-hidden="true">▶</span>
      </> : <img src={photo.thumbnailUrl ?? photo.url} alt="Zdjęcie z wesela dodane przez gościa" loading="lazy" decoding="async" onError={onMediaError} />}
      {photo.guestName && <span className="memory-author">od {photo.guestName}</span>}
    </button>)}
  </div>;
}
