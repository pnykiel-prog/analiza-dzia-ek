import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: "GRUNT — analiza potencjału działek",
  description:
    "Ocena potencjału działki pod budownictwo społeczne dla młodych i senioralne — trzy poziomy analizy (przesiew, ocena działki, model finansowy SIM).",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pl">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@400;500;600;700&family=IBM+Plex+Mono:wght@400;500;600&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="min-h-screen font-sans">
        <PasekGorny />
        <main className="mx-auto px-6 py-6" style={{ maxWidth: "var(--grunt-page-max)" }}>
          {children}
        </main>
        <footer
          className="mx-auto px-6 py-8 text-[11px] text-grunt-text-faint"
          style={{ maxWidth: "var(--grunt-page-max)" }}
        >
          GRUNT · warstwa wizualna wg wytycznych 1.0. Parametry (progi, wagi, reżimy finansowe) są
          edytowalne w zakładce Konfiguracja.
        </footer>
      </body>
    </html>
  );
}

function PasekGorny() {
  return (
    <header
      className="sticky top-0 z-30 bg-grunt-surface border-b border-grunt-border"
      style={{ height: "var(--grunt-h-header)" }}
    >
      <div
        className="mx-auto h-full px-6 flex items-center justify-between gap-6"
        style={{ maxWidth: "var(--grunt-page-max)" }}
      >
        <Link href="/nowa" className="flex items-center gap-2.5 shrink-0">
          <span className="relative grid place-items-center w-[30px] h-[30px] rounded-sm bg-grunt-ink">
            <span className="block w-2.5 h-2.5 rounded-[3px] bg-grunt-mint" />
          </span>
          <span className="flex flex-col leading-none">
            <span className="text-grunt-ink text-[16px] font-bold" style={{ letterSpacing: "0.14em" }}>
              GRUNT
            </span>
            <span className="text-[9px] text-grunt-text-faint2 uppercase" style={{ letterSpacing: "0.12em" }}>
              analiza potencjału działek
            </span>
          </span>
        </Link>

        <nav className="flex items-center gap-5 text-[13px] text-grunt-text-3">
          <Link href="/nowa" className="hover:text-grunt-ink">Nowa analiza</Link>
          <Link href="/archiwum" className="hover:text-grunt-ink">Przeanalizowane działki</Link>
          <Link href="/konfiguracja" className="hover:text-grunt-ink">Konfiguracja</Link>
          <Link href="/o-aplikacji" className="hover:text-grunt-ink">O aplikacji</Link>
        </nav>

        <div className="flex items-center gap-3">
          <LegendaProfili />
          <button className="btn-secondary" style={{ height: "var(--grunt-h-btn-sm)" }}>
            Raport PDF
          </button>
        </div>
      </div>
    </header>
  );
}

function LegendaProfili() {
  return (
    <div className="hidden md:flex items-center gap-3 text-[11px] text-grunt-text-muted2">
      <span className="flex items-center gap-1.5">
        <span className="w-2.5 h-2.5 rounded-full bg-grunt-young" /> Młodzi
      </span>
      <span className="flex items-center gap-1.5">
        <span className="w-2.5 h-2.5 rounded-full bg-grunt-senior" /> Seniorzy
      </span>
    </div>
  );
}
