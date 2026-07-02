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

/** Odwrotny indeks: kod TERYT gminy (ULDK, np. „146509_8" lub „146509") → jednostka. */
let REV_TERYT: Map<string, { wojewodztwo: string; powiat: string; gmina: string }> | null = null;

function budujOdwrotny(): void {
  REV_TERYT = new Map();
  for (const [woj, powiaty] of Object.entries(DRZEWO_TERYT))
    for (const [pow, gminy] of Object.entries(powiaty))
      for (const [nazwa, kod] of Object.entries(gminy)) {
        // Nazwa bazowa bez etykiety rodzaju („(gmina wiejska)" itd.) — pod GUS/units-search.
        const gmina = nazwa.replace(/\s*\(.*\)\s*$/, "").trim();
        const jedn = { wojewodztwo: woj, powiat: pow, gmina };
        REV_TERYT.set(kod, jedn);
        REV_TERYT.set(kod.split("_")[0], jedn); // fallback: sam 6-cyfrowy kod gminy
      }
}

/**
 * Rozpoznaje jednostkę administracyjną z prefiksu TERYT identyfikatora działki.
 * Akceptuje kod gminy ULDK („146509_8"), sam kod 6-cyfrowy („146509") lub pełny
 * identyfikator działki („146509_8.0012.123/4"). Zwraca null, gdy kod nieznany.
 */
export function odwrotnyTeryt(kodLubId: string): { wojewodztwo: string; powiat: string; gmina: string } | null {
  if (!REV_TERYT) budujOdwrotny();
  const kodGminy = kodLubId.trim().split(".")[0]; // odetnij obręb/numer, jeśli podano pełny id
  const bezSufiksu = kodGminy.split("_")[0]; // usuń „_R" (rodzaj gminy)
  // Forma bez podkreślnika, np. „1863011" (WWPPGG + rodzaj) → pierwsze 6 cyfr = kod gminy (WWPPGG).
  const szescCyfr = kodGminy.replace(/\D/g, "").slice(0, 6);
  const trafienie = REV_TERYT!.get(kodGminy) ?? REV_TERYT!.get(bezSufiksu) ?? REV_TERYT!.get(szescCyfr);
  if (trafienie) return trafienie;
  // m.st. Warszawa: działki są identyfikowane kodami dzielnic (146501–146519, np.
  // „146517_8" = Wola), których słownik nie zawiera. Wszystkie dzielnice (prefiks
  // 1465) mapujemy na gminę „Warszawa" — na tym poziomie GUS BDL raportuje demografię.
  if (szescCyfr.startsWith("1465")) return REV_TERYT!.get("146501") ?? null;
  return null;
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
