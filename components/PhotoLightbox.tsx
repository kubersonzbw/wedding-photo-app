"use client";
/* eslint-disable @next/next/no-img-element */

type Photo = { id: string; url: string; thumbnailUrl?: string; guestName?: string; createdAt: string };

export default function PhotoLightbox({ photo, current, total, onClose, onPrevious, onNext }: { photo: Photo; current: number; total: number; onClose: () => void; onPrevious: () => void; onNext: () => void }) {
  return <div className="lightbox" onClick={onClose} role="dialog" aria-modal="true" aria-label="Podgląd zdjęcia">
    <div className="lightbox-top" onClick={(e) => e.stopPropagation()}>
      <span>Galeria wspomnień</span>
      <strong>{current} / {total}</strong>
      <button className="round-control" onClick={onClose} aria-label="Zamknij podgląd zdjęcia">×</button>
    </div>
    <button className="round-control lightbox-nav lightbox-prev" onClick={(e) => { e.stopPropagation(); onPrevious(); }} aria-label="Poprzednie zdjęcie">‹</button>
    <img src={photo.url} alt="Duże zdjęcie z wesela dodane przez gościa" onClick={(e) => e.stopPropagation()} />
    {photo.guestName && <span className="lightbox-author" onClick={(e) => e.stopPropagation()}>Dodane przez {photo.guestName}</span>}
    <button className="round-control lightbox-nav lightbox-next" onClick={(e) => { e.stopPropagation(); onNext(); }} aria-label="Następne zdjęcie">›</button>
  </div>;
}
