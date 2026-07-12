import type { ReactNode } from "react";

export default function WeddingShell({ children, wide = false, centered = false, screen = false }: { children: ReactNode; wide?: boolean; centered?: boolean; screen?: boolean }) {
  return <main className={`wedding-shell${wide ? " wedding-shell-wide" : ""}${centered ? " wedding-shell-centered" : ""}${screen ? " wedding-shell-screen" : ""}`}>
    {children}
  </main>;
}
