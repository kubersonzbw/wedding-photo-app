import Link from "next/link";

export default function WeddingHero({
  eyebrow = "NATALIA & ROBERT",
  title = "Natalia & Robert",
  subtitle,
  description,
  primaryHref,
  primaryLabel,
  actionHref,
  actionLabel,
}: {
  eyebrow?: string;
  title?: string;
  subtitle: string;
  description?: string;
  primaryHref?: string;
  primaryLabel?: string;
  actionHref?: string;
  actionLabel?: string;
}) {
  return <section className="wedding-hero">
    <div className="rings-mark" aria-hidden="true">♡</div>
    <div className="wedding-badge"><span />{eyebrow}</div>
    <h1>{title}</h1>
    <p className="wedding-subtitle">{subtitle}</p>
    {description && <p className="wedding-description">{description}</p>}
    <div className="hero-divider" aria-hidden="true"><span />✧<span /></div>
    {(primaryHref || actionHref) && <div className="hero-actions">
      {primaryHref && primaryLabel && <Link className="btn btn-primary" href={primaryHref}>📷 {primaryLabel}</Link>}
      {actionHref && actionLabel && <Link className="btn btn-ghost" href={actionHref}>{actionLabel}</Link>}
    </div>}
  </section>;
}
