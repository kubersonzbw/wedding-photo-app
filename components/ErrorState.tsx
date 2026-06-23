export default function ErrorState({ title = "Coś poszło nie tak", description = "Spróbuj ponownie później", onRefresh }: { title?: string; description?: string; onRefresh?: () => void }) {
  return <section className="memory-card error-state" role="alert">
    <div className="error-icon">💔</div>
    <h2>{title}</h2>
    <p>{description}</p>
    {onRefresh && <button className="btn btn-primary" onClick={onRefresh}>Odśwież stronę</button>}
  </section>;
}
