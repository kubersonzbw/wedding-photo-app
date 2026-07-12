import type { ReactNode } from "react";

export default function WeddingShell({ children, wide = false, centered = false, screen = false }: { children: ReactNode; wide?: boolean; centered?: boolean; screen?: boolean }) {
  return <main className={`wedding-shell${wide ? " wedding-shell-wide" : ""}${centered ? " wedding-shell-centered" : ""}${screen ? " wedding-shell-screen" : ""}`}>
    <div className="ambient ambient-one" />
    <div className="ambient ambient-two" />
    <div className="ambient ambient-three" />
    <div className="ornament ornament-left">✦</div>
    <div className="ornament ornament-right">♡</div>
    {screen && <>
      <span className="shell-wheat shell-wheat-top-left" aria-hidden="true" />
      <span className="shell-wheat shell-wheat-top-right" aria-hidden="true" />
      <span className="shell-wheat shell-wheat-bottom-left" aria-hidden="true" />
      <span className="shell-wheat shell-wheat-bottom-right" aria-hidden="true" />
      <span className="shell-blush shell-blush-left" aria-hidden="true" />
      <span className="shell-blush shell-blush-bottom" aria-hidden="true" />
    </>}
    {children}
  </main>;
}
