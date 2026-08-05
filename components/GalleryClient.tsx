"use client";
import Link from "next/link";
import { type TouchEvent as ReactTouchEvent, useCallback, useEffect, useRef, useState } from "react";
import EmptyGalleryState from "@/components/EmptyGalleryState";
import ErrorState from "@/components/ErrorState";
import GalleryGrid from "@/components/GalleryGrid";
import LoadingGalleryState from "@/components/LoadingGalleryState";
import PhotoLightbox from "@/components/PhotoLightbox";
import WeddingShell from "@/components/WeddingShell";

const PAGE_SIZE = 30;
const LIGHTBOX_PREFETCH_REMAINING = 10;
const PULL_REFRESH_THRESHOLD = 68;
const PULL_REFRESH_MAX = 88;
type Photo = { id: string; url: string; thumbnailUrl?: string; previewUrl?: string; guestName?: string; createdAt: string };
type GalleryPhoto = Photo & { mediaType?: "image" | "video"; mimeType?: string };
type GalleryLoadResult = { ok: boolean; totalCount: number };
const NEW_MEMORY_CHECK_INTERVAL = 45000;
const MEDIA_REFRESH_ATTEMPT_LIMIT = 1;

function photoCountLabel(count: number) {
  if (count === 1) return "1 plik";
  const lastTwo = count % 100;
  const last = count % 10;
  if (last >= 2 && last <= 4 && (lastTwo < 12 || lastTwo > 14)) return `${count} pliki`;
  return `${count} plików`;
}

function mergeUniquePhotos(current: GalleryPhoto[], next: GalleryPhoto[]) {
  const seen = new Set(current.map((photo) => photo.id));
  return [...current, ...next.filter((photo) => {
    if (seen.has(photo.id)) return false;
    seen.add(photo.id);
    return true;
  })];
}

function replaceKnownPhotos(current: GalleryPhoto[], refreshed: GalleryPhoto[]) {
  const byId = new Map(refreshed.map((photo) => [photo.id, photo]));
  return current.map((photo) => byId.get(photo.id) ?? photo);
}

