import Link from "next/link";

export default function WeddingHero({
  eyebrow = "Wesele • Galeria gości",
  title = "Robert & Natalia",
  subtitle,
  description,
  actionHref,
  actionLabel,
}: {
  eyebrow?: string;
  title?: string;
  subtitle: string;
  description?: string;
  actionHref?: string;
  actionLabel?: string;
}) {
  return <section className="wedding-hero">
    <div className="wedding-badge"><span />{eyebrow}</div>
    <h1>{title}</h1>
    <p className="wedding-subtitle">{subtitle}</p>
    {description && <p className="wedding-description">{description}</p>}
    <div className="hero-divider" aria-hidden="true"><span />✧<span /></div>
    {actionHref && actionLabel && <Link className="btn btn-ghost hero-action" href={actionHref}>{actionLabel}</Link>}
  </section>;
}
