import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = { title: "Robert & Natalia — Galeria weselna", description: "Prywatna aplikacja do dodawania, moderowania i oglądania zdjęć z wesela Roberta i Natalii." };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="pl"><body>{children}</body></html>;
}
