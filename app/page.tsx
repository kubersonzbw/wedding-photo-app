import Link from "next/link";
import UploadForm from "@/components/UploadForm";
import { galleryHref } from "@/lib/events/config";

export default function Home() {
  const slug = process.env.NEXT_PUBLIC_DEFAULT_EVENT_SLUG ?? "robert-natalia";
  return <main className="page-shell"><section className="hero"><p className="eyebrow">Galeria weselna</p><h1>Robert & Natalia</h1><p>Dodaj zdjęcia do wspólnej galerii ❤️</p><p>Zdjęcia pojawią się od razu w galerii.</p><Link className="btn btn-secondary hero-link" href={galleryHref(slug)}>Zobacz galerię zdjęć</Link></section><UploadForm slug={slug} /></main>;
}
