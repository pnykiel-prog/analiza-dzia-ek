import type { KluczWerdyktu, WerdyktP1, WynikPoziom1 } from "@/lib/types";
import { Karta } from "./ui";
import { PanelDynamiki } from "./PanelDynamiki";
import { liczba } from "@/lib/format";

// Oba profile definiuje wspólny warunek: brak własnego lokalu (kwalifikacja do
// budownictwa społecznego). Wiek jedynie je rozdziela: aktywni (18–wiek emer.) / seniorzy.
const ETYK_WERDYKT: Record<KluczWerdyktu, string> = {
  spolecznyMlodzi: "Społeczny — aktywni (bez własnego M)",
  spolecznySeniorzy: "Społeczny — seniorzy (bez własnego M)",
  komunalnyMlodzi: "Komunalny — aktywni (bez własnego M)",
  komunalnySeniorzy: "Komunalny — seniorzy (bez własnego M)",
};

/**
 * Widok Poziomu 1 — PORTRET W LICZBACH (bez werdyktu). Popyt to lejek SUROWYCH LICZB:
 * populacja gminy → kohorty (aktywni / seniorzy) → kwalifikujący per segment (komunalny /
 * społeczny). Żadnej oceny słownej, koloru, poziomu (niski/umiarkowany/wysoki) ani
 * punktów/100 — jak wykresy, klient czyta liczby i sam wyrabia wrażenie. Werdykt
 * przydatności powstaje DOPIERO na Poziomie 2 (wystarczalność wobec liczby planowanych
 * mieszkań). Brak danej → „nieoznaczona", NIGDY 0. Wytyczne: „jeden werdykt per poziom".
 */
export function Poziom1View({ p1, pelny = true, populacja }: { p1: WynikPoziom1; pelny?: boolean; populacja?: number | null }) {
  const ocena = p1.ocenaPopytu;
  const w = ocena.werdykty;
  const k = ocena.kwalifikacje;

  return (
    <>
      {p1.funkcjaMieszkaniowaDozwolona === false && (
        <div className="flex items-start gap-3 rounded-md border border-grunt-red/25 bg-grunt-red-bg px-3.5 py-2.5">
          <span className="mono grid place-items-center shrink-0 w-6 h-6 rounded-full bg-grunt-red text-white text-[13px] font-bold">✕</span>
          <div>
            <div className="text-[13px] font-semibold text-grunt-red">Funkcja mieszkaniowa niedozwolona</div>
            <div className="text-[12px] text-grunt-text-muted">Wskazane przeznaczenie jest sprzeczne z zabudową mieszkaniową — sprawdź plan miejscowy.</div>
          </div>
        </div>
      )}

      {/* LEJEK POPYTU — surowe liczby (bez werdyktu). Populacja → kohorty → kwalifikujący. */}
      <Karta
        tytul="Popyt na mieszkania — portret w liczbach"
        podtytul="Lejek z rejestrów publicznych: populacja gminy → kohorty wiekowe → kwalifikujący per segment. To liczby-fakty, nie ocena — werdykt przydatności liczy Poziom 2 (wobec liczby planowanych mieszkań)."
      >
        {/* Wierzchołek lejka — populacja gminy */}
        {populacja != null && (
          <div className="flex items-baseline justify-between gap-3 rounded-panel bg-grunt-surface-3 px-4 py-3 mb-4">
            <span className="text-[12px] uppercase tracking-wide text-grunt-text-faint">Populacja gminy</span>
            <span className="mono text-[20px] font-semibold text-grunt-text">{liczba(Math.round(populacja))} <span className="text-[12px] font-normal text-grunt-text-faint2">os.</span></span>
          </div>
        )}

        {/* Dwie kohorty klienta — po jednej kolumnie, każda z dwoma segmentami */}
        <div className="grid md:grid-cols-2 gap-4">
          <KolumnaKohorty
            tytul="Aktywni (20–64)"
            akcent="var(--grunt-young)"
            nGrupa={k.mlodzi.nGrupa}
            komunalny={w.komunalnyMlodzi}
            spoleczny={w.spolecznyMlodzi}
          />
          <KolumnaKohorty
            tytul="Seniorzy (65+)"
            akcent="var(--grunt-senior)"
            nGrupa={k.seniorzy.nGrupa}
            komunalny={w.komunalnySeniorzy}
            spoleczny={w.spolecznySeniorzy}
          />
        </div>

        <p className="text-[11px] text-grunt-text-faint2 mt-4">
          Segment ustala ustawowy próg dochodowy: <strong>komunalny</strong> (najniższe dochody, osoby) ·{" "}
          <strong>społeczny</strong> (dochody umiarkowane, gospodarstwa). Udział bez mieszkania to założenie
          na danych publicznych — dlatego liczby są orientacyjne, nie precyzyjne.
        </p>
      </Karta>

      {/* Panel dynamiki gminy — czysty kontekst (~10 lat), NIE zmienia popytu ani werdyktu */}
      {pelny && <PanelDynamiki dynamika={p1.dynamikaGminy} />}
    </>
  );
}

