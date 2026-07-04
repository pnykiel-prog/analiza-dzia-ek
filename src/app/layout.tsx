import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "GRUNT — analiza potencjału działek",
  description:
    "Ocena potencjału działki pod budownictwo społeczne dla młodych i senioralne — trzy poziomy analizy (przesiew, ocena działki, model finansowy SIM).",
};

/**
 * Root layout: tylko szkielet dokumentu (html/body + fonty). Chrome aplikacji
 * (pasek górny, stepper) mieszka w grupie tras `(app)` — landing pod `/` renderuje
 * się bez chrome aplikacji, zgodnie z wytycznymi strony startowej.
 */
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
      <body className="min-h-screen font-sans">{children}</body>
    </html>
  );
}
