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
        className="mx-auto h-full px-6 flex items-stretch"
        style={{ maxWidth: "var(--grunt-page-max)" }}
      >
        {kroki.map((k, i) => {
          const stan: StanKroku =
            k.nr === aktywny ? "aktywny" : k.nr < aktywny || k.nr <= maxOsiagniety ? (k.nr < aktywny ? "ukonczony" : "osiagniety") : "niedostepny";
          const ukonczony = k.nr < aktywny;
          const osiagalny = k.nr <= maxOsiagniety;
          return (
            <div key={k.nr} className="flex items-center">
              <button
                type="button"
                disabled={!osiagalny || !onKrok}
                onClick={() => osiagalny && onKrok?.(k.nr)}
                className={`relative flex items-center gap-2.5 py-2.5 pr-4 ${osiagalny && onKrok ? "cursor-pointer" : "cursor-default"}`}
              >
                <ZnacznikKroku nr={k.nr} stan={ukonczony ? "ukonczony" : stan} />
                <span className="flex flex-col items-start leading-tight">
                  <span
                    className={`text-[12.5px] ${
                      stan === "aktywny" ? "text-grunt-ink font-semibold" : stan === "niedostepny" ? "text-grunt-text-ghost" : "text-grunt-text-3"
                    }`}
                  >
                    {k.etykieta}
                  </span>
                  <span className={`text-[10px] ${stan === "niedostepny" ? "text-grunt-text-ghost" : "text-grunt-text-faint2"}`}>
                    {k.podtytul}
                  </span>
                </span>
                {stan === "aktywny" && <span className="absolute left-0 bottom-0 h-0.5 w-full bg-grunt-ink" />}
              </button>
              {i < kroki.length - 1 && <span className="w-8 h-px bg-grunt-border-2 mx-1" />}
            </div>
          );
        })}
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
      className="rounded-panel px-5 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
      style={{ background: "radial-gradient(circle at 85% 0%, #21385a, #16263F)" }}
    >
      <div>
        <div className="text-white font-semibold text-[15px]">{tytul}</div>
        {opis && <div className="text-[12.5px] text-[#A9BBD2] mt-0.5 max-w-2xl">{opis}</div>}
      </div>
      <div className="flex items-center gap-2.5 shrink-0">
        {secondary && secondaryLabel && (
          <button
            type="button"
            onClick={secondary}
            className="rounded-input px-4 text-[13px] font-semibold text-white bg-transparent hover:bg-white/5"
            style={{ height: "var(--grunt-h-btn-lg)", border: "1px solid #ffffff33" }}
          >
            {secondaryLabel}
          </button>
        )}
        {akcja && akcjaLabel && (
          <button
            type="button"
            onClick={akcja}
            disabled={disabled}
            className="rounded-input px-5 text-[13px] font-semibold bg-white text-grunt-ink hover:bg-grunt-surface-3 disabled:opacity-50 flex items-center gap-1.5"
            style={{ height: "var(--grunt-h-btn-lg)" }}
          >
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
