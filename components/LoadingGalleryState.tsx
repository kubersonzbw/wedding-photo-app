export default function LoadingGalleryState({ showCopy = true }: { showCopy?: boolean }) {
  return <section className="loading-gallery" aria-live="polite" aria-label="Przygotowujemy galerię">
    {showCopy && <div className="loading-copy">
      <span className="loading-kicker">Światła wspomnień</span>
      <h2>Przygotowujemy galerię…</h2>
    </div>}
    <div className="memory-grid skeleton-grid">
      {Array.from({ length: 8 }).map((_, i) => <div className="skeleton-tile" key={i}><span /><span /></div>)}
    </div>
  </section>;
}
