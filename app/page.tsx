import Link from "next/link";
import WeddingHero from "@/components/WeddingHero";
import WeddingShell from "@/components/WeddingShell";
import { DEFAULT_EVENT_SLUG, galleryHref } from "@/lib/events/config";

export default function Home() {
  const slug = DEFAULT_EVENT_SLUG;
  return <WeddingShell centered>
    <section className="home-card memory-card">
      <WeddingHero eyebrow="Wspólna galeria weselna" subtitle="Wspólna galeria weselna" description="Jedno miejsce na najpiękniejsze kadry od rodziny i przyjaciół." />
      <div className="home-actions">
        <Link className="btn btn-primary" href={`/wedding/${slug}`}>Dodaj zdjęcia</Link>
        <Link className="btn btn-ghost" href={galleryHref(slug)}>Zobacz galerię</Link>
      </div>
    </section>
  </WeddingShell>;
}
