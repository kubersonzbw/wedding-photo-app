import type { Metadata } from "next";
import { Inter, Playfair_Display } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin", "latin-ext"], variable: "--font-inter", display: "swap" });
const playfair = Playfair_Display({ subsets: ["latin", "latin-ext"], variable: "--font-playfair", display: "swap" });

export const metadata: Metadata = { title: "Natalia & Robert — Galeria weselna", description: "Prywatna aplikacja do dodawania, moderowania i oglądania zdjęć z wesela Natalii i Roberta." };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="pl" className={`${inter.variable} ${playfair.variable}`}><body>{children}</body></html>;
}
