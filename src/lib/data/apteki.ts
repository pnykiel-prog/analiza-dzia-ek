/**
 * Statyczna warstwa aptek (kanał A) — z OSM (`amenity=pharmacy`), a NIE z rejestru RA.
 * Powód: eksport Rejestru Aptek okazał się niekompletny (brak m.in. całego
 * podkarpackiego, śladowe lubelskie/lubuskie). OSM ma apteki dobrze zmapowane i
 * kompletne, ze współrzędnymi — jak sklepy/otoczenie: wgrywana lokalnie, czytana
 * per działka bez egresu. Pełną warstwę wgrywa `tools/apteki/import.ts`.
 *
 * Runtime: `kandydaciApteka(centroid, k, maxM)` → k-najbliższych aptek po linii prostej.
 * Brak w zasięgu → pole pytane ręcznie (reguła kolizji „równorzędna").
 */

import type { Kandydat } from "./connectors/geoUslugi";
import { haversineM } from "./connectors/geoUslugi";
import surowe from "./apteki_dane.json";

export interface AptekaStala {
  id: string;
  kategoria: "apteka";
  nazwa: string;
  adres: string;
  lat: number;
  lon: number;
  zrodlo: "OSM";
  data_importu: string;
}

/** Rekordy z współrzędnymi (bez lat/lon bezużyteczne do liczenia odległości). */
export const APTEKI: AptekaStala[] = ((surowe as { rekordy?: AptekaStala[] }).rekordy ?? []).filter(
  (a) => typeof a.lat === "number" && typeof a.lon === "number"
);

export const META_APTEKI = (surowe as { meta?: Record<string, unknown> }).meta ?? {};

/**
 * k-najbliższych aptek (po linii prostej) — kandydaci do routingu pieszego (kanał A).
 * `maxM` = bufor „w zasięgu": punkty dalej są POMIJANE (luka pokrycia → pole ręczne).
 */
export function kandydaciApteka(lat: number, lon: number, k: number, dane: AptekaStala[] = APTEKI, maxM = Infinity): Kandydat[] {
  const arr: Kandydat[] = [];
  for (const a of dane) {
    const dLinia = haversineM(lat, lon, a.lat, a.lon);
    if (dLinia > maxM) continue;
    arr.push({ usluga: "apteka", lat: a.lat, lon: a.lon, dLinia });
  }
  arr.sort((a, b) => a.dLinia - b.dLinia);
  return arr.slice(0, Math.max(1, k));
}
