import Link from "next/link";

/**
 * Layout aplikacji (grupa tras `(app)`) — GLOBALNY CIEMNY „SHELL" (wg wytycznych „Tło
 * aplikacji GRUNT"): granatowe tło z szkicem budynku pod wszystkimi ekranami, szklany
 * chrome (nagłówek), a treść w białych, nieprzezroczystych kartach „świeci" na granacie.
 * Tło jest stałe (fixed) i należy do layoutu — ekrany różnią się tylko treścią kart.
 * Landing pod `/` NIE używa tego layoutu (renderuje się czysto).
 */
export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative min-h-screen" style={{ background: "#0E1E36" }}>
      {/* ── TŁO CAŁEJ APLIKACJI: 3 warstwy fixed pod treścią (z-0) ── */}
      {/* 1. Baza — gradient granatu (jaśniej u góry środkiem, ciemniej ku krawędziom). */}
      <div
        className="fixed inset-0 z-0"
        style={{ background: "radial-gradient(1100px 620px at 50% 8%,#1d3860 0%,#12233F 46%,#0A1526 100%)" }}
      />
      {/* 2. Szkic budynku (mięta) — osadzony nisko, bryły wychodzą z dołu; regulowany tylko opacity. */}
      <div
        className="fixed inset-0 z-0"
        style={{
          backgroundImage: "url('/szkic-budynku-mieta.png')",
          backgroundSize: "120% auto",
          backgroundPosition: "center 78%",
          backgroundRepeat: "no-repeat",
          opacity: 0.26,
        }}
      />
      {/* 3. Maska czytelności — przygasza górę (pod chrome) i dół, środek zostawia oddech. */}
      <div
        className="fixed inset-0 z-0"
        style={{ background: "linear-gradient(180deg,rgba(10,21,38,.55) 0%,rgba(10,21,38,.15) 34%,rgba(10,21,38,.55) 100%)" }}
      />

      {/* ── CHROME + TREŚĆ (na wierzchu, z-1) ── */}
      <div className="relative z-[1]">
        <PasekGorny />
        <main className="mx-auto px-4 sm:px-6 py-6" style={{ maxWidth: "var(--grunt-page-max)" }}>
          {children}
        </main>
        <footer
          className="mx-auto px-4 sm:px-6 py-8 text-[11px]"
          style={{ maxWidth: "var(--grunt-page-max)", color: "#8FA3BE" }}
        >
          GRUNT · warstwa wizualna wg wytycznych 1.0. Parametry (progi, wagi, reżimy finansowe) są
          edytowalne w zakładce Konfiguracja.
        </footer>
      </div>
    </div>
  );
}

function PasekGorny() {
  return (
    <header
      className="sticky top-0 z-30"
      style={{
        height: "var(--grunt-h-header)",
        background: "rgba(13,26,46,.72)",
        backdropFilter: "blur(12px)",
        WebkitBackdropFilter: "blur(12px)",
        borderBottom: "1px solid rgba(255,255,255,.10)",
      }}
    >
      <div
        className="mx-auto h-full px-4 sm:px-6 flex items-center justify-between gap-3 sm:gap-6"
        style={{ maxWidth: "var(--grunt-page-max)" }}
      >
        <Link href="/" className="flex items-center gap-2.5 shrink-0">
          {/* Znak na białym kafelku — kontrast na granacie. */}
          <span className="relative grid place-items-center w-[30px] h-[30px] rounded-[7px] bg-white">
            <span className="block w-2.5 h-2.5 rounded-[3px] bg-grunt-mint" />
          </span>
          <span className="flex flex-col leading-none">
            <span className="text-white text-[16px] font-bold" style={{ letterSpacing: "0.14em" }}>
              GRUNT
            </span>
            <span className="hidden sm:block text-[9px] uppercase" style={{ letterSpacing: "0.12em", color: "#8FA3BE" }}>
              analiza potencjału działek
            </span>
          </span>
        </Link>

        <nav className="flex items-center gap-4 sm:gap-5 text-[12px] sm:text-[13px] overflow-x-auto no-scrollbar min-w-0" style={{ color: "#CFE0F1" }}>
          <Link href="/nowa" className="hover:text-white whitespace-nowrap">Nowa analiza</Link>
          <Link href="/archiwum" className="hover:text-white whitespace-nowrap">Przeanalizowane działki</Link>
          <Link href="/konfiguracja" className="hover:text-white whitespace-nowrap">Konfiguracja</Link>
          <Link href="/o-aplikacji" className="hover:text-white whitespace-nowrap">O aplikacji</Link>
        </nav>

        <div className="flex items-center gap-3 shrink-0">
          <LegendaProfili />
        </div>
      </div>
    </header>
  );
}

function LegendaProfili() {
  return (
    <div className="hidden md:flex items-center gap-3 text-[11px]" style={{ color: "#8FA3BE" }}>
      <span className="flex items-center gap-1.5">
        <span className="w-2.5 h-2.5 rounded-full bg-grunt-young" /> Młodzi
      </span>
      <span className="flex items-center gap-1.5">
        <span className="w-2.5 h-2.5 rounded-full bg-grunt-senior" /> Seniorzy
      </span>
    </div>
  );
}
