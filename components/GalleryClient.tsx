"use client";
import Link from "next/link";
import { type TouchEvent, useCallback, useEffect, useRef, useState } from "react";
import EmptyGalleryState from "@/components/EmptyGalleryState";
import ErrorState from "@/components/ErrorState";
import GalleryGrid from "@/components/GalleryGrid";
import LoadingGalleryState from "@/components/LoadingGalleryState";
import PhotoLightbox from "@/components/PhotoLightbox";
import WeddingShell from "@/components/WeddingShell";

const PAGE_SIZE = 30;
const PULL_REFRESH_THRESHOLD = 68;
const PULL_REFRESH_MAX = 88;
type Photo = { id: string; url: string; thumbnailUrl?: string; guestName?: string; createdAt: string };

function photoCountLabel(count: number) {
  if (count === 1) return "1 zdjęcie";
  const lastTwo = count % 100;
  const last = count % 10;
  if (last >= 2 && last <= 4 && (lastTwo < 12 || lastTwo > 14)) return `${count} zdjęcia`;
  return `${count} zdjęć`;
}

function mergeUniquePhotos(current: Photo[], next: Photo[]) {
  const seen = new Set(current.map((photo) => photo.id));
  return [...current, ...next.filter((photo) => {
    if (seen.has(photo.id)) return false;
    seen.add(photo.id);
    return true;
  })];
}

