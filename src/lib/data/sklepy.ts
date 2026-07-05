/**
 * Statyczna warstwa sklepów spożywczych (kanał A) — wytyczne `wytyczne_claude_code_sklepy.md`.
 * Warstwowe źródło (sklepy nie mają czystego rejestru): lokalizatory sieci (baza) + OSM
 * (niezależne) + [REGON]. Znormalizowana, ze współrzędnymi, wgrywana lokalnie (2×/rok),
 * czytana per działka bez egresu — jak `uslugi_stale`. Pełną warstwę wgrywa `tools/sklepy/import.ts`.
 *
 * Runtime: `kandydaciSklep(centroid, k, maxM)` → k-najbliższych sklepów po linii prostej
 * (kandydaci do routingu). Brak w zasięgu → pole pytane ręcznie (reguła kolizji „równorzędna").
 */

import type { Kandydat } from "./connectors/geoUslugi";
import { haversineM } from "./connectors/geoUslugi";
import surowe from "./sklepy_dane.json";

export interface SklepStaly {
  id: string;
  kategoria: "sklep";
  nazwa: string;
  adres: string;
  lat: number;
  lon: number;
  teryt_gmina: string;
  siec: string; // „Biedronka" | „Dino" | … | „niezależny"
  zrodlo: "siec" | "OSM" | "REGON";
  data_importu: string;
}

/** Rekordy z współrzędnymi (bez lat/lon bezużyteczne do liczenia odległości — spec §5). */
export const SKLEPY: SklepStaly[] = ((surowe as { rekordy?: SklepStaly[] }).rekordy ?? []).filter(
  (s) => typeof s.lat === "number" && typeof s.lon === "number"
);

export const META_SKLEPY = (surowe as { meta?: Record<string, unknown> }).meta ?? {};

/**
 * k-najbliższych sklepów (po linii prostej) — kandydaci do routingu pieszego (kanał A).
 * `maxM` = bufor „w zasięgu": punkty dalej są POMIJANE (luka pokrycia → pole ręczne, spec §7).
 */
export function kandydaciSklep(lat: number, lon: number, k: number, dane: SklepStaly[] = SKLEPY, maxM = Infinity): Kandydat[] {
  const arr: Kandydat[] = [];
  for (const s of dane) {
    const dLinia = haversineM(lat, lon, s.lat, s.lon);
    if (dLinia > maxM) continue;
    arr.push({ usluga: "sklep", lat: s.lat, lon: s.lon, dLinia });
  }
  arr.sort((a, b) => a.dLinia - b.dLinia);
  return arr.slice(0, Math.max(1, k));
}
