/**
 * Statyczna warstwa uciążliwości otoczenia (kanał O — ŁAGODNA KARA, NIE bramka).
 * Uzupełnia bonusy otoczenia symetrycznie: przemysł/kolej/droga szybkiego ruchu/
 * wysypisko/lotnisko blisko działki obniżają jakość otoczenia (nie skreślają działki).
 * Wzorzec jak apteki/sklepy/otoczenie: wgrywana lokalnie, czytana per działka bez
 * egresu. Pełną warstwę wgrywa `tools/uciazliwosci/import.ts` (Overpass). Plik = SEED.
 *
 * Runtime: `najblizszeUciazliwosci(centroid, maxM)` → najbliższa odległość [m] per typ
 * (linia prosta — do miękkiego modyfikatora wystarcza). Brak → typ pominięty (bez kary).
 */

import { haversineM } from "./connectors/geoUslugi";
import surowe from "./uciazliwosci_dane.json";

export type TypUciazliwosci = "uc_przemysl" | "uc_kolej" | "uc_droga" | "uc_wysypisko" | "uc_lotnisko";
export const TYPY_UCIAZLIWOSCI: readonly TypUciazliwosci[] = ["uc_przemysl", "uc_kolej", "uc_droga", "uc_wysypisko", "uc_lotnisko"];

export interface ObiektUciazliwosci {
  id: string;
  typ: TypUciazliwosci;
  nazwa: string;
  lat: number;
  lon: number;
  zrodlo: "OSM";
  data_importu: string;
}

export const UCIAZLIWOSCI: ObiektUciazliwosci[] = ((surowe as { rekordy?: ObiektUciazliwosci[] }).rekordy ?? []).filter(
  (o) => typeof o.lat === "number" && typeof o.lon === "number" && (TYPY_UCIAZLIWOSCI as readonly string[]).includes(o.typ)
);

export const META_UCIAZLIWOSCI = (surowe as { meta?: Record<string, unknown> }).meta ?? {};

/**
 * Najbliższa odległość [m, zaokr. do 10] każdego typu uciążliwości w buforze `maxM`.
 * Zwraca tylko typy znalezione w zasięgu (brak = brak kary — neutralnie).
 */
export function najblizszeUciazliwosci(
  lat: number,
  lon: number,
  maxM = Infinity,
  dane: ObiektUciazliwosci[] = UCIAZLIWOSCI
): Partial<Record<TypUciazliwosci, number>> {
  const min: Partial<Record<TypUciazliwosci, number>> = {};
  for (const o of dane) {
    const d = haversineM(lat, lon, o.lat, o.lon);
    if (d > maxM) continue;
    if (min[o.typ] == null || d < (min[o.typ] as number)) min[o.typ] = d;
  }
  for (const t of TYPY_UCIAZLIWOSCI) if (min[t] != null) min[t] = Math.round((min[t] as number) / 10) * 10;
  return min;
}
