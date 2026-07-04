/**
 * Geokoder GUGiK (adres → współrzędne WGS84) z cache adres→współrzędne.
 * Używany przez importer warstwy usług dla rekordów bez współrzędnych (RPWDL/RA).
 *
 * GUGiK UUG zwraca współrzędne w EPSG:2180 (PUWG1992) — konwertujemy przez
 * `pl1992ToWgs84` z aplikacji. Cache: nie geokoduj ponownie adresów niezmienionych
 * (roczny bieg geokoduje tylko nowe/zmienione). Nie przerywaj importu na błędzie.
 */

import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { pl1992ToWgs84 } from "../../src/lib/geo";

const KATALOG = dirname(fileURLToPath(import.meta.url));
const PLIK_CACHE = join(KATALOG, "geocode_cache.json");

type Wsp = [number, number] | null; // [lon, lat] lub null (nie zgeokodowano)
const cache: Record<string, Wsp> = existsSync(PLIK_CACHE) ? JSON.parse(readFileSync(PLIK_CACHE, "utf8")) : {};

const spij = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Geokoduje adres → [lon, lat] WGS84 (lub null). Throttle 250 ms (limity GUGiK). */
export async function geokoduj(adres: string): Promise<Wsp> {
  const klucz = adres.trim().toLowerCase().replace(/\s+/g, " ");
  if (!klucz) return null;
  if (klucz in cache) return cache[klucz];

  const url = `https://services.gugik.gov.pl/uug/?request=GetAddress&address=${encodeURIComponent(adres)}`;
  try {
    await spij(250);
    const r = await fetch(url, { headers: { Accept: "application/json" } });
    if (!r.ok) return (cache[klucz] = null);
    const j: any = await r.json();
    const res = j?.results?.["1"] ?? (j?.results ? Object.values(j.results)[0] : null);
    // UUG: x = northing, y = easting (EPSG:2180).
    const x = Number(res?.x), y = Number(res?.y);
    if (!Number.isFinite(x) || !Number.isFinite(y)) return (cache[klucz] = null);
    const [lon, lat] = pl1992ToWgs84(y, x);
    return (cache[klucz] = [lon, lat]);
  } catch {
    return (cache[klucz] = null);
  }
}

/** Zapisuje cache geokodowania (wywołać po imporcie). */
export function zapiszCacheGeokodowania(): void {
  writeFileSync(PLIK_CACHE, JSON.stringify(cache, null, 0));
}
