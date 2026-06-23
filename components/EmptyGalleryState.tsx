import Link from "next/link";

export default function EmptyGalleryState({ href }: { href: string }) {
  return <section className="memory-card empty-gallery-state">
    <div className="empty-icon">♡</div>
    <h2>Jeszcze nie ma zdjęć</h2>
    <p>Bądź pierwszy i dodaj wspomnienie z wesela</p>
    <Link className="btn btn-primary" href={href}>Dodaj zdjęcia</Link>
  </section>;
}
