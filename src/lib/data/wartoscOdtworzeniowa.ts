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
 * Dane bieżące — okres 1.04.2026–30.09.2026 (obwieszczenia wojewodów). 15 województw;
 * lubelskie do weryfikacji → póki co fallback benchmark. Aktualizować co pół roku
 * (1.04 i 1.10) wg listy źródeł w `warstwa_wartosc_odtworzeniowa.md` §5.
 */
const OKRES = { okresOd: "2026-04-01", okresDo: "2026-09-30" };
const zr = (woj: string, url: string): Pick<WpisWO, "obwieszczenie" | "zrodloUrl"> => ({
  obwieszczenie: `Wojewoda ${woj} (okres 1.04–30.09.2026)`,
  zrodloUrl: url,
});
const WARSTWA_WO: Record<string, WpisWO> = {
  dolnośląskie: { reszta: 7748, miasta: { Wrocław: 10342 }, ...OKRES, ...zr("Dolnośląski", "https://edzienniki.duw.pl") },
  "kujawsko-pomorskie": { reszta: 6685, miasta: { Bydgoszcz: 7759, Toruń: 7774 }, ...OKRES, ...zr("Kujawsko-Pomorski", "https://edzienniki.bydgoszcz.uw.gov.pl") },
  lubuskie: { reszta: 7977, miasta: { "Gorzów Wielkopolski": 8869, "Zielona Góra": 8869 }, ...OKRES, ...zr("Lubuski", "https://bip.lubuskie.uw.gov.pl") },
  łódzkie: { reszta: 5923, miasta: { Łódź: 7125 }, ...OKRES, ...zr("Łódzki", "https://dziennik.lodzkie.eu") },
  małopolskie: { reszta: 7198, miasta: { Kraków: 10003 }, ...OKRES, ...zr("Małopolski", "https://edziennik.malopolska.uw.gov.pl") },
  mazowieckie: { reszta: 7828.57, miasta: { Warszawa: 12149.38 }, ...OKRES, ...zr("Mazowiecki", "https://edziennik.mazowieckie.pl") },
  opolskie: { reszta: 5397.36, miasta: { Opole: 6684.37 }, ...OKRES, ...zr("Opolski", "https://duwo.opole.uw.gov.pl") },
  podkarpackie: { reszta: 7170, miasta: { Rzeszów: 8935 }, ...OKRES, ...zr("Podkarpacki", "https://edziennik.rzeszow.uw.gov.pl") },
  podlaskie: { reszta: 7091, miasta: { Białystok: 7470 }, ...OKRES, ...zr("Podlaski", "https://edziennik.bialystok.uw.gov.pl") },
  pomorskie: { reszta: 8206, miasta: { Gdańsk: 9914 }, ...OKRES, ...zr("Pomorski", "https://edziennik.gdansk.uw.gov.pl") },
  śląskie: { reszta: 7054, miasta: { Katowice: 7902 }, ...OKRES, ...zr("Śląski", "https://www.katowice.uw.gov.pl") },
  świętokrzyskie: { reszta: 6561.76, miasta: { Kielce: 7699.7 }, ...OKRES, ...zr("Świętokrzyski", "https://edziennik.kielce.uw.gov.pl") },
  "warmińsko-mazurskie": { reszta: 7247, miasta: { Olsztyn: 8741 }, ...OKRES, ...zr("Warmińsko-Mazurski", "https://edzienniki.olsztyn.uw.gov.pl") },
  wielkopolskie: { reszta: 7310, miasta: { Poznań: 10333 }, ...OKRES, ...zr("Wielkopolski", "https://edziennik.poznan.uw.gov.pl") },
  zachodniopomorskie: { reszta: 7718, miasta: { Szczecin: 8723 }, ...OKRES, ...zr("Zachodniopomorski", "https://e-dziennik.szczecin.uw.gov.pl") },
  // lubelskie: do weryfikacji obwieszczenia → tymczasowo fallback benchmark (config-rynek).
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
