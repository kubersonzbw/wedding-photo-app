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

const FILTERS: Array<{ value: FilterStatus; label: string }> = [
  { value: "all", label: "Wszystkie" },
  { value: "approved", label: "Widoczne" },
  { value: "hidden", label: "Ukryte" },
];
const EMPTY_COUNTS: PhotoCounts = { all: 0, approved: 0, hidden: 0 };

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

export default function AdminPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [sessionEmail, setSessionEmail] = useState("");
  const [status, setStatus] = useState<FilterStatus>("all");
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [counts, setCounts] = useState<PhotoCounts>(EMPTY_COUNTS);
  const [loading, setLoading] = useState(false);
  const [loggingIn, setLoggingIn] = useState(false);
  const [actionId, setActionId] = useState("");
  const [error, setError] = useState("");

  async function load(currentStatus = status) {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/admin/photos?status=${currentStatus}`, { cache: "no-store" });
      const data = await res.json();
      if (res.status === 401) {
        setSessionEmail("");
        setPhotos([]);
        setCounts(EMPTY_COUNTS);
        return;
      }
      if (!res.ok) throw new Error(data.error ?? "Nie udało się pobrać zdjęć.");
      setPhotos(data.photos ?? []);
      setCounts({ ...EMPTY_COUNTS, ...(data.counts ?? {}) });
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Nie udało się pobrać zdjęć.");
    } finally {
      setLoading(false);
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
          <h1>Zarządzanie galerią</h1>
        </div>
        <button className="btn btn-ghost admin-logout" onClick={logout}>Wyloguj</button>
      </header>

      <div className="admin-filters" aria-label="Filtr statusu plików">
        {FILTERS.map((filter) => <button key={filter.value} className={status === filter.value ? "is-active" : ""} onClick={() => setStatus(filter.value)}>
          <span>{filter.label}</span>
          <strong>{counts[filter.value]}</strong>
        </button>)}
      </div>

      {error && <p className="admin-error">{error}</p>}
      {loading && <p className="admin-muted admin-loading">Ładujemy pliki...</p>}
      {!loading && photos.length === 0 && <p className="admin-empty">Brak plików w tym widoku.</p>}

      <div className="admin-list">
        {photos.map((photo) => <article className="admin-card" key={photo.id}>
          {photo.url
            ? isVideo(photo) ? <video src={photo.url} controls playsInline preload="metadata" /> : <img src={photo.url} alt="Podgląd zdjęcia" />
            : <div className="admin-missing-photo">Brak pliku w Storage</div>}
          <div className="admin-card-body">
            <div>
              <b>{photo.guests?.name ?? "Gość"}</b>
              <p>{formatDate(photo.created_at)} · {statusLabel(photo.status)}</p>
              {photo.original_filename && <small>{photo.original_filename}</small>}
            </div>
            <div className="admin-actions">
              <button onClick={() => act(photo, "approved")} disabled={actionId === photo.id || photo.status === "approved"}>Pokaż</button>
              <button onClick={() => act(photo, "hidden")} disabled={actionId === photo.id || photo.status === "hidden"}>Ukryj</button>
              <button className="danger" onClick={() => act(photo, "deleted")} disabled={actionId === photo.id}>Usuń</button>
            </div>
          </div>
        </article>)}
      </div>
    </section>
  </WeddingShell>;
}
