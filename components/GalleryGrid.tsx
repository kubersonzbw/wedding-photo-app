/* eslint-disable @next/next/no-img-element */

type Photo = { id: string; url: string; thumbnailUrl?: string; guestName?: string; createdAt: string };

export default function GalleryGrid({ photos, onOpen }: { photos: Photo[]; onOpen: (index: number) => void }) {
  return <div className="memory-grid" aria-label="Zdjęcia dodane przez gości">
    {photos.map((photo, index) => <button key={photo.id} onClick={() => onOpen(index)} className="memory-tile">
      <img src={photo.thumbnailUrl ?? photo.url} alt="Zdjęcie z wesela dodane przez gościa" loading="lazy" decoding="async" />
      {photo.guestName && <span className="memory-author">od {photo.guestName}</span>}
    </button>)}
  </div>;
}
