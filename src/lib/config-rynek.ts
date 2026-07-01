/**
 * Dane rynkowe i wartość odtworzeniowa — tabele konfiguracyjne (M3).
 *
 * Brak otwartego API:
 *  - Wartość odtworzeniowa = wskaźnik przeliczeniowy kosztu odtworzenia 1 m²
 *    (ogłaszany przez wojewodów kwartalnie; osobno dla miasta wojewódzkiego i
 *    reszty województwa). Podstawa pułapu czynszu SIM.
 *  - Czynsz rynkowy / ceny nowych lokali = brak oficjalnego API → mediana
 *    regionalna jako fallback (reguła wystarczalności, sekcja 7 katalogu danych).
 *
 * Wartości startowe — DO AKTUALIZACJI ~2×/rok przy publikacji wskaźników.
 * Zgodnie z zasadą „konfiguracja, nie kod".
 */

/** Wskaźnik przeliczeniowy kosztu odtworzenia 1 m² [zł] — miasto wojewódzkie / reszta. */
export const WARTOSC_ODTWORZENIOWA: Record<string, { miasto: number; reszta: number }> = {
  dolnośląskie: { miasto: 7300, reszta: 6300 },
  "kujawsko-pomorskie": { miasto: 6000, reszta: 5400 },
  lubelskie: { miasto: 6200, reszta: 5400 },
  lubuskie: { miasto: 5600, reszta: 5200 },
  łódzkie: { miasto: 6400, reszta: 5600 },
  małopolskie: { miasto: 7600, reszta: 6600 },
  mazowieckie: { miasto: 8200, reszta: 6500 },
  opolskie: { miasto: 5800, reszta: 5300 },
  podkarpackie: { miasto: 6000, reszta: 5300 },
  podlaskie: { miasto: 6300, reszta: 5500 },
  pomorskie: { miasto: 7800, reszta: 6600 },
  śląskie: { miasto: 6800, reszta: 6000 },
  świętokrzyskie: { miasto: 5900, reszta: 5200 },
  "warmińsko-mazurskie": { miasto: 6000, reszta: 5300 },
  wielkopolskie: { miasto: 7000, reszta: 6000 },
  zachodniopomorskie: { miasto: 6500, reszta: 5700 },
};

/** Miasta wojewódzkie (do wyboru wariantu „miasto"). */
export const MIASTA_WOJEWODZKIE = new Set<string>([
  "Wrocław", "Bydgoszcz", "Toruń", "Lublin", "Gorzów Wielkopolski", "Zielona Góra", "Łódź",
  "Kraków", "Warszawa", "Opole", "Rzeszów", "Białystok", "Gdańsk", "Katowice", "Kielce",
  "Olsztyn", "Poznań", "Szczecin",
]);

const WARTOSC_DOMYSLNA = { miasto: 6500, reszta: 5800 };

function nazwaBezEtykiety(gmina: string): string {
  return gmina.replace(/\s*\(.*\)\s*$/, "").trim();
}

/** Wartość odtworzeniowa dla działki (po województwie + czy miasto wojewódzkie). */
export function wartoscOdtworzeniowaDla(woj: string, gmina: string): { wartosc: number; obszar: "miasto wojewódzkie" | "reszta województwa" } {
  const t = WARTOSC_ODTWORZENIOWA[woj] ?? WARTOSC_DOMYSLNA;
  const miasto = MIASTA_WOJEWODZKIE.has(nazwaBezEtykiety(gmina));
  return { wartosc: miasto ? t.miasto : t.reszta, obszar: miasto ? "miasto wojewódzkie" : "reszta województwa" };
}

