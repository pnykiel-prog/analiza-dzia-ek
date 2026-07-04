/**
 * Statyczna warstwa usług (kanał A) — szkoły/przedszkola/POZ/apteki z rejestrów
 * urzędowych (RSPO/RPWDL/RA), wgrane lokalnie i odświeżane raz w roku (patrz
 * `tools/uslugi-stale/README.md`). Deterministyczne, bez API na żywo per działka.
 *
 * Runtime: `kandydaciStale(centroid, k)` zwraca k-najbliższych per kategoria po
 * linii prostej (kandydaci do routingu pieszego). Brak punktu w warstwie → pole
 * pytane ręcznie (reguła kolizji „równorzędna"); brak ≠ dyskwalifikacja.
 *
 * Uwaga: dołączony plik `uslugi_stale.json` to SEED (kilka rekordów) — pełny
 * rejestr wgrywa roczny import wsadowy.
 */

import type { Kandydat } from "./connectors/geoUslugi";
import { haversineM } from "./connectors/geoUslugi";
import surowe from "./uslugi_stale.json";

/** Cztery kategorie ze statycznej warstwy (spec §1). Reszta (przystanek/sklep) — OSM. */
export const KATEGORIE_STALE = ["szkola", "przedszkole", "poz", "apteka"] as const;
export type KategoriaStala = (typeof KATEGORIE_STALE)[number];

export interface UslugaStala {
  id: string;
  kategoria: KategoriaStala;
  nazwa: string;
  adres: string;
  lat: number;
  lon: number;
  teryt_gmina: string;
  zrodlo: "RSPO" | "RPWDL" | "RA";
  data_importu: string;
}

/** Rekordy z współrzędnymi (bez lat/lon są bezużyteczne do liczenia odległości — spec §2/§4). */
export const USLUGI_STALE: UslugaStala[] = ((surowe as { rekordy?: UslugaStala[] }).rekordy ?? []).filter(
  (u) => typeof u.lat === "number" && typeof u.lon === "number" && (KATEGORIE_STALE as readonly string[]).includes(u.kategoria)
);

export const META_USLUGI_STALE = (surowe as { meta?: Record<string, unknown> }).meta ?? {};

/**
 * k-najbliższych obiektów każdej kategorii statycznej (po linii prostej) — kandydaci do routingu.
 * `maxM` = bufor „w zasięgu": punkty dalej niż `maxM` są POMIJANE (luka rejestru / brak pokrycia
 * seedu) — kategoria bez punktu w zasięgu → pytana ręcznie, NIE absurdalna odległość (spec §4/§7).
 */
export function kandydaciStale(lat: number, lon: number, k: number, dane: UslugaStala[] = USLUGI_STALE, maxM = Infinity): Kandydat[] {
  const wg: Record<string, Kandydat[]> = {};
  for (const u of dane) {
    const dLinia = haversineM(lat, lon, u.lat, u.lon);
    if (dLinia > maxM) continue; // poza zasięgiem → luka, nie „daleko"
    (wg[u.kategoria] ??= []).push({ usluga: u.kategoria, lat: u.lat, lon: u.lon, dLinia });
  }
  const out: Kandydat[] = [];
  for (const arr of Object.values(wg)) {
    arr.sort((a, b) => a.dLinia - b.dLinia);
    out.push(...arr.slice(0, Math.max(1, k)));
  }
  return out;
}
