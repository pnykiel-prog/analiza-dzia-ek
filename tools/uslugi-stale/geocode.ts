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

// Nagłówki „jak przeglądarka" — GUGiK (za zaporą) odrzuca zapytania bez User-Agent (HTTP 403),
// tak samo jak RSPO. Bez tego geokodowały się 0 z N adresów.
const NAGLOWKI = {
  Accept: "application/json",
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
  "Accept-Language": "pl-PL,pl;q=0.9",
};

// Diagnostyka: przy pierwszych błędach wypisz powód, przy pierwszym sukcesie — surowe współrzędne.
let diagBledy = 0, diagSukces = false, diagUdane = 0;

/** Statystyki geokodera do podsumowania (udane vs błędy). */
export function statystykiGeokodera(): { udane: number; bledy: number } {
  return { udane: diagUdane, bledy: diagBledy };
}

/** Geokoduje adres → [lon, lat] WGS84 (lub null). Throttle 250 ms (limity GUGiK). */
export async function geokoduj(adres: string): Promise<Wsp> {
  const klucz = adres.trim().toLowerCase().replace(/\s+/g, " ");
  if (!klucz) return null;
  if (klucz in cache) return cache[klucz];

  const url = `https://services.gugik.gov.pl/uug/?request=GetAddress&address=${encodeURIComponent(adres)}`;
  const zaloguj = (powod: string, szczegol = "") => {
    if (diagBledy < 5) console.error(`  [geokoder] BŁĄD (${powod}) dla „${adres}"${szczegol ? ` — ${szczegol}` : ""}`);
    diagBledy++;
  };
  try {
    await spij(250);
    const r = await fetch(url, { headers: NAGLOWKI });
    if (!r.ok) {
      const tekst = await r.text().catch(() => "");
      zaloguj(`HTTP ${r.status}`, tekst.slice(0, 120).replace(/\s+/g, " "));
      return (cache[klucz] = null);
    }
    const j: any = await r.json();
    const res = j?.results?.["1"] ?? (j?.results ? Object.values(j.results)[0] : null);
    // UUG: x = northing, y = easting (EPSG:2180).
    const x = Number(res?.x), y = Number(res?.y);
    if (!Number.isFinite(x) || !Number.isFinite(y)) {
      zaloguj("brak współrzędnych w odpowiedzi", JSON.stringify(j).slice(0, 160));
      return (cache[klucz] = null);
    }
    const [lon, lat] = pl1992ToWgs84(y, x);
    diagUdane++;
    if (!diagSukces) {
      diagSukces = true;
      console.error(`  [geokoder] OK — test: „${adres}" → x=${x} y=${y} → lat=${lat.toFixed(5)} lon=${lon.toFixed(5)} (powinno być w Polsce: lat 49–55, lon 14–24)`);
    }
    return (cache[klucz] = [lon, lat]);
  } catch (e: any) {
    zaloguj("wyjątek", String(e?.message ?? e).slice(0, 120));
    return (cache[klucz] = null);
  }
}

/** Zapisuje cache geokodowania (wywołać po imporcie). */
export function zapiszCacheGeokodowania(): void {
  writeFileSync(PLIK_CACHE, JSON.stringify(cache, null, 0));
}