/** Mediana regionalna: czynsz [zł/m²/mc], cena nowych [zł/m²]. Fallback rynkowy. */
export const MEDIANA_RYNKOWA: Record<string, { czynsz: number; cenaNowych: number }> = {
  dolnośląskie: { czynsz: 50, cenaNowych: 11000 },
  "kujawsko-pomorskie": { czynsz: 42, cenaNowych: 8500 },
  lubelskie: { czynsz: 40, cenaNowych: 8200 },
  lubuskie: { czynsz: 38, cenaNowych: 7600 },
  łódzkie: { czynsz: 45, cenaNowych: 8800 },
  małopolskie: { czynsz: 52, cenaNowych: 12500 },
  mazowieckie: { czynsz: 60, cenaNowych: 13000 },
  opolskie: { czynsz: 38, cenaNowych: 7600 },
  podkarpackie: { czynsz: 40, cenaNowych: 8000 },
  podlaskie: { czynsz: 42, cenaNowych: 8500 },
  pomorskie: { czynsz: 54, cenaNowych: 12000 },
  śląskie: { czynsz: 45, cenaNowych: 9000 },
  świętokrzyskie: { czynsz: 38, cenaNowych: 7500 },
  "warmińsko-mazurskie": { czynsz: 40, cenaNowych: 7800 },
  wielkopolskie: { czynsz: 47, cenaNowych: 9200 },
  zachodniopomorskie: { czynsz: 46, cenaNowych: 9500 },
};

const MEDIANA_DOMYSLNA = { czynsz: 42, cenaNowych: 8500 };

export function medianaRynkowa(woj: string): { czynsz: number; cenaNowych: number } {
  return MEDIANA_RYNKOWA[woj] ?? MEDIANA_DOMYSLNA;
}

// ── Reguła wystarczalności rynku (drabina przestrzenna, spec §7) ─────────────

export type PoziomDrabiny = "miejscowosc" | "gmina" | "powiat" | "wojewodztwo";

export interface WynikDrabiny {
  czynsz: number;
  cenaNowych: number;
  /** Szczebel, z którego pochodzą wartości (najniższy z wystarczającą próbą). */
  poziom: PoziomDrabiny;
  /** Liczba ofert w próbie (0 = brak podłączonego źródła ofert lokalnych). */
  n: number;
}

/** Progi wystarczalności próby ofert (N): ≥30 wiarygodne, 10–29 szacunek, <10 degradacja. */
export const PROGI_OFERT = { wiarygodne: 30, szacunek: 10 };

/**
 * Drabina przestrzenna miejscowość→gmina→powiat→województwo: maks. JEDNA próba na
 * szczebel (spec §3.1/§7), schodzenie w dół tylko przy niewystarczającej próbie.
 * Brak otwartego API ofert → szczeble lokalne zwracają 0 ofert i schodzimy do
 * mediany wojewódzkiej (fallback). Po podłączeniu realnego źródła ofert wystarczy,
 * by `probaOfert` zwracała n>0 na właściwym szczeblu — logika drabiny bez zmian.
 */
export function drabinaRynkowa(
  woj: string,
  gmina = "",
  powiat = "",
  probaOfert: (poziom: PoziomDrabiny, klucz: string) => { czynsz: number; cenaNowych: number; n: number } | null = () => null
): WynikDrabiny {
  const szczeble: { poziom: PoziomDrabiny; klucz: string }[] = [
    { poziom: "miejscowosc", klucz: gmina },
    { poziom: "gmina", klucz: gmina },
    { poziom: "powiat", klucz: powiat },
  ];
  for (const { poziom, klucz } of szczeble) {
    if (!klucz) continue;
    const p = probaOfert(poziom, klucz); // jedna próba na szczebel
    if (p && p.n >= PROGI_OFERT.szacunek) {
      return { czynsz: p.czynsz, cenaNowych: p.cenaNowych, poziom, n: p.n };
    }
  }
  // Fallback wojewódzki (statystyczny, nie zliczone oferty): n=0 → degradacja pewności.
  const m = medianaRynkowa(woj);
  return { czynsz: m.czynsz, cenaNowych: m.cenaNowych, poziom: "wojewodztwo", n: 0 };
}

/** Pewność [0–100] z liczby ofert wg progów wystarczalności. */
export function pewnoscOfert(n: number): number {
  if (n >= PROGI_OFERT.wiarygodne) return 85;
  if (n >= PROGI_OFERT.szacunek) return 60;
  return 45; // niewystarczające → fallback regionalny
}
