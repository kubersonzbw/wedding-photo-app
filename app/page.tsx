import Link from "next/link";
import WeddingHero from "@/components/WeddingHero";
import WeddingShell from "@/components/WeddingShell";
import { DEFAULT_EVENT_SLUG, galleryHref } from "@/lib/events/config";

export default function Home() {
  const slug = DEFAULT_EVENT_SLUG;
  return <WeddingShell centered>
    <section className="home-card invite-screen">
      <WeddingHero eyebrow="NATALIA & ROBERT" subtitle="Wspólna galeria weselna" description="Podziel się zdjęciami z naszego dnia i twórzmy razem piękne wspomnienia." />
      <div className="home-actions">
        <Link className="btn btn-primary" href={`/wedding/${slug}`}><span aria-hidden="true">▣</span>Dodaj zdjęcia</Link>
        <Link className="btn btn-ghost" href={galleryHref(slug)}><span aria-hidden="true">♡</span>Zobacz galerię</Link>
      </div>
    </section>
  </WeddingShell>;
}