export default function GalleryClient({ initialSlug, initialCode = "" }: { initialSlug: string; initialCode?: string }) {
  const [slug] = useState(initialSlug);
  const [draftCode, setDraftCode] = useState(initialCode);
  const [verifiedCode, setVerifiedCode] = useState("");
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(Boolean(initialCode));
  const [loadingMore, setLoadingMore] = useState(false);
  const [pullDistance, setPullDistance] = useState(0);
  const [pullRefreshing, setPullRefreshing] = useState(false);
  const [hasRequested, setHasRequested] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const active = activeIndex === null ? null : photos[activeIndex];
  const initialLoadStarted = useRef(false);
  const pullStartY = useRef<number | null>(null);
  const uploadParams = new URLSearchParams({ returnTo: "gallery" });
  if (verifiedCode) uploadParams.set("code", verifiedCode);
  const uploadHref = `/wedding/${encodeURIComponent(slug)}?${uploadParams.toString()}`;
  const landingHref = verifiedCode ? `/?code=${encodeURIComponent(verifiedCode)}` : "/";
  const canPullRefresh = hasRequested && Boolean(verifiedCode) && !loading && !loadingMore && !pullRefreshing && activeIndex === null;
  const invalidCodeError = error.toLowerCase().includes("kod");
  const errorTitle = invalidCodeError ? "Niepoprawny kod" : "Nie udało się pobrać galerii";
  const errorDescription = invalidCodeError ? "Sprawdź kod weselny i spróbuj ponownie." : "Spróbuj ponownie za chwilę.";
  const showCodeCard = !initialCode && !verifiedCode;

  const load = useCallback(async (nextSlug = slug, nextGuestCode = draftCode, append = false, silent = false) => {
    const codeToVerify = nextGuestCode.trim();
    const offset = append ? photos.length : 0;
    if (append) setLoadingMore(true);
    else if (!silent) { setHasRequested(false); setLoading(true); setHasMore(false); }
    if (!silent) setError("");
    try {
      const res = await fetch("/api/gallery", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ slug: nextSlug, guestCode: codeToVerify, limit: PAGE_SIZE, offset }) });
      const data = await res.json();
      if (!res.ok) {
        if (!append && !silent) {
          setPhotos([]);
          setTotalCount(0);
          setVerifiedCode("");
          setHasMore(false);
          setError(data.error ?? "Nie udało się pobrać galerii.");
        }
      }
      else {
        const nextPhotos = data.photos ?? [];
        setPhotos((current) => append ? mergeUniquePhotos(current, nextPhotos) : nextPhotos);
        setTotalCount(Number(data.totalCount) || 0);
        setHasMore(Boolean(data.hasMore));
        setVerifiedCode(codeToVerify);
        setDraftCode(codeToVerify);
        setHasRequested(true);
      }
    } catch {
      if (!append && !silent) {
        setPhotos([]);
        setTotalCount(0);
        setVerifiedCode("");
        setHasMore(false);
        setError("Nie udało się pobrać galerii.");
      }
    }
    finally { if (append) setLoadingMore(false); else if (!silent) setLoading(false); }
  }, [draftCode, photos.length, slug]);

  function handleCodeChange(value: string) {
    setDraftCode(value);
    setError("");
    setPhotos([]);
    setTotalCount(0);
    setHasRequested(false);
    setHasMore(false);
    if (value.trim() !== verifiedCode) setVerifiedCode("");
  }

  function handlePullStart(event: TouchEvent<HTMLDivElement>) {
    if (!canPullRefresh || window.scrollY > 0) return;
    pullStartY.current = event.touches[0]?.clientY ?? null;
  }

  function handlePullMove(event: TouchEvent<HTMLDivElement>) {
    if (!canPullRefresh || pullStartY.current === null || window.scrollY > 0) return;
    const currentY = event.touches[0]?.clientY ?? pullStartY.current;
    const distance = currentY - pullStartY.current;

    if (distance <= 0) {
      setPullDistance(0);
      return;
    }

    if (distance > 12) event.preventDefault();
    setPullDistance(Math.min(PULL_REFRESH_MAX, distance * 0.48));
  }

  function handlePullEnd() {
    if (!canPullRefresh || pullStartY.current === null) {
      pullStartY.current = null;
      setPullDistance(0);
      return;
    }

    const shouldRefresh = pullDistance >= PULL_REFRESH_THRESHOLD;
    pullStartY.current = null;

    if (!shouldRefresh) {
      setPullDistance(0);
      return;
    }

    setPullRefreshing(true);
    setPullDistance(64);
    void load(slug, verifiedCode, false, true).finally(() => {
      setPullRefreshing(false);
      setPullDistance(0);
    });
  }

  useEffect(() => { if (!initialCode || initialLoadStarted.current) return; initialLoadStarted.current = true; void load(initialSlug, initialCode); }, [initialSlug, initialCode, load]);
  useEffect(() => { if (activeIndex === null) return; function onKeyDown(event: KeyboardEvent) { if (event.key === "Escape") setActiveIndex(null); if (event.key === "ArrowRight") setActiveIndex((c) => c === null ? c : (c + 1) % photos.length); if (event.key === "ArrowLeft") setActiveIndex((c) => c === null ? c : (c - 1 + photos.length) % photos.length); } window.addEventListener("keydown", onKeyDown); return () => window.removeEventListener("keydown", onKeyDown); }, [activeIndex, photos.length]);

  return <WeddingShell wide screen>
    <div className="gallery-refresh-surface" onTouchStart={handlePullStart} onTouchMove={handlePullMove} onTouchEnd={handlePullEnd} onTouchCancel={handlePullEnd}>
      <div className={`pull-refresh-indicator${pullDistance > 0 || pullRefreshing ? " is-visible" : ""}${pullRefreshing ? " is-refreshing" : ""}${pullDistance >= PULL_REFRESH_THRESHOLD ? " is-ready" : ""}`} aria-hidden="true">
        <span className="pull-refresh-spinner" />
        <span>{pullRefreshing ? "Odświeżamy galerię…" : pullDistance >= PULL_REFRESH_THRESHOLD ? "Puść, aby odświeżyć" : "Przeciągnij, aby odświeżyć"}</span>
      </div>
      <div className="gallery-refresh-content" style={{ transform: pullDistance ? `translateY(${pullDistance}px)` : undefined }}>
        <header className="mobile-topbar">
          <Link href={landingHref} aria-label="Wróć do ekranu startowego">‹</Link>
          <span>NATALIA &amp; ROBERT</span>
          <span className="mobile-topbar-action" aria-hidden="true">
            <span className="mobile-topbar-heart-icon mobile-topbar-heart-icon-filled" />
          </span>
        </header>
        <section className="gallery-intro"><h1>Galeria wspomnień</h1><p>Zdjęcia dodane przez naszych gości</p>{hasRequested && photos.length > 0 && totalCount > 0 && <span className="gallery-photo-count">{photoCountLabel(totalCount)} od gości</span>}<Link className="btn btn-primary gallery-add-button" href={uploadHref}><span className="cta-camera-icon" aria-hidden="true" /><span className="gallery-add-label">Dodaj zdjęcia</span></Link></section>
        {showCodeCard && <section className="gallery-code-card"><div className="floating-field"><label htmlFor="guestCode">Kod weselny</label><input id="guestCode" value={draftCode} onChange={(e)=>handleCodeChange(e.target.value)} placeholder="Wpisz kod weselny" /></div><button className="btn btn-ghost" onClick={()=>load()} disabled={loading || !draftCode.trim()}><span className="gallery-code-icon" aria-hidden="true" /><span className="gallery-code-label">{loading ? "Przygotowujemy galerię…" : "Pokaż galerię"}</span></button></section>}
        {loading && <LoadingGalleryState showCopy={Boolean(initialCode)} />}
        {!loading && error && <ErrorState title={errorTitle} description={errorDescription} onRefresh={invalidCodeError ? undefined : () => load()} />}
        {!loading && !error && hasRequested && photos.length > 0 && <GalleryGrid photos={photos} onOpen={setActiveIndex} />}
        {!loading && !error && hasRequested && photos.length > 0 && hasMore && <button className="btn btn-ghost gallery-load-more" onClick={() => load(slug, verifiedCode || draftCode, true)} disabled={loadingMore}>{loadingMore ? "Ładujemy zdjęcia…" : "Pokaż więcej zdjęć"}</button>}
        {!loading && !error && hasRequested && photos.length === 0 && <EmptyGalleryState href={uploadHref} />}
      </div>
    </div>
    {active && <PhotoLightbox photo={active} current={(activeIndex ?? 0) + 1} total={photos.length} onClose={() => setActiveIndex(null)} onPrevious={() => setActiveIndex((c) => c === null ? c : (c - 1 + photos.length) % photos.length)} onNext={() => setActiveIndex((c) => c === null ? c : (c + 1) % photos.length)} />}
  </WeddingShell>;
}