export default function GalleryClient({ initialSlug, initialCode = "" }: { initialSlug: string; initialCode?: string }) {
  const [slug] = useState(initialSlug);
  const [draftCode, setDraftCode] = useState(initialCode);
  const [verifiedCode, setVerifiedCode] = useState("");
  const [photos, setPhotos] = useState<GalleryPhoto[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(Boolean(initialCode));
  const [loadingMore, setLoadingMore] = useState(false);
  const [pullDistance, setPullDistance] = useState(0);
  const [pullRefreshing, setPullRefreshing] = useState(false);
  const [newMemoriesAvailable, setNewMemoriesAvailable] = useState(false);
  const [noticeRefreshing, setNoticeRefreshing] = useState(false);
  const [mediaRefreshing, setMediaRefreshing] = useState(false);
  const [hasRequested, setHasRequested] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [hasUserScrolledGallery, setHasUserScrolledGallery] = useState(false);
  const active = activeIndex === null ? null : photos[activeIndex];
  const initialLoadStarted = useRef(false);
  const mediaRefreshInFlight = useRef(false);
  const mediaRefreshAttempts = useRef(new Map<number, number>());
  const loadMoreInFlight = useRef(false);
  const newMemoryCheckInFlight = useRef(false);
  const refreshSurfaceRef = useRef<HTMLDivElement | null>(null);
  const loadMoreRef = useRef<HTMLDivElement | null>(null);
  const pullStartY = useRef<number | null>(null);
  const pullDistanceRef = useRef(0);
  const uploadParams = new URLSearchParams({ returnTo: "gallery" });
  if (verifiedCode) uploadParams.set("code", verifiedCode);
  const uploadHref = `/wedding/${encodeURIComponent(slug)}?${uploadParams.toString()}`;
  const landingHref = verifiedCode ? `/?code=${encodeURIComponent(verifiedCode)}` : "/";
  const canPullRefresh = hasRequested && Boolean(verifiedCode) && !loading && !loadingMore && !pullRefreshing && activeIndex === null;
  const invalidCodeError = error.toLowerCase().includes("kod");
  const errorTitle = invalidCodeError ? "Niepoprawny kod" : "Nie udało się pobrać galerii";
  const errorDescription = invalidCodeError ? "Sprawdź kod weselny i spróbuj ponownie." : "Spróbuj ponownie za chwilę.";
  const showCodeCard = !initialCode && !verifiedCode;

  const load = useCallback(async (nextSlug = slug, nextGuestCode = draftCode, append = false, silent = false): Promise<GalleryLoadResult> => {
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
        return { ok: false, totalCount: 0 };
      }
      else {
        const nextPhotos = data.photos ?? [];
        const nextTotalCount = Number(data.totalCount) || 0;
        setPhotos((current) => append ? mergeUniquePhotos(current, nextPhotos) : nextPhotos);
        setTotalCount(nextTotalCount);
        setHasMore(Boolean(data.hasMore));
        setVerifiedCode(codeToVerify);
        setDraftCode(codeToVerify);
        setHasRequested(true);
        if (!append) setNewMemoriesAvailable(false);
        if (!append) {
          mediaRefreshAttempts.current.clear();
          setHasUserScrolledGallery(false);
        }
        return { ok: true, totalCount: nextTotalCount };
      }
    } catch {
      if (!append && !silent) {
        setPhotos([]);
        setTotalCount(0);
        setVerifiedCode("");
        setHasMore(false);
        setError("Nie udało się pobrać galerii.");
      }
      return { ok: false, totalCount: 0 };
    }
    finally { if (append) setLoadingMore(false); else if (!silent) setLoading(false); }
  }, [draftCode, photos.length, slug]);

  const checkForNewMemories = useCallback(async () => {
    if (document.hidden) return;
    if (!verifiedCode || newMemoryCheckInFlight.current || loading || loadingMore || pullRefreshing || noticeRefreshing) return;
    newMemoryCheckInFlight.current = true;
    try {
      const res = await fetch("/api/gallery", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ slug, guestCode: verifiedCode, limit: 1, offset: 0 }) });
      const data = await res.json();
      if (!res.ok) return;
      const nextTotalCount = Number(data.totalCount) || 0;
      if (nextTotalCount > totalCount) setNewMemoriesAvailable(true);
    } finally {
      newMemoryCheckInFlight.current = false;
    }
  }, [loading, loadingMore, noticeRefreshing, pullRefreshing, slug, totalCount, verifiedCode]);

  const refreshMediaUrls = useCallback(async (targetIndex?: number) => {
    if (!verifiedCode || mediaRefreshInFlight.current) return;
    const requestedIndex = typeof targetIndex === "number" && Number.isFinite(targetIndex) ? Math.max(0, Math.floor(targetIndex)) : null;
    if (requestedIndex !== null) {
      const attempts = mediaRefreshAttempts.current.get(requestedIndex) ?? 0;
      if (attempts >= MEDIA_REFRESH_ATTEMPT_LIMIT) return;
      mediaRefreshAttempts.current.set(requestedIndex, attempts + 1);
    }
    mediaRefreshInFlight.current = true;
    setMediaRefreshing(true);
    try {
      const offset = requestedIndex === null ? 0 : Math.floor(requestedIndex / PAGE_SIZE) * PAGE_SIZE;
      const limit = requestedIndex === null ? Math.min(Math.max(photos.length || PAGE_SIZE, PAGE_SIZE), 120) : PAGE_SIZE;
      const res = await fetch("/api/gallery", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ slug, guestCode: verifiedCode, limit, offset }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Nie udało się odświeżyć galerii.");
      const refreshedPhotos = data.photos ?? [];
      setPhotos((current) => replaceKnownPhotos(current, refreshedPhotos));
      const nextTotalCount = Number(data.totalCount) || 0;
      setTotalCount(nextTotalCount);
      setHasMore(photos.length < nextTotalCount);
    } catch {
      setError("Linki do podglądu wygasły. Odśwież galerię i spróbuj ponownie.");
    } finally {
      mediaRefreshInFlight.current = false;
      setMediaRefreshing(false);
    }
  }, [photos.length, slug, verifiedCode]);

  function handleCodeChange(value: string) {
    setDraftCode(value);
    setError("");
    setPhotos([]);
    setTotalCount(0);
    setHasRequested(false);
    setHasMore(false);
    if (value.trim() !== verifiedCode) setVerifiedCode("");
  }

  const setPullDistanceValue = useCallback((value: number) => {
    pullDistanceRef.current = value;
    setPullDistance(value);
  }, []);

  function handlePullStart(event: ReactTouchEvent<HTMLDivElement>) {
    if (!canPullRefresh || window.scrollY > 0) return;
    pullStartY.current = event.touches[0]?.clientY ?? null;
  }

  const handlePullMove = useCallback((event: TouchEvent) => {
    if (!canPullRefresh || pullStartY.current === null || window.scrollY > 0) return;
    const currentY = event.touches[0]?.clientY ?? pullStartY.current;
    const distance = currentY - pullStartY.current;

    if (distance <= 0) {
      setPullDistanceValue(0);
      return;
    }

    if (event.cancelable) event.preventDefault();
    setPullDistanceValue(Math.min(PULL_REFRESH_MAX, distance * 0.48));
  }, [canPullRefresh, setPullDistanceValue]);

  function handlePullEnd() {
    if (!canPullRefresh || pullStartY.current === null) {
      pullStartY.current = null;
      setPullDistance(0);
      return;
    }

    const shouldRefresh = pullDistanceRef.current >= PULL_REFRESH_THRESHOLD;
    pullStartY.current = null;

    if (!shouldRefresh) {
      setPullDistanceValue(0);
      return;
    }

    setPullRefreshing(true);
    setPullDistanceValue(64);
    void load(slug, verifiedCode, false, true).finally(() => {
      setPullRefreshing(false);
      setPullDistanceValue(0);
    });
  }

  function refreshNewMemories() {
    setNoticeRefreshing(true);
    void load(slug, verifiedCode, false, true).finally(() => setNoticeRefreshing(false));
  }

  const loadNextGalleryPage = useCallback(async () => {
    if (!hasMore || loadMoreInFlight.current || loadingMore || loading || !verifiedCode) return;
    loadMoreInFlight.current = true;
    try {
      await load(slug, verifiedCode, true, true);
    } finally {
      loadMoreInFlight.current = false;
    }
  }, [hasMore, load, loading, loadingMore, slug, verifiedCode]);

  const openPhoto = useCallback((index: number) => {
    setActiveIndex(index);
  }, []);

  useEffect(() => {
    if (activeIndex === null || !verifiedCode || !hasMore || loadingMore) return;
    if (photos.length - activeIndex > LIGHTBOX_PREFETCH_REMAINING) return;
    const timer = window.setTimeout(() => { void load(slug, verifiedCode, true, true); }, 0);
    return () => window.clearTimeout(timer);
  }, [activeIndex, hasMore, load, loadingMore, photos.length, slug, verifiedCode]);
  useEffect(() => { if (!initialCode || initialLoadStarted.current) return; initialLoadStarted.current = true; void load(initialSlug, initialCode); }, [initialSlug, initialCode, load]);
  useEffect(() => {
    const surface = refreshSurfaceRef.current;
    if (!surface) return;
    surface.addEventListener("touchmove", handlePullMove, { passive: false });
    return () => surface.removeEventListener("touchmove", handlePullMove);
  }, [handlePullMove]);
  useEffect(() => {
    if (!hasRequested || !verifiedCode) return;
    function handleVisibilityChange() {
      if (!document.hidden) void checkForNewMemories();
    }

    document.addEventListener("visibilitychange", handleVisibilityChange);
    const timer = window.setInterval(() => {
      if (!document.hidden) void checkForNewMemories();
    }, NEW_MEMORY_CHECK_INTERVAL);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.clearInterval(timer);
    };
  }, [checkForNewMemories, hasRequested, verifiedCode]);
  useEffect(() => {
    if (!hasRequested || !verifiedCode || hasUserScrolledGallery) return;

    function markGalleryScrolled() {
      if (window.scrollY > 24) setHasUserScrolledGallery(true);
    }

    window.addEventListener("scroll", markGalleryScrolled, { passive: true });
    return () => window.removeEventListener("scroll", markGalleryScrolled);
  }, [hasRequested, hasUserScrolledGallery, verifiedCode]);
  useEffect(() => {
    const marker = loadMoreRef.current;
    if (!marker || !hasMore || !verifiedCode || !hasUserScrolledGallery) return;
    const observer = new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting)) void loadNextGalleryPage();
    }, { rootMargin: "900px 0px" });
    observer.observe(marker);
    return () => observer.disconnect();
  }, [hasMore, hasUserScrolledGallery, loadNextGalleryPage, verifiedCode]);
  useEffect(() => { if (activeIndex === null) return; function onKeyDown(event: KeyboardEvent) { if (event.key === "Escape") setActiveIndex(null); if (event.key === "ArrowRight") setActiveIndex((c) => c === null ? c : Math.min(c + 1, photos.length - 1)); if (event.key === "ArrowLeft") setActiveIndex((c) => c === null ? c : Math.max(c - 1, 0)); } window.addEventListener("keydown", onKeyDown); return () => window.removeEventListener("keydown", onKeyDown); }, [activeIndex, photos.length]);

  return <WeddingShell wide screen>
    <div className="gallery-refresh-surface" ref={refreshSurfaceRef} onTouchStart={handlePullStart} onTouchEnd={handlePullEnd} onTouchCancel={handlePullEnd}>
      <div className={`pull-refresh-indicator${pullDistance > 0 || pullRefreshing ? " is-visible" : ""}${pullRefreshing ? " is-refreshing" : ""}${pullDistance >= PULL_REFRESH_THRESHOLD ? " is-ready" : ""}`} aria-hidden="true">
        <span className="pull-refresh-spinner" />
        <span>{pullRefreshing ? "Sprawdzamy wspomnienia…" : pullDistance >= PULL_REFRESH_THRESHOLD ? "Puść, aby sprawdzić" : "Przeciągnij, aby sprawdzić"}</span>
      </div>
      {newMemoriesAvailable && <div className="gallery-refresh-toast" role="status" aria-live="polite"><span>Pojawiły się nowe wspomnienia</span><button onClick={refreshNewMemories} disabled={noticeRefreshing}>{noticeRefreshing ? "Odświeżamy…" : "Odśwież"}</button></div>}
      <div className="gallery-refresh-content" style={{ transform: pullDistance ? `translateY(${pullDistance}px)` : undefined }}>
        <header className="mobile-topbar">
          <Link href={landingHref} aria-label="Wróć do ekranu startowego">‹</Link>
          <span>NATALIA &amp; ROBERT</span>
          <span className="mobile-topbar-action" aria-hidden="true">
            <span className="mobile-topbar-heart-icon mobile-topbar-heart-icon-filled" />
          </span>
        </header>
        <section className="gallery-intro"><h1>Galeria wspomnień</h1><p>Zdjęcia i filmy dodane przez naszych gości</p>{hasRequested && photos.length > 0 && totalCount > 0 && <span className="gallery-photo-count">{photoCountLabel(totalCount)} od gości</span>}<Link className="btn btn-primary gallery-add-button" href={uploadHref}><span className="cta-camera-icon" aria-hidden="true" /><span className="gallery-add-label">Dodaj wspomnienia</span></Link></section>
        {showCodeCard && <section className="gallery-code-card"><div className="floating-field"><label htmlFor="guestCode">Kod weselny</label><input id="guestCode" value={draftCode} onChange={(e)=>handleCodeChange(e.target.value)} placeholder="Wpisz kod weselny" /></div><button className="btn btn-ghost" onClick={()=>load()} disabled={loading || !draftCode.trim()}><span className="gallery-code-icon" aria-hidden="true" /><span className="gallery-code-label">{loading ? "Przygotowujemy galerię…" : "Pokaż galerię"}</span></button></section>}
        {loading && <LoadingGalleryState showCopy={Boolean(initialCode)} />}
        {!loading && error && <ErrorState title={errorTitle} description={errorDescription} onRefresh={invalidCodeError ? undefined : () => load()} />}
        {!loading && !error && mediaRefreshing && <p className="gallery-refresh-note" role="status">Odświeżamy podgląd galerii…</p>}
        {!loading && !error && hasRequested && photos.length > 0 && <GalleryGrid photos={photos} onOpen={openPhoto} onMediaError={refreshMediaUrls} />}
        {!loading && !error && hasRequested && photos.length > 0 && hasMore && <div className="gallery-infinite-loader" ref={loadMoreRef} role="status" aria-live="polite">{loadingMore && <span className="pull-refresh-spinner" />}{loadingMore ? "Ładujemy kolejne wspomnienia…" : "Przewiń dalej"}</div>}
        {!loading && !error && hasRequested && photos.length === 0 && <EmptyGalleryState href={uploadHref} />}
      </div>
    </div>
    {active && activeIndex !== null && <PhotoLightbox photos={photos} activeIndex={activeIndex} totalCount={totalCount} hasMore={hasMore} slug={slug} guestCode={verifiedCode} onClose={() => setActiveIndex(null)} onSelect={setActiveIndex} onMediaError={refreshMediaUrls} />}
  </WeddingShell>;
}
