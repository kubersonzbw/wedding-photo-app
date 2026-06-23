import type { ReactNode } from "react";

export default function WeddingShell({ children, wide = false, centered = false, screen = false }: { children: ReactNode; wide?: boolean; centered?: boolean; screen?: boolean }) {
  return <main className={`wedding-shell${wide ? " wedding-shell-wide" : ""}${centered ? " wedding-shell-centered" : ""}${screen ? " wedding-shell-screen" : ""}`}>
    <div className="ambient ambient-one" />
    <div className="ambient ambient-two" />
    <div className="ambient ambient-three" />
    <div className="ornament ornament-left">✦</div>
    <div className="ornament ornament-right">♡</div>
    {children}
  </main>;
}
