import Link from "next/link";

export default function WeddingHero({
  eyebrow = "ROBERT & NATALIA",
  title = "Robert & Natalia",
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
    <div className="hero-leaf hero-leaf-left" aria-hidden="true">⌇</div>
    <div className="hero-leaf hero-leaf-right" aria-hidden="true">⌇</div>
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
