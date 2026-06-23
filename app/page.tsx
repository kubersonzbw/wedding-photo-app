import UploadForm from "@/components/UploadForm";

export default function Home() {
  const slug = process.env.DEFAULT_EVENT_SLUG ?? "robert-natalia";
  return <main className="page-shell"><section className="hero"><p className="eyebrow">Galeria weselna</p><h1>Robert & Natalia</h1><p>Dodaj zdjęcia z naszego wesela ❤️</p></section><UploadForm slug={slug} /></main>;
}
