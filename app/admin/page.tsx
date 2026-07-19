"use client";
/* eslint-disable @next/next/no-img-element */
import type { FormEvent } from "react";
import { useEffect, useState } from "react";
import WeddingShell from "@/components/WeddingShell";

type PhotoStatus = "approved" | "hidden";
type AdminAction = PhotoStatus | "deleted";
type FilterStatus = "all" | PhotoStatus;
type PhotoCounts = Record<FilterStatus, number>;
type Photo = {
  id: string;
  url?: string;
  storage_path: string;
  status: PhotoStatus;
  created_at: string;
  original_filename?: string;
  mime_type?: string;
  guests?: { name?: string };
  events?: { title?: string; slug?: string };
};
type AdminEvent = {
  slug?: string;
  title?: string;
  domain?: string;
};

const FILTERS: Array<{ value: FilterStatus; label: string }> = [
  { value: "all", label: "Wszystkie" },
  { value: "approved", label: "Widoczne" },
  { value: "hidden", label: "Ukryte" },
];
const EMPTY_COUNTS: PhotoCounts = { all: 0, approved: 0, hidden: 0 };
const PAGE_SIZE = 30;

function statusLabel(status: PhotoStatus) {
  if (status === "approved") return "Widoczne";
  return "Ukryte";
}

function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleString("pl-PL", { dateStyle: "short", timeStyle: "short" });
}

function isVideo(photo: Photo) {
  return String(photo.mime_type ?? "").startsWith("video/");
}

function uploadUrl(baseUrl: string, slug: string, code: string) {
  const cleanBase = baseUrl.trim().replace(/\/+$/, "");
  const cleanSlug = slug.trim();
  const cleanCode = code.trim();
  if (!cleanBase || !cleanSlug) return "";

  const params = new URLSearchParams();
  if (cleanCode) params.set("code", cleanCode);
  const query = params.toString();
  return `${cleanBase}/wedding/${encodeURIComponent(cleanSlug)}${query ? `?${query}` : ""}`;
}

function qrFileHref(url: string, slug: string, format: "svg" | "png", disposition: "attachment" | "inline" = "attachment") {
  const params = new URLSearchParams({
    url,
    format,
    filename: `${slug || "wedding"}-upload-qr`,
  });
  if (disposition === "inline") params.set("disposition", "inline");
  return `/api/admin/qr?${params.toString()}`;
}

