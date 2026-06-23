import type { ReactNode } from "react";

export default function WeddingShell({ children, wide = false, centered = false }: { children: ReactNode; wide?: boolean; centered?: boolean }) {
  return <main className={`wedding-shell${wide ? " wedding-shell-wide" : ""}${centered ? " wedding-shell-centered" : ""}`}>
    <div className="ambient ambient-one" />
    <div className="ambient ambient-two" />
    <div className="ambient ambient-three" />
    <div className="ornament ornament-left">✦</div>
    <div className="ornament ornament-right">♡</div>
    {children}
  </main>;
}
