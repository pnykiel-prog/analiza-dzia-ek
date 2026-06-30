import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: "Analiza działek — budownictwo społeczne",
  description:
    "Ocena potencjału działki pod budownictwo społeczne dla młodych i senioralne — trzy poziomy analizy (przesiew, ocena działki, model finansowy SIM).",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="pl">
      <body className="min-h-screen">
        <header className="bg-slate-900 text-white">
          <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
            <Link href="/" className="font-semibold tracking-tight">
              🏘️ Analiza działek <span className="text-slate-400 font-normal">· budownictwo społeczne</span>
            </Link>
            <nav className="flex gap-4 text-sm">
              <Link href="/" className="hover:text-slate-300">
                Działki
              </Link>
              <Link href="/nowa" className="hover:text-slate-300">
                Nowa analiza
              </Link>
              <Link href="/konfiguracja" className="hover:text-slate-300">
                Konfiguracja
              </Link>
              <Link href="/o-aplikacji" className="hover:text-slate-300">
                O aplikacji
              </Link>
            </nav>
          </div>
        </header>
        <main className="max-w-6xl mx-auto px-4 py-6">{children}</main>
        <footer className="max-w-6xl mx-auto px-4 py-8 text-xs text-slate-400">
          Aplikacja zgodna z dokumentem nadrzędnym <code>architektura_aplikacji.md</code>. Parametry
          (progi, wagi, reżimy finansowe) są edytowalne w zakładce Konfiguracja.
        </footer>
      </body>
    </html>
  );
}
