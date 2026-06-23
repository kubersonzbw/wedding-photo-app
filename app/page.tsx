import Link from "next/link";
import { DEFAULT_EVENT_SLUG, galleryHref } from "@/lib/events/config";

export default function Home() {
  const slug = DEFAULT_EVENT_SLUG;
  return <main className="page-shell home-shell">
    <section className="hero home-hero card">
      <p className="eyebrow">Galeria weselna</p>
      <h1>Robert & Natalia</h1>
      <p className="hero-subtitle">Elegancka przestrzeń na wspólne wspomnienia z wesela.</p>
      <div className="home-actions">
        <Link className="btn" href={`/wedding/${slug}`}>Dodaj zdjęcia</Link>
        <Link className="btn btn-secondary" href={galleryHref(slug)}>Zobacz galerię</Link>
      </div>
    </section>
  </main>;
}
