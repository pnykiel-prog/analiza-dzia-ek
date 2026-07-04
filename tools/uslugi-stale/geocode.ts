/**
 * Geokoder GUGiK UUG (adres → współrzędne WGS84) z cache adres→współrzędne.
 * Używany przez importer warstwy usług dla rekordów bez współrzędnych (RPWDL/RA).
 *
 * GUGiK UUG (GetAddress) wymaga adresu w postaci „Miejscowość, Ulica Numer"
 * (miejscowość NAJPIERW, bez kodu pocztowego) — inaczej odpowiada type:city / 0.
 * Z parametrem srid=4326 zwraca od razu WGS84, więc nie ma konwersji z EPSG:2180.
 * Cache trzyma tylko udane geokodowania. Nie przerywa importu na błędzie.
 */

import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const KATALOG = dirname(fileURLToPath(import.meta.url));
const PLIK_CACHE = join(KATALOG, "geocode_cache.json");

type Wsp = [number, number] | null; // [lon, lat] lub null (nie zgeokodowano)
const cache: Record<string, Wsp> = existsSync(PLIK_CACHE) ? JSON.parse(readFileSync(PLIK_CACHE, "utf8")) : {};

const spij = (ms: number) => new Promise((r) => setTimeout(r, ms));

// Nagłówki „jak przeglądarka" — GUGiK (za zaporą) odrzuca zapytania bez User-Agent (HTTP 403).
const NAGLOWKI = {
  Accept: "application/json",
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
  "Accept-Language": "pl-PL,pl;q=0.9",
};

// Diagnostyka: przy pierwszych błędach wypisz powód, przy pierwszym sukcesie — surowa odpowiedź.
let diagBledy = 0, diagSukces = false, diagUdane = 0, diagPokazanoRaw = false;
let odOstatniegoZapisu = 0; // co N nowych trafień zrzucamy cache na dysk (odporność na przerwanie)

/** Statystyki geokodera do podsumowania (udane vs błędy). */
export function statystykiGeokodera(): { udane: number; bledy: number } {
  return { udane: diagUdane, bledy: diagBledy };
}

/**
 * Kandydaci zapytań do UUG z naszego adresu „Ulica Numer, Kod Miejscowość":
 *   1) „Miejscowość, Ulica Numer" (właściwa kolejność UUG, bez kodu),
 *   2) sama „Miejscowość" (fallback — centroid miejscowości, gdy ulica nie trafia).
 */
function kandydaci(adres: string): string[] {
  const parts = adres.split(",").map((s) => s.trim()).filter(Boolean);
  if (parts.length >= 2) {
    const ulicaNumer = parts[0];
    const miejscowosc = parts.slice(1).join(", ").replace(/\b\d{2}-\d{3}\b/g, "").trim();
    if (miejscowosc) {
      const out = [`${miejscowosc}, ${ulicaNumer}`];
      if (miejscowosc.toLowerCase() !== ulicaNumer.toLowerCase()) out.push(miejscowosc);
      return out;
    }
  }
  return [adres];
}

/** Wyciąga [lon, lat] (WGS84) z obiektu wyniku UUG — tolerancyjnie (WKT lub x/y). */
function coordsZWyniku(res: any): Wsp {
  for (const k of ["geometry_wkt", "geometry", "geom", "wkt"]) {
    const v = res?.[k];
    if (typeof v === "string") {
      const m = v.match(/POINT\s*\(\s*([-\d.]+)\s+([-\d.]+)\s*\)/i);
      if (m) return [Number(m[1]), Number(m[2])]; // WKT: POINT(lon lat)
    }
  }
  const x = Number(res?.x), y = Number(res?.y);
  if (Number.isFinite(x) && Number.isFinite(y)) {
    // srid=4326: rozpoznaj lon/lat po zakresie Polski (lon 14–25, lat 48–56).
    if (x >= 14 && x <= 25 && y >= 48 && y <= 56) return [x, y];
    if (y >= 14 && y <= 25 && x >= 48 && x <= 56) return [y, x];
    return [x, y];
  }
  return null;
}

async function zapytajUug(adres: string): Promise<Wsp> {
  const url = `https://services.gugik.gov.pl/uug/?request=GetAddress&srid=4326&address=${encodeURIComponent(adres)}`;
  await spij(250);
  const r = await fetch(url, { headers: NAGLOWKI });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  const j: any = await r.json();
  const res = j?.results?.["1"] ?? (j?.results ? Object.values(j.results)[0] : null);
  if (res && !diagPokazanoRaw) {
    diagPokazanoRaw = true;
    console.error(`  [geokoder] surowy wynik UUG dla „${adres}": ${JSON.stringify(res).slice(0, 240)}`);
  }
  return res ? coordsZWyniku(res) : null;
}

/** Geokoduje adres → [lon, lat] WGS84 (lub null). Throttle 250 ms (limity GUGiK). */
export async function geokoduj(adres: string): Promise<Wsp> {
  const klucz = adres.trim().toLowerCase().replace(/\s+/g, " ");
  if (!klucz) return null;
  // Cache trzyma TYLKO udane geokodowania — nieudanych nie zapisujemy, by systemowa
  // awaria (np. zły format zapytania) nie zatruła cache na stałe.
  if (klucz in cache) { diagUdane++; return cache[klucz]; }

  const zaloguj = (powod: string, szczegol = "") => {
    if (diagBledy < 5) console.error(`  [geokoder] BŁĄD (${powod}) dla „${adres}"${szczegol ? ` — ${szczegol}` : ""}`);
    diagBledy++;
  };
  try {
    for (const zapytanie of kandydaci(adres)) {
      const w = await zapytajUug(zapytanie);
      if (w) {
        diagUdane++;
        if (!diagSukces) {
          diagSukces = true;
          console.error(`  [geokoder] OK — „${adres}" → „${zapytanie}" → lat=${w[1].toFixed(5)} lon=${w[0].toFixed(5)} (Polska: lat 49–55, lon 14–24)`);
        }
        cache[klucz] = w;
        // Zrzut cache co 250 nowych trafień — gdyby długi bieg przerwano, kolejny wznowi.
        if (++odOstatniegoZapisu >= 250) { odOstatniegoZapisu = 0; zapiszCacheGeokodowania(); console.error(`  [geokoder] …${diagUdane} zgeokodowanych (cache zapisany)`); }
        return w;
      }
    }
    zaloguj("brak wyniku UUG (0 obiektów)");
    return null; // nie zapisujemy nieudanych do cache
  } catch (e: any) {
    zaloguj("wyjątek/HTTP", String(e?.message ?? e).slice(0, 120));
    return null; // nie zapisujemy nieudanych do cache
  }
}

/** Zapisuje cache geokodowania (wywołać po imporcie). */
export function zapiszCacheGeokodowania(): void {
  writeFileSync(PLIK_CACHE, JSON.stringify(cache, null, 0));
}
