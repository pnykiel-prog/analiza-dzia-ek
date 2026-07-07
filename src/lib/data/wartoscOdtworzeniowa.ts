/**
 * Warstwa wartości odtworzeniowej (P3) — JEDNO źródło prawdy o wskaźniku przeliczeniowym
 * kosztu odtworzenia 1 m² p.u. Wartość odtworzeniowa wyznacza pułap czynszu (5%/rok) →
 * zdolność kredytową → cały montaż, więc musi być aktualna i mapowana po lokalizacji.
 *
 * Poziom szczegółowości: WOJEWÓDZTWO + MIASTA WYDZIELONE tam, gdzie wojewoda ustala im
 * osobną, wyższą stawkę (Warszawa, Kraków, Rzeszów, Katowice…). Działka w mieście
 * wydzielonym bierze stawkę miasta (Rzeszów 7018, NIE domyślne 6000).
 *
 * Rytm: obwieszczenia wojewodów co pół roku (od 1.04 i 1.10) — 16 dzienników urzędowych,
 * brak jednego API → tabela aktualizowana ręcznie/półautomatycznie (patrz
 * `warstwa_wartosc_odtworzeniowa.md` §5). Województwa bez wpisu → fallback benchmark
 * z `config-rynek.ts` (oznaczone `benchmark: true`).
 */

import { wartoscOdtworzeniowaDla } from "../config-rynek";

interface WpisWO {
  reszta: number; // stawka „reszta województwa" [zł/m²]
  miasta?: Record<string, number>; // stawki miast wydzielonych [zł/m²]
  okresOd: string; // ISO
  okresDo: string; // ISO
  obwieszczenie: string;
  zrodloUrl: string;
}

/**
 * Zasiew z ostatnich dostępnych obwieszczeń (część do odświeżenia do bieżącego okresu
 * 1.04–30.09.2026). Uzupełniać co pół roku wg listy źródeł w wytycznych.
 */
const WARSTWA_WO: Record<string, WpisWO> = {
  śląskie: {
    reszta: 7054,
    miasta: { Katowice: 7902 },
    okresOd: "2026-04-01",
    okresDo: "2026-09-30",
    obwieszczenie: "Wojewoda Śląski",
    zrodloUrl: "https://www.katowice.uw.gov.pl",
  },
  mazowieckie: {
    reszta: 7004.17,
    miasta: { Warszawa: 10946.93 },
    okresOd: "2025-10-01",
    okresDo: "2026-03-31",
    obwieszczenie: "Wojewoda Mazowiecki",
    zrodloUrl: "https://edziennik.mazowieckie.pl",
  },
  podkarpackie: {
    reszta: 4851,
    miasta: { Rzeszów: 7018 },
    okresOd: "2025-04-01",
    okresDo: "2025-09-30",
    obwieszczenie: "Wojewoda Podkarpacki, 18.03.2025",
    zrodloUrl: "https://edziennik.rzeszow.uw.gov.pl",
  },
  pomorskie: {
    reszta: 7271,
    okresOd: "2025-10-01",
    okresDo: "2026-03-31",
    obwieszczenie: "Wojewoda Pomorski",
    zrodloUrl: "https://edziennik.gdansk.uw.gov.pl",
  },
};

export interface StawkaWO {
  wartosc: number; // zł/m²
  jednostka: string; // np. „Rzeszów" / „podkarpackie (reszta województwa)"
  typ: "miasto_wydzielone" | "wojewodztwo_reszta" | "benchmark";
  okresOd: string | null;
  okresDo: string | null;
  obwieszczenie: string | null;
  zrodloUrl: string | null;
  benchmark: boolean; // true = z tabeli benchmarków (nie z obwieszczenia)
}

function nazwaBezEtykiety(gmina: string): string {
  return gmina.replace(/\s*\(.*\)\s*$/, "").trim();
}

/**
 * Wartość odtworzeniowa dla działki — po województwie + mieście wydzielonym.
 * Działka w mieście z osobną stawką bierze stawkę miasta; inaczej „reszta województwa".
 * Brak wpisu obwieszczeniowego → benchmark z config-rynek (flaga `benchmark`).
 */
export function stawkaWO(woj: string, gmina: string): StawkaWO {
  const wpis = WARSTWA_WO[woj];
  const miasto = nazwaBezEtykiety(gmina);
  if (wpis) {
    const stawkaMiasta = wpis.miasta?.[miasto];
    return {
      wartosc: stawkaMiasta ?? wpis.reszta,
      jednostka: stawkaMiasta != null ? miasto : `${woj} (reszta województwa)`,
      typ: stawkaMiasta != null ? "miasto_wydzielone" : "wojewodztwo_reszta",
      okresOd: wpis.okresOd,
      okresDo: wpis.okresDo,
      obwieszczenie: wpis.obwieszczenie,
      zrodloUrl: wpis.zrodloUrl,
      benchmark: false,
    };
  }
  // Fallback: benchmark z config-rynek (do zebrania obwieszczenie).
  const b = wartoscOdtworzeniowaDla(woj, gmina);
  return {
    wartosc: b.wartosc,
    jednostka: `${woj} — ${b.obszar} (benchmark)`,
    typ: "benchmark",
    okresOd: null,
    okresDo: null,
    obwieszczenie: null,
    zrodloUrl: null,
    benchmark: true,
  };
}

/** Czy stawka jest przeterminowana względem podanej daty (okres_do < dziś). */
export function przeterminowana(okresDo: string | null, dzisISO: string): boolean {
  return okresDo != null && okresDo < dzisISO;
}
