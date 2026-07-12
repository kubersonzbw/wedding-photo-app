import Link from "next/link";

export default function EmptyGalleryState({ href }: { href: string }) {
  return <section className="empty-gallery-state">
    <div className="empty-icon empty-camera-heart" aria-hidden="true">
      <svg viewBox="0 12 96 60">
        <path d="M20 25.5h14.2l4.2-7.5h19.2l4.2 7.5H76c4.4 0 8 3.6 8 8v24c0 4.4-3.6 8-8 8H20c-4.4 0-8-3.6-8-8v-24c0-4.4 3.6-8 8-8Z" />
        <path d="M67.5 33h7" />
        <circle cx="48" cy="46" r="13.5" />
        <path className="empty-camera-heart-fill" d="M48 54.1s-6.55-4.2-8.52-8.02c-1.58-3.05.22-6.33 3.57-6.33 1.93 0 3.16 1.04 3.81 1.9.28.36.84.36 1.12 0 .65-.86 1.88-1.9 3.81-1.9 3.35 0 5.15 3.28 3.57 6.33C54.55 49.9 48 54.1 48 54.1Z" />
      </svg>
    </div>
    <h2>Jeszcze nie ma zdjęć w galerii</h2>
    <p>Bądź pierwszy i dodaj wspomnienie z wesela</p>
    <Link className="btn btn-primary" href={href}>Dodaj zdjęcia</Link>
  </section>;
}
