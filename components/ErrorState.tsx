import BrokenHeartIcon from "@/components/BrokenHeartIcon";

export default function ErrorState({ title = "Coś poszło nie tak", description = "Spróbuj ponownie później", onRefresh }: { title?: string; description?: string; onRefresh?: () => void }) {
  return <section className="error-state" role="alert">
    <div className="error-icon error-broken-heart-icon" aria-hidden="true"><BrokenHeartIcon /></div>
    <h2>{title}</h2>
    <p>{description}</p>
    {onRefresh && <button className="btn btn-primary" onClick={onRefresh}>Odśwież stronę</button>}
  </section>;
}
