/**
 * Słownik TERYT — pełny, statyczny.
 *
 * Dane: PRG (geoportal.gov.pl) — 16 województw, 380 powiatów, wszystkie gminy
 * z poprawnymi kodami ULDK. Gminy miejsko-wiejskie rozbite na pod-jednostki
 * ULDK: „(miasto)" → `_4`, „(obszar wiejski)" → `_5` (parcele należą do nich,
 * nie do `_3`). Wygenerowane z `teryt-data.json` (bez geometrii, ~100 KB).
 *
 * ULDK nie udostępnia API do listowania jednostek — dlatego kaskada opiera się
 * na tym statycznym słowniku, a nie na zapytaniach do usługi.
 */

import DRZEWO from "./teryt-data.json";
export { WOJEWODZTWA } from "./wojewodztwa";

/** województwo → powiat → nazwa gminy (z etykietą rodzaju) → kod TERYT ULDK. */
const DRZEWO_TERYT = DRZEWO as Record<string, Record<string, Record<string, string>>>;

export function powiaty(woj: string): string[] {
  return Object.keys(DRZEWO_TERYT[woj] ?? {}).sort((a, b) => a.localeCompare(b, "pl"));
}

export function gminy(woj: string, powiat: string): string[] {
  return Object.keys(DRZEWO_TERYT[woj]?.[powiat] ?? {}).sort((a, b) => a.localeCompare(b, "pl"));
}

/** Obręby nie są w słowniku PRG — wpisywane ręcznie (kod 4-cyfrowy). */
export function obreby(_woj: string, _powiat: string, _gmina: string): string[] {
  return [];
}

export function terytGminy(woj: string, powiat: string, gmina: string): string | null {
  return DRZEWO_TERYT[woj]?.[powiat]?.[gmina] ?? null;
}

/** Dane jednej pozycji identyfikacyjnej z formularza. */
export interface PozycjaDzialki {
  wojewodztwo: string;
  powiat: string;
  gmina: string;
  obreb: string;
  numer: string;
  /** Kod TERYT gminy z kaskady ULDK (gdy dostępny — ma pierwszeństwo nad mini-słownikiem). */
  gminaTeryt?: string;
  /** Pełny identyfikator ULDK wpisany wprost (omija składanie z nazw/TERYT). */
  idBezposredni?: string;
}

/**
 * Składa identyfikator działki dla ULDK: `${terytGminy}.${obreb}.${numer}`.
 * Priorytet TERYT: kod z kaskady ULDK → mini-słownik → pseudo-token (fallback
 * offline, sygnalizowany w resolverze).
 */
export function skomponujId(p: PozycjaDzialki): { id: string; znanyTeryt: boolean } {
  // Tryb bezpośredni: użytkownik podał pełny identyfikator ULDK.
  if (p.idBezposredni && p.idBezposredni.trim()) {
    return { id: p.idBezposredni.trim(), znanyTeryt: true };
  }
  const teryt = (p.gminaTeryt && p.gminaTeryt.trim()) || terytGminy(p.wojewodztwo, p.powiat, p.gmina);
  const token = teryt || `${p.wojewodztwo}/${p.gmina}`;
  // Obręb dopełniony zerami do 4 cyfr (wymóg formatu identyfikatora ULDK).
  const obreb = /^\d+$/.test(p.obreb.trim()) ? p.obreb.trim().padStart(4, "0") : p.obreb.trim();
  const id = `${token}.${obreb}.${p.numer.trim()}`;
  return { id, znanyTeryt: !!teryt };
}