export default function AdminPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [sessionEmail, setSessionEmail] = useState("");
  const [status, setStatus] = useState<FilterStatus>("all");
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [counts, setCounts] = useState<PhotoCounts>(EMPTY_COUNTS);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [loggingIn, setLoggingIn] = useState(false);
  const [actionId, setActionId] = useState("");
  const [error, setError] = useState("");
  const [hasMore, setHasMore] = useState(false);
  const [adminEvent, setAdminEvent] = useState<AdminEvent | null>(null);
  const [eventError, setEventError] = useState("");
  const [baseUrl] = useState(() => typeof window === "undefined" ? "" : window.location.origin);
  const [qrSlug, setQrSlug] = useState("");
  const [qrCode, setQrCode] = useState("");
  const [qrOpen, setQrOpen] = useState(false);
  const [copiedQrUrl, setCopiedQrUrl] = useState(false);
  const qrUrl = uploadUrl(baseUrl, qrSlug, qrCode);

  async function load(currentStatus = status, append = false) {
    const offset = append ? photos.length : 0;
    if (append) setLoadingMore(true);
    else {
      setLoading(true);
      setPhotos([]);
      setHasMore(false);
    }
    setError("");
    try {
      const res = await fetch(`/api/admin/photos?status=${currentStatus}&limit=${PAGE_SIZE}&offset=${offset}`, { cache: "no-store" });
      const data = await res.json();
      if (res.status === 401) {
        setSessionEmail("");
        setPhotos([]);
        setCounts(EMPTY_COUNTS);
        setHasMore(false);
        return;
      }
      if (!res.ok) throw new Error(data.error ?? "Nie udało się pobrać zdjęć.");
      setPhotos((current) => append ? [...current, ...(data.photos ?? [])] : data.photos ?? []);
      setCounts({ ...EMPTY_COUNTS, ...(data.counts ?? {}) });
      setHasMore(Boolean(data.hasMore));
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Nie udało się pobrać zdjęć.");
    } finally {
      if (append) setLoadingMore(false);
      else setLoading(false);
    }
  }

  async function loadEvent() {
    setEventError("");
    try {
      const res = await fetch("/api/admin/event", { cache: "no-store" });
      const data = await res.json();
      if (!res.ok) {
        setEventError(data.error ?? "Nie udało się rozpoznać wydarzenia.");
        return;
      }
      const event = data.event ?? {};
      setAdminEvent(event);
      setQrSlug((current) => current || event.slug || "");
    } catch {
      setEventError("Nie udało się rozpoznać wydarzenia.");
    }
  }

  async function login(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoggingIn(true);
    setError("");
    try {
      const res = await fetch("/api/admin/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Nie udało się zalogować.");
      setSessionEmail(data.user?.email ?? email);
      setPassword("");
      await loadEvent();
      await load(status);
    } catch (loginError) {
      setError(loginError instanceof Error ? loginError.message : "Nie udało się zalogować.");
    } finally {
      setLoggingIn(false);
    }
  }

  async function logout() {
    await fetch("/api/admin/session", { method: "DELETE" });
    setSessionEmail("");
    setPhotos([]);
    setCounts(EMPTY_COUNTS);
    setPassword("");
    setAdminEvent(null);
    setEventError("");
    setQrOpen(false);
  }

  async function copyQrUrl() {
    if (!qrUrl) return;
    await navigator.clipboard.writeText(qrUrl);
    setCopiedQrUrl(true);
    window.setTimeout(() => setCopiedQrUrl(false), 1800);
  }

  async function act(photo: Photo, nextStatus: AdminAction) {
    if (nextStatus === "deleted" && !window.confirm("Usunąć ten plik na stałe z galerii i ze Storage?")) return;
    setActionId(photo.id);
    setError("");
    try {
      const res = await fetch("/api/admin/photos", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: photo.id, status: nextStatus, storagePath: photo.storage_path }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Nie udało się zapisać zmian.");
      setPhotos((current) => current.filter((item) => item.id !== photo.id));
      await load(status);
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : "Nie udało się zapisać zmian.");
    } finally {
      setActionId("");
    }
  }

  useEffect(() => {
    if (!sessionEmail) return;
    const timer = window.setTimeout(() => {
      void load(status);
    }, 0);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status]);

  useEffect(() => {
    if (!qrOpen) return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setQrOpen(false);
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [qrOpen]);

  if (!sessionEmail) {
    return <WeddingShell wide screen>
      <section className="admin-panel admin-login-panel">
        <p className="admin-eyebrow">Panel admina</p>
        <h1>Zaloguj się</h1>
        <form className="admin-login-form" onSubmit={login}>
          <label>
            Email
            <input value={email} onChange={(event) => setEmail(event.target.value)} type="email" autoComplete="email" />
          </label>
          <label>
            Hasło
            <input value={password} onChange={(event) => setPassword(event.target.value)} type="password" autoComplete="current-password" />
          </label>
          {error && <p className="admin-error">{error}</p>}
          <button className="btn btn-primary" disabled={loggingIn || !email.trim() || !password}>{loggingIn ? "Logowanie..." : "Zaloguj"}</button>
        </form>
      </section>
    </WeddingShell>;
  }

  return <WeddingShell wide screen>
    <section className="admin-panel">
      <header className="admin-header">
        <div>
          <p className="admin-eyebrow">Panel admina</p>
          <h1>Galeria wspomnień</h1>
        </div>
        <div className="admin-header-actions">
          <button className="admin-tool-button" onClick={() => setQrOpen(true)}>QR</button>
          <button className="btn btn-ghost admin-logout" onClick={logout}>Wyloguj</button>
        </div>
      </header>

      <div className="admin-filters" aria-label="Filtr statusu plików">
        {FILTERS.map((filter) => <button key={filter.value} className={status === filter.value ? "is-active" : ""} onClick={() => setStatus(filter.value)}>
          <span>{filter.label}</span>
          <small>{counts[filter.value]}</small>
        </button>)}
      </div>

      {error && <p className="admin-error">{error}</p>}
      {loading && <p className="admin-muted admin-loading">Ładujemy pliki...</p>}
      {!loading && photos.length === 0 && <p className="admin-empty">Brak plików w tym widoku.</p>}

      <div className="admin-memory-grid">
        {photos.map((photo) => <article className="admin-memory-tile" key={photo.id}>
          {photo.url
            ? isVideo(photo) ? <video src={photo.url} muted playsInline preload="metadata" /> : <img src={photo.url} alt="Podgląd pliku" loading="lazy" decoding="async" />
            : <div className="admin-missing-photo">Brak pliku w Storage</div>}
          {isVideo(photo) && <span className="memory-video-badge" aria-hidden="true">▶</span>}
          <div className="admin-memory-meta">
            <b>{photo.guests?.name ?? "Gość"}</b>
            <span>{formatDate(photo.created_at)} · {statusLabel(photo.status)}</span>
          </div>
          <div className="admin-actions">
            <button onClick={() => act(photo, "approved")} disabled={actionId === photo.id || photo.status === "approved"}>Pokaż</button>
            <button onClick={() => act(photo, "hidden")} disabled={actionId === photo.id || photo.status === "hidden"}>Ukryj</button>
            <button className="danger" onClick={() => act(photo, "deleted")} disabled={actionId === photo.id}>Usuń</button>
          </div>
        </article>)}
      </div>
      {!loading && photos.length > 0 && hasMore && <button className="btn btn-ghost admin-load-more" onClick={() => load(status, true)} disabled={loadingMore}>{loadingMore ? "Ładujemy..." : "Pokaż więcej"}</button>}
    </section>
    {qrOpen && <div className="admin-qr-overlay" onClick={() => setQrOpen(false)}>
      <section className="admin-qr-sheet" role="dialog" aria-modal="true" aria-label="QR dla gości" onClick={(event) => event.stopPropagation()}>
        <span className="admin-qr-sheet-handle" aria-hidden="true" />
        <div className="admin-qr-sheet-top">
          <div>
            <p className="admin-eyebrow">QR dla gości</p>
            <h2>{adminEvent?.title ?? "Dodawanie wspomnień"}</h2>
          </div>
          <button className="round-control" onClick={() => setQrOpen(false)} aria-label="Zamknij QR">×</button>
        </div>

        {eventError && <p className="admin-error">{eventError}</p>}

        <label className="admin-qr-code-field">
          Kod dla gości
          <input value={qrCode} onChange={(event) => setQrCode(event.target.value)} placeholder="Wpisz kod weselny" />
        </label>

        <div className="admin-qr-actions">
          <a className={`btn btn-primary${!qrUrl ? " is-disabled" : ""}`} href={qrUrl ? qrFileHref(qrUrl, qrSlug, "png") : undefined} aria-disabled={!qrUrl}>Pobierz QR</a>
          <button className="btn btn-ghost" onClick={copyQrUrl} disabled={!qrUrl}>{copiedQrUrl ? "Skopiowano" : "Kopiuj link"}</button>
        </div>

      </section>
    </div>}
  </WeddingShell>;
}
