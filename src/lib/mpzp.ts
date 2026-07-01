/**
 * Słownik symboli przeznaczenia MPZP + mapowanie na status planistyczny P1.
 *
 * Na tym etapie (brak pełnego automatycznego podpięcia KIMPZP) wypełniający może
 * zadeklarować, czy dla działki istnieje MPZP, i wskazać symbol z listy. To wystarcza
 * do Poziomu 1 i „zamyka" pytanie o plan — nie pokazujemy wtedy braku MPZP.
 */

import type { StatusPlanistyczny } from "./types";

export type KategoriaMpzp = "mieszkaniowa" | "mieszkaniowo_uslugowa" | "uslugowa" | "inna";

export interface SymbolMpzp {
  symbol: string;
  opis: string;
  kategoria: KategoriaMpzp;
}

/** Najczęstsze symbole MPZP (uproszczony katalog do wyboru ręcznego). */
export const SYMBOLE_MPZP: SymbolMpzp[] = [
  { symbol: "MN", opis: "Zabudowa mieszkaniowa jednorodzinna", kategoria: "mieszkaniowa" },
  { symbol: "MW", opis: "Zabudowa mieszkaniowa wielorodzinna", kategoria: "mieszkaniowa" },
  { symbol: "MWn", opis: "Zabudowa wielorodzinna niska", kategoria: "mieszkaniowa" },
  { symbol: "MU", opis: "Zabudowa mieszkaniowo-usługowa", kategoria: "mieszkaniowo_uslugowa" },
  { symbol: "MW/U", opis: "Wielorodzinna z usługami", kategoria: "mieszkaniowo_uslugowa" },
  { symbol: "MN/U", opis: "Jednorodzinna z usługami", kategoria: "mieszkaniowo_uslugowa" },
  { symbol: "U", opis: "Usługi", kategoria: "uslugowa" },
  { symbol: "UC", opis: "Usługi wielkopowierzchniowe", kategoria: "uslugowa" },
  { symbol: "RM", opis: "Zabudowa zagrodowa", kategoria: "inna" },
  { symbol: "P", opis: "Tereny produkcyjne / przemysł", kategoria: "inna" },
  { symbol: "PU", opis: "Produkcyjno-usługowe", kategoria: "inna" },
  { symbol: "R", opis: "Tereny rolnicze", kategoria: "inna" },
  { symbol: "ZL", opis: "Lasy", kategoria: "inna" },
  { symbol: "ZP", opis: "Zieleń urządzona", kategoria: "inna" },
  { symbol: "KD", opis: "Tereny dróg / komunikacji", kategoria: "inna" },
  { symbol: "WS", opis: "Wody powierzchniowe", kategoria: "inna" },
];

/**
 * Mapuje symbol MPZP na status planistyczny P1.
 * Funkcja mieszkaniowa (także mieszkaniowo-usługowa) → `mpzp_mieszkaniowy`;
 * przeznaczenia bez zabudowy wielorodzinnej (usługi, przemysł, rolne, lasy…) →
 * `sprzeczny` z funkcją mieszkaniową (twarde wykluczenie w bramkach).
 */
export function statusZeSymbolu(symbol: string): { status: StatusPlanistyczny; sprzeczne: boolean } {
  const wpis = SYMBOLE_MPZP.find((s) => s.symbol === symbol);
  const kat = wpis?.kategoria ?? "inna";
  if (kat === "mieszkaniowa" || kat === "mieszkaniowo_uslugowa") return { status: "mpzp_mieszkaniowy", sprzeczne: false };
  return { status: "sprzeczny", sprzeczne: true };
}