/** Kolumna kohorty: liczebność grupy + dwa segmenty (komunalny/społeczny) jako surowe liczby. */
function KolumnaKohorty({
  tytul,
  akcent,
  nGrupa,
  komunalny,
  spoleczny,
}: {
  tytul: string;
  akcent: string;
  nGrupa: number | null;
  komunalny: WerdyktP1;
  spoleczny: WerdyktP1;
}) {
  return (
    <div className="rounded-2xl border border-grunt-border overflow-hidden" style={{ background: "var(--grunt-surface)" }}>
      <div style={{ height: 4, background: akcent }} />
      <div className="px-4 pt-4 pb-4">
        <div className="flex items-center gap-2.5 mb-3">
          <span className="w-[11px] h-[11px] rounded-full" style={{ background: akcent }} />
          <span className="text-[13px] font-semibold text-grunt-text-3">{tytul}</span>
        </div>
        {/* Liczebność kohorty (mianownik lejka) */}
        <div className="flex items-baseline justify-between gap-2 pb-3 mb-3 border-b border-grunt-divider-row">
          <span className="text-[11px] uppercase tracking-wide text-grunt-text-faint">Kohorta (bez własnego M)</span>
          <span className="mono text-[16px] font-semibold text-grunt-text">{nGrupa == null ? "nieoznaczona" : liczba(nGrupa)}</span>
        </div>
        {/* Dwa segmenty — kwalifikujący (liczba-fakt + neutralny % kohorty) */}
        <div className="flex flex-col gap-2.5">
          <PozycjaSegmentu etyk="Komunalny" jedn="os." w={komunalny} />
          <PozycjaSegmentu etyk="Społeczny" jedn="gosp." w={spoleczny} />
        </div>
      </div>
    </div>
  );
}

/** Pozycja lejka: kwalifikujący danego segmentu jako liczba (neutralnie, bez koloru oceny). */
function PozycjaSegmentu({ etyk, jedn, w }: { etyk: string; jedn: string; w: WerdyktP1 }) {
  const n = w.liczbaKwalifikujacych;
  const pct = w.proporcjaKohortowaPct;
  return (
    <div className="flex items-baseline justify-between gap-3">
      <span className="text-[12.5px] text-grunt-text-muted2">{etyk}</span>
      <span className="text-right">
        {w.nieoznaczony || n == null ? (
          <span className="text-[13px] text-grunt-text-faint2">nieoznaczona</span>
        ) : (
          <>
            <span className="mono text-[15px] font-semibold text-grunt-text">{liczba(n)}</span>
            <span className="text-[11px] font-normal text-grunt-text-faint2"> {jedn}</span>
            {pct != null && <span className="mono text-[11px] text-grunt-text-faint2"> · {pct}% kohorty</span>}
          </>
        )}
      </span>
    </div>
  );
}

// Etykiety segmentów eksportowane do ewentualnego użycia w innych widokach (raport).
export { ETYK_WERDYKT };
