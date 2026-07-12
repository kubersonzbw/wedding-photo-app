"use client";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import EmptyGalleryState from "@/components/EmptyGalleryState";
import ErrorState from "@/components/ErrorState";
import GalleryGrid from "@/components/GalleryGrid";
import LoadingGalleryState from "@/components/LoadingGalleryState";
import PhotoLightbox from "@/components/PhotoLightbox";
import WeddingShell from "@/components/WeddingShell";

const DEFAULT_SLUG = process.env.NEXT_PUBLIC_DEFAULT_EVENT_SLUG ?? "robert-natalia";
const PAGE_SIZE = 30;
type Photo = { id: string; url: string; thumbnailUrl?: string; guestName?: string; createdAt: string };

export default function GalleryClient({ initialSlug = DEFAULT_SLUG, initialCode = "" }: { initialSlug?: string; initialCode?: string }) {
  const [slug] = useState(initialSlug);
  const [draftCode, setDraftCode] = useState(initialCode);
  const [verifiedCode, setVerifiedCode] = useState("");
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(Boolean(initialCode));
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasRequested, setHasRequested] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const active = activeIndex === null ? null : photos[activeIndex];
  const initialLoadStarted = useRef(false);
  const uploadHref = `/wedding/${encodeURIComponent(slug)}${verifiedCode ? `?code=${encodeURIComponent(verifiedCode)}` : ""}`;
  const invalidCodeError = error.toLowerCase().includes("kod");
  const errorTitle = invalidCodeError ? "Niepoprawny kod" : "Nie udało się pobrać galerii";
  const errorDescription = invalidCodeError ? "Sprawdź kod weselny i spróbuj ponownie." : "Spróbuj ponownie za chwilę.";

  const load = useCallback(async (nextSlug = slug, nextGuestCode = draftCode, append = false) => {
    const codeToVerify = nextGuestCode.trim();
    const offset = append ? photos.length : 0;
    if (append) setLoadingMore(true);
    else { setHasRequested(false); setLoading(true); setHasMore(false); }
    setError("");
    try {
      const res = await fetch("/api/gallery", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ slug: nextSlug, guestCode: codeToVerify, limit: PAGE_SIZE, offset }) });
      const data = await res.json();
      if (!res.ok) {
        if (!append) {
          setPhotos([]);
          setVerifiedCode("");
          setHasMore(false);
          setError(data.error ?? "Nie udało się pobrać galerii.");
        }
      }
      else {
        const nextPhotos = data.photos ?? [];
        setPhotos((current) => append ? [...current, ...nextPhotos] : nextPhotos);
        setHasMore(Boolean(data.hasMore));
        setVerifiedCode(codeToVerify);
        setDraftCode(codeToVerify);
        setHasRequested(true);
      }
    } catch {
      if (!append) {
        setPhotos([]);
        setVerifiedCode("");
        setHasMore(false);
        setError("Nie udało się pobrać galerii.");
      }
    }
    finally { if (append) setLoadingMore(false); else setLoading(false); }
  }, [draftCode, photos.length, slug]);

  function handleCodeChange(value: string) {
    setDraftCode(value);
    setError("");
    setPhotos([]);
    setHasRequested(false);
    setHasMore(false);
    if (value.trim() !== verifiedCode) setVerifiedCode("");
  }

  useEffect(() => { if (!initialCode || initialLoadStarted.current) return; initialLoadStarted.current = true; void load(initialSlug, initialCode); }, [initialSlug, initialCode, load]);
  useEffect(() => { if (activeIndex === null) return; function onKeyDown(event: KeyboardEvent) { if (event.key === "Escape") setActiveIndex(null); if (event.key === "ArrowRight") setActiveIndex((c) => c === null ? c : (c + 1) % photos.length); if (event.key === "ArrowLeft") setActiveIndex((c) => c === null ? c : (c - 1 + photos.length) % photos.length); } window.addEventListener("keydown", onKeyDown); return () => window.removeEventListener("keydown", onKeyDown); }, [activeIndex, photos.length]);

  return <WeddingShell wide screen>
    <header className="mobile-topbar">
      <Link href={uploadHref} aria-label="Wróć do dodawania zdjęć">‹</Link>
      <span>NATALIA &amp; ROBERT</span>
      <span className="mobile-topbar-action" aria-hidden="true">
        <span className="mobile-topbar-heart-icon mobile-topbar-heart-icon-filled" />
      </span>
    </header>
    <section className="gallery-intro"><h1>Galeria wspomnień</h1><p>Zdjęcia dodane przez naszych gości</p><Link className="btn btn-primary gallery-add-button" href={uploadHref}><span className="cta-camera-icon" aria-hidden="true" /><span className="gallery-add-label">Dodaj zdjęcia</span></Link></section>
    {!initialCode && <section className="gallery-code-card"><div className="floating-field"><label htmlFor="guestCode">Kod weselny</label><input id="guestCode" value={draftCode} onChange={(e)=>handleCodeChange(e.target.value)} placeholder="Wpisz kod weselny" /></div><button className="btn btn-ghost" onClick={()=>load()} disabled={loading || !draftCode.trim()}><span className="gallery-code-icon" aria-hidden="true" /><span className="gallery-code-label">{loading ? "Przygotowujemy galerię…" : "Pokaż galerię"}</span></button></section>}
    {loading && <LoadingGalleryState />}
    {!loading && error && <ErrorState title={errorTitle} description={errorDescription} onRefresh={() => load()} />}
    {!loading && !error && hasRequested && photos.length > 0 && <GalleryGrid photos={photos} onOpen={setActiveIndex} />}
    {!loading && !error && hasRequested && photos.length > 0 && hasMore && <button className="btn btn-ghost gallery-load-more" onClick={() => load(slug, verifiedCode || draftCode, true)} disabled={loadingMore}>{loadingMore ? "Ładujemy zdjęcia…" : "Pokaż więcej zdjęć"}</button>}
    {!loading && !error && hasRequested && photos.length === 0 && <EmptyGalleryState href={uploadHref} />}
    {active && <PhotoLightbox photo={active} current={(activeIndex ?? 0) + 1} total={photos.length} onClose={() => setActiveIndex(null)} onPrevious={() => setActiveIndex((c) => c === null ? c : (c - 1 + photos.length) % photos.length)} onNext={() => setActiveIndex((c) => c === null ? c : (c + 1) % photos.length)} />}
  </WeddingShell>;
}
