/**
 * Prymitywy wizualne GRUNT (wg „GRUNT — wytyczne wizualne", sekcje 4–6).
 * Restrykcyjna paleta z tokenów; liczby zawsze mono/tabular.
 */

// ── 4. Stepper poziomów ──────────────────────────────────────────────────────

export interface KrokStepper {
  nr: number;
  etykieta: string;
  podtytul: string;
}

const KROKI_DOMYSLNE: KrokStepper[] = [
  { nr: 1, etykieta: "Wejście", podtytul: "Identyfikacja" },
  { nr: 2, etykieta: "Poziom 1", podtytul: "Przesiew" },
  { nr: 3, etykieta: "Poziom 2", podtytul: "Ocena → warianty" },
  { nr: 4, etykieta: "Poziom 3", podtytul: "Model finansowy" },
  { nr: 5, etykieta: "Raport", podtytul: "Podsumowanie" },
];

/**
 * @param aktywny numer bieżącego kroku (1–5)
 * @param maxOsiagniety najwyższy odblokowany krok
 * @param onKrok nawigacja do osiągniętego kroku
 */
export function Stepper({
  aktywny,
  maxOsiagniety,
  onKrok,
  kroki = KROKI_DOMYSLNE,
}: {
  aktywny: number;
  maxOsiagniety: number;
  onKrok?: (nr: number) => void;
  kroki?: KrokStepper[];
}) {
  return (
    <div
      className="bg-grunt-surface-2 border-b border-grunt-border"
      style={{ minHeight: "var(--grunt-h-subnav)" }}
    >
      <div
        className="mx-auto h-full px-4 sm:px-6 flex items-stretch overflow-x-auto no-scrollbar"
        style={{ maxWidth: "var(--grunt-page-max)" }}
      >
        {kroki.map((k, i) => {
          const stan: StanKroku =
            k.nr === aktywny ? "aktywny" : k.nr < aktywny || k.nr <= maxOsiagniety ? (k.nr < aktywny ? "ukonczony" : "osiagniety") : "niedostepny";
          const ukonczony = k.nr < aktywny;
          const osiagalny = k.nr <= maxOsiagniety;
          // Na wąskich ekranach etykietę pokazujemy tylko dla aktywnego kroku (reszta = numer).
          const pokazEtykiete = stan === "aktywny";
          return (
            <div key={k.nr} className="flex items-center shrink-0">
              <button
                type="button"
                disabled={!osiagalny || !onKrok}
                onClick={() => osiagalny && onKrok?.(k.nr)}
                className={`relative flex items-center gap-2.5 py-2.5 pr-2 sm:pr-4 ${osiagalny && onKrok ? "cursor-pointer" : "cursor-default"}`}
              >
                <ZnacznikKroku nr={k.nr} stan={ukonczony ? "ukonczony" : stan} />
                <span className={`${pokazEtykiete ? "flex" : "hidden sm:flex"} flex-col items-start leading-tight`}>
                  <span
                    className={`text-[12.5px] whitespace-nowrap ${
                      stan === "aktywny" ? "text-grunt-ink font-semibold" : stan === "niedostepny" ? "text-grunt-text-ghost" : "text-grunt-text-3"
                    }`}
                  >
                    {k.etykieta}
                  </span>
                  <span className={`hidden sm:block text-[10px] ${stan === "niedostepny" ? "text-grunt-text-ghost" : "text-grunt-text-faint2"}`}>
                    {k.podtytul}
                  </span>
                </span>
                {stan === "aktywny" && <span className="absolute left-0 bottom-0 h-0.5 w-full bg-grunt-ink" />}
              </button>
              {i < kroki.length - 1 && <span className="w-4 sm:w-8 h-px bg-grunt-border-2 mx-1 shrink-0" />}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Motyw sygnaturowy „kataster + warstwice” (kierunek wizualny §1) ───────────
// Cienkie warstwice + obrys działki z wierzchołkami, mięta na granacie.
// TYLKO w ciemnych pasach (baner poziomu, bramka) — nigdy na białych kartach.
export function MotywKataster({ szerokosc = "100%", opacity = 0.9 }: { szerokosc?: number | string; opacity?: number }) {
  return (
    <svg
      viewBox="0 0 1200 240"
      width={szerokosc}
      height="100%"
      preserveAspectRatio="xMidYMid slice"
      aria-hidden
      style={{ position: "absolute", inset: 0, opacity }}
    >
      <g fill="none" stroke="#6FE3C4" strokeOpacity=".12" strokeWidth="1.3">
        <path d="M760,300 C720,190 860,150 980,150 C1120,150 1170,60 1300,90" />
        <path d="M740,320 C700,210 850,120 1000,120 C1140,120 1200,30 1320,60" />
        <path d="M786,286 C760,210 880,180 990,180 C1110,180 1160,96 1290,120" />
        <path d="M820,262 C800,206 900,196 996,206 C1104,216 1150,140 1270,158" />
      </g>
      <g strokeLinejoin="round">
        <path d="M900,70 L1020,54 L1066,150 L1040,214 L920,232 L862,138 Z" fill="#6FE3C4" fillOpacity=".06" stroke="#6FE3C4" strokeOpacity=".4" strokeWidth="1.4" />
        <line x1="920" y1="150" x2="1020" y2="54" stroke="#6FE3C4" strokeOpacity=".22" strokeWidth="1" strokeDasharray="3 4" />
        <g fill="#6FE3C4" fillOpacity=".8">
          <circle cx="900" cy="70" r="3" /><circle cx="1020" cy="54" r="3" /><circle cx="1066" cy="150" r="3" />
          <circle cx="1040" cy="214" r="3" /><circle cx="920" cy="232" r="3" /><circle cx="862" cy="138" r="3" />
        </g>
      </g>
    </svg>
  );
}

// ── Radialne gauge wyniku (kierunek wizualny §4) ──────────────────────────────
// Pierścień postępu z liczbą w środku — dla głównych wyników (P1 werdykt, DSCR,
// kompletność). Kolor łuku = kolor werdyktu (semantyczny), tło łuku neutralne.
export function Gauge({
  wartosc,
  max = 100,
  kolor = "var(--grunt-ink)",
  rozmiar = 104,
  sufiks = "/100",
  nieoznaczony = false,
}: {
  wartosc: number;
  max?: number;
  kolor?: string;
  rozmiar?: number;
  sufiks?: string;
  nieoznaczony?: boolean;
}) {
  const r = 50;
  const obwod = 2 * Math.PI * r; // ~314
  const frac = Math.max(0, Math.min(1, wartosc / max));
  const dash = `${(frac * obwod).toFixed(0)} ${obwod.toFixed(0)}`;
  return (
    <div className="relative shrink-0" style={{ width: rozmiar, height: rozmiar }}>
      <svg viewBox="0 0 120 120" width={rozmiar} height={rozmiar} style={{ transform: "rotate(-90deg)" }} aria-hidden>
        <circle cx="60" cy="60" r={r} fill="none" stroke="#EEF1F5" strokeWidth="11" />
        {!nieoznaczony && (
          <circle cx="60" cy="60" r={r} fill="none" stroke={kolor} strokeWidth="11" strokeLinecap="round" strokeDasharray={dash} />
        )}
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        {nieoznaczony ? (
          <span className="text-grunt-text-faint2 text-[13px]">—</span>
        ) : (
          <>
            <span className="mono font-semibold leading-none" style={{ fontSize: 30 }}>{Math.round(wartosc)}</span>
            <span className="text-[11px] text-grunt-text-faint2 mt-0.5">{sufiks}</span>
          </>
        )}
      </div>
    </div>
  );
}

// ── Baner nagłówka poziomu (kierunek wizualny §2) ─────────────────────────────
// Ciemny pas granatowy z motywem + stepper w banerze + eyebrow/H1/lead + „szklany”
// badge stanu. Treść poniżej ma NACHODZIĆ na baner (`-mt-3.5`). Renderuje się
// pełną szerokością — osadzaj w kontenerze z ujemnymi marginesami jak stepper.
export interface BadgeStanuBaner {
  ton: TonWalidacji | "info";
  tytul: string;
  opis?: string;
}

export function BanerPoziomu({
  eyebrow,
  tytul,
  opis,
  krokAktywny,
  maxOsiagniety,
  onKrok,
  kroki = KROKI_DOMYSLNE,
  badge,
}: {
  eyebrow: string;
  tytul: string;
  opis?: string;
  krokAktywny?: number;
  maxOsiagniety?: number;
  onKrok?: (nr: number) => void;
  kroki?: KrokStepper[];
  badge?: BadgeStanuBaner;
}) {
  return (
    <div className="relative overflow-hidden" style={{ backgroundColor: "#16263F", backgroundImage: "radial-gradient(1000px 420px at 78% -40%,#264063 0%,#16263F 60%)" }}>
      <MotywKataster />
      <div
        className="absolute inset-0"
        style={{
          opacity: 0.4,
          backgroundImage: "linear-gradient(#ffffff08 1px,transparent 1px),linear-gradient(90deg,#ffffff08 1px,transparent 1px)",
          backgroundSize: "44px 44px",
          maskImage: "linear-gradient(90deg,transparent,#000 40%)",
          WebkitMaskImage: "linear-gradient(90deg,transparent,#000 40%)",
        }}
      />
      <div className="relative mx-auto px-4 sm:px-6" style={{ maxWidth: "var(--grunt-page-max)", paddingTop: 24, paddingBottom: 30 }}>
        {krokAktywny != null && (
          <div className="flex items-center overflow-x-auto no-scrollbar mb-5">
            {kroki.map((k, i) => {
              const ukonczony = k.nr < krokAktywny;
              const aktywny = k.nr === krokAktywny;
              const osiagalny = k.nr <= (maxOsiagniety ?? krokAktywny);
              const dotBase = "mono grid place-items-center w-6 h-6 rounded-full text-[12px] font-semibold shrink-0";
              const dotStyl = aktywny
                ? "bg-white text-grunt-ink"
                : ukonczony
                  ? "text-grunt-mint"
                  : "text-[#8FA3BE]";
              const dotBorder = aktywny ? "1.5px solid #fff" : ukonczony ? "1.5px solid #6FE3C4" : "1.5px solid #ffffff40";
              const dotBg = aktywny ? "#fff" : ukonczony ? "#ffffff14" : "transparent";
              const labStyl = aktywny ? "text-white font-semibold" : ukonczony ? "text-[#CFE0F1] font-medium" : "text-[#8FA3BE] font-medium";
              return (
                <div key={k.nr} className="flex items-center shrink-0">
                  <button
                    type="button"
                    disabled={!osiagalny || !onKrok}
                    onClick={() => osiagalny && onKrok?.(k.nr)}
                    className={`flex items-center gap-2.5 ${osiagalny && onKrok ? "cursor-pointer" : "cursor-default"}`}
                  >
                    <span className={`${dotBase} ${dotStyl}`} style={{ border: dotBorder, background: dotBg }}>
                      {ukonczony ? "✓" : k.nr}
                    </span>
                    <span className={`hidden sm:block text-[13px] whitespace-nowrap ${labStyl}`}>{k.etykieta}</span>
                  </button>
                  {i < kroki.length - 1 && <span className="w-4 sm:w-[26px] h-px mx-2 sm:mx-3 shrink-0" style={{ background: "#ffffff26" }} />}
                </div>
              );
            })}
          </div>
        )}
        <div className="flex items-end justify-between gap-6">
          <div className="min-w-0">
            <div className="text-[12px] font-semibold uppercase mb-2" style={{ letterSpacing: ".12em", color: "#6FE3C4" }}>{eyebrow}</div>
            <h1 className="text-white font-semibold m-0" style={{ fontSize: 30, letterSpacing: "-.015em" }}>{tytul}</h1>
            {opis && <p className="m-0 mt-2 text-[14px] leading-relaxed max-w-xl" style={{ color: "#AFC0D6" }}>{opis}</p>}
          </div>
          {badge && <BadgeSzklany {...badge} />}
        </div>
      </div>
    </div>
  );
}

function BadgeSzklany({ ton, tytul, opis }: BadgeStanuBaner) {
  const kolorKropki = ton === "sukces" ? "#1C8A5A" : ton === "ostrzezenie" ? "#B5790B" : ton === "blad" ? "#C0392B" : "#6E8BB0";
  const znak = ton === "sukces" ? "✓" : ton === "ostrzezenie" ? "!" : ton === "blad" ? "✕" : "i";
  const kolorOpis = ton === "ostrzezenie" ? "#CBB68A" : "#AFC0D6";
  return (
    <div
      className="hidden sm:flex items-center gap-2.5 shrink-0"
      style={{ background: "#ffffff12", border: "1px solid #ffffff26", borderRadius: 11, padding: "11px 15px", backdropFilter: "blur(6px)" }}
    >
      <span className="grid place-items-center rounded-full text-white font-bold text-[14px]" style={{ width: 26, height: 26, background: kolorKropki }}>{znak}</span>
      <div>
        <div className="text-[13px] font-semibold text-white">{tytul}</div>
        {opis && <div className="text-[12px] mt-px" style={{ color: kolorOpis }}>{opis}</div>}
      </div>
    </div>
  );
}

type StanKroku = "aktywny" | "ukonczony" | "osiagniety" | "niedostepny";

function ZnacznikKroku({ nr, stan }: { nr: number; stan: StanKroku }) {
  const base = "mono grid place-items-center w-6 h-6 rounded-full text-[11px] font-semibold border";
  if (stan === "ukonczony")
    return <span className={`${base} border-grunt-green bg-grunt-green-bg text-grunt-green`}>✓</span>;
  if (stan === "aktywny") return <span className={`${base} border-grunt-ink bg-grunt-ink text-white`}>{nr}</span>;
  if (stan === "niedostepny") return <span className={`${base} border-grunt-border text-grunt-text-ghost`}>{nr}</span>;
  return <span className={`${base} border-[#D3DBE5] text-[#3A4D6B]`}>{nr}</span>;
}

// ── 5.2 Wskaźnik pewności ────────────────────────────────────────────────────

export function WskaznikPewnosci({
  pewnosc,
  rozmiar = "md",
  etykieta = true,
}: {
  pewnosc: number;
  rozmiar?: "sm" | "md";
  etykieta?: boolean;
}) {
  const wypelnione = Math.round((Math.max(0, Math.min(100, pewnosc)) / 100) * 5);
  const dot = rozmiar === "sm" ? "w-2 h-2" : "w-[11px] h-[11px]";
  const kolorPct = pewnosc >= 75 ? "text-grunt-green" : pewnosc >= 60 ? "text-grunt-amber" : "text-grunt-red";
  return (
    <div className="flex items-center gap-2">
      {etykieta && <span className="text-[10px] uppercase tracking-wider text-grunt-text-faint">Pewność</span>}
      <span className="flex items-center gap-1">
        {Array.from({ length: 5 }).map((_, i) => (
          <span key={i} className={`${dot} rounded-full ${i < wypelnione ? "bg-grunt-ink" : "bg-grunt-border"}`} />
        ))}
      </span>
      <span className={`mono text-[12.5px] font-semibold ${kolorPct}`}>{Math.round(pewnosc)}%</span>
    </div>
  );
}

// ── 5.3 Badge trybu pola / prowenancji ───────────────────────────────────────

export type TrybProwenancji = "AUTO" | "AUTO_EDYT" | "SKORYGOWANO" | "RECZNE";

const OPIS_PROWENANCJI: Record<TrybProwenancji, { ikona: string; label: string; klasa: string }> = {
  AUTO: { ikona: "🔒", label: "AUTO", klasa: "bg-grunt-divider text-grunt-text-muted" },
  AUTO_EDYT: { ikona: "✎", label: "AUTO · edytowalne", klasa: "bg-grunt-young-bg text-grunt-young" },
  SKORYGOWANO: { ikona: "✎", label: "Skorygowano", klasa: "bg-grunt-ink text-white" },
  RECZNE: { ikona: "＋", label: "Ręczne", klasa: "bg-grunt-amber-bg text-grunt-amber-text2" },
};

export function BadgeTrybu({ tryb, label }: { tryb: TrybProwenancji; label?: string }) {
  const o = OPIS_PROWENANCJI[tryb];
  return (
    <span className={`inline-flex items-center gap-1 rounded-tag px-1.5 py-0.5 text-[9.5px] font-semibold ${o.klasa}`}>
      <span aria-hidden>{o.ikona}</span> {label ?? o.label}
    </span>
  );
}

// ── 5.4 Callout walidacji ────────────────────────────────────────────────────

export type TonWalidacji = "sukces" | "ostrzezenie" | "blad";

const STYL_WALIDACJI: Record<TonWalidacji, { txt: string; bg: string; border: string; ikona: string }> = {
  sukces: { txt: "text-grunt-green", bg: "bg-grunt-green-bg", border: "border-grunt-green/25", ikona: "✓" },
  ostrzezenie: { txt: "text-grunt-amber-text", bg: "bg-grunt-amber-bg", border: "border-grunt-amber/25", ikona: "!" },
  blad: { txt: "text-grunt-red", bg: "bg-grunt-red-bg", border: "border-grunt-red/25", ikona: "✕" },
};

export function CalloutWalidacji({ ton, tytul, opis }: { ton: TonWalidacji; tytul: string; opis?: string }) {
  const s = STYL_WALIDACJI[ton];
  return (
    <div className={`flex items-start gap-3 rounded-md border ${s.border} ${s.bg} px-3.5 py-3`}>
      <span className={`mono grid place-items-center shrink-0 w-6 h-6 rounded-full text-white text-[13px] font-bold ${ton === "sukces" ? "bg-grunt-green" : ton === "ostrzezenie" ? "bg-grunt-amber" : "bg-grunt-red"}`}>
        {s.ikona}
      </span>
      <div>
        <div className={`text-[13px] font-semibold ${s.txt}`}>{tytul}</div>
        {opis && <div className="text-[12px] text-grunt-text-muted mt-0.5">{opis}</div>}
      </div>
    </div>
  );
}

// ── 5.5 Stos montażu finansowego ─────────────────────────────────────────────

export interface SegmentStosu {
  nazwa: string;
  udzialPct: number; // 0–100 (szerokość segmentu)
  kolor: string; // klasa tła (np. "bg-grunt-chart-1")
  wartosc?: string; // sformatowana etykieta (mono)
  tbc?: boolean;
}

export function StosMontazu({ segmenty }: { segmenty: SegmentStosu[] }) {
  const widoczne = segmenty.filter((s) => s.udzialPct > 0);
  return (
    <div>
      <div className="flex h-6 rounded-sm overflow-hidden" style={{ gap: "2px" }}>
        {widoczne.map((s, i) => (
          <div key={i} className={`${s.kolor} h-full`} style={{ width: `${s.udzialPct}%` }} title={`${s.nazwa}: ${s.udzialPct}%`} />
        ))}
      </div>
      <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2">
        {widoczne.map((s, i) => (
          <span key={i} className="flex items-center gap-1.5 text-[11px] text-grunt-text-3">
            <span className={`w-2.5 h-2.5 rounded-sm ${s.kolor}`} />
            {s.nazwa}
            {s.tbc && <span className="badge bg-grunt-amber-bg text-grunt-amber-text2">tbc</span>}
            <span className="mono font-semibold text-grunt-text">{s.udzialPct}%</span>
            {s.wartosc && <span className="mono text-grunt-text-muted2">{s.wartosc}</span>}
          </span>
        ))}
      </div>
    </div>
  );
}

// ── 5.6 Banner bramki ────────────────────────────────────────────────────────

export function BannerBramki({
  tytul,
  opis,
  akcja,
  akcjaLabel,
  secondary,
  secondaryLabel,
  disabled,
}: {
  tytul: string;
  opis?: string;
  akcja?: () => void;
  akcjaLabel?: string;
  secondary?: () => void;
  secondaryLabel?: string;
  disabled?: boolean;
}) {
  return (
    <div
      className="relative overflow-hidden rounded-2xl px-5 sm:px-6 py-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
      style={{ backgroundColor: "#16263F", backgroundImage: "radial-gradient(circle at 88% 0%, #26456b, #16263F)" }}
    >
      {/* Subtelny motyw warstwic po prawej (kierunek wizualny §1) */}
      <svg viewBox="0 0 400 120" preserveAspectRatio="xMidYMid slice" aria-hidden className="absolute right-0 top-0 bottom-0" style={{ width: 340, opacity: 0.5 }}>
        <g fill="none" stroke="#6FE3C4" strokeOpacity=".16" strokeWidth="1.2">
          <path d="M120,140 C160,60 260,60 320,40 C360,26 380,-10 440,0" />
          <path d="M150,150 C190,80 280,74 340,54" />
        </g>
      </svg>
      <div className="relative min-w-0">
        <div className="text-white font-semibold text-[16px]">{tytul}</div>
        {opis && <div className="text-[13px] text-[#A9BBD2] mt-1 max-w-2xl leading-snug">{opis}</div>}
      </div>
      <div className="relative flex items-center gap-2.5 shrink-0">
        {secondary && secondaryLabel && (
          <button
            type="button"
            onClick={secondary}
            className="rounded-md px-4 text-[13px] font-medium text-white bg-transparent hover:bg-white/5"
            style={{ height: "var(--grunt-h-btn-lg)", border: "1px solid #ffffff33" }}
          >
            {secondaryLabel}
          </button>
        )}
        {akcja && akcjaLabel && (
          <button type="button" onClick={akcja} disabled={disabled} className="btn-mint">
            {akcjaLabel} <span aria-hidden>→</span>
          </button>
        )}
      </div>
    </div>
  );
}

// ── 5.7 Chip wyboru ──────────────────────────────────────────────────────────

export function Chip({
  children,
  selected,
  limited,
  onClick,
}: {
  children: React.ReactNode;
  selected?: boolean;
  limited?: boolean;
  onClick?: () => void;
}) {
  return (
    <button type="button" className="chip" data-selected={!!selected} data-limited={!!limited} onClick={onClick}>
      {children}
      {limited && <span className="text-[9.5px] text-grunt-amber-text2">⚠ ograniczony</span>}
    </button>
  );
}
