/**
 * Warstwa otoczenia / jakości życia (OSM) — zieleń, plac zabaw, poczta, bank.
 * ŁAGODNY modyfikator + pozytywne sygnały (NIE bramka). Statyczna, offline, wgrywana
 * okresowo (`tools/otoczenie/import.ts`) z eksportu Overpass. Plik w repo to SEED.
 *
 * Runtime: `najblizszeOtoczenie(centroid, maxM)` → najbliższa odległość [m] per kategoria
 * (po linii prostej — do miękkiego modyfikatora wystarcza). Brak → kategoria pominięta (bez kary).
 */

import { haversineM } from "./connectors/geoUslugi";
import surowe from "./otoczenie_dane.json";

export type KategoriaOtoczenia = "zielen" | "plac_zabaw" | "poczta" | "bank";
export const KATEGORIE_OTOCZENIA: readonly KategoriaOtoczenia[] = ["zielen", "plac_zabaw", "poczta", "bank"];

export interface ObiektOtoczenia {
  id: string;
  kategoria: KategoriaOtoczenia;
  nazwa: string;
  lat: number;
  lon: number;
  zrodlo: "OSM";
  data_importu: string;
}

export const OTOCZENIE: ObiektOtoczenia[] = ((surowe as { rekordy?: ObiektOtoczenia[] }).rekordy ?? []).filter(
  (o) => typeof o.lat === "number" && typeof o.lon === "number" && (KATEGORIE_OTOCZENIA as readonly string[]).includes(o.kategoria)
);

export const META_OTOCZENIE = (surowe as { meta?: Record<string, unknown> }).meta ?? {};

/**
 * Najbliższa odległość [m, zaokr. do 10] każdej kategorii otoczenia w buforze `maxM`
 * (poza buforem = luka pokrycia, pomijane). Zwraca tylko kategorie znalezione w zasięgu.
 */
export function najblizszeOtoczenie(lat: number, lon: number, maxM = Infinity, dane: ObiektOtoczenia[] = OTOCZENIE): Partial<Record<KategoriaOtoczenia, number>> {
  const min: Partial<Record<KategoriaOtoczenia, number>> = {};
  for (const o of dane) {
    const d = haversineM(lat, lon, o.lat, o.lon);
    if (d > maxM) continue;
    if (min[o.kategoria] == null || d < (min[o.kategoria] as number)) min[o.kategoria] = d;
  }
  for (const k of KATEGORIE_OTOCZENIA) if (min[k] != null) min[k] = Math.round((min[k] as number) / 10) * 10;
  return min;
}
