/**
 * Warstwy środowiskowe (bramka E) — przecięcie geometrii działki ze strefą.
 * ========================================================================
 * Powódź (ISOK), ochrona przyrody (GDOŚ), osuwiska (SOPO) — zassane lokalnie
 * przez WFS (`tools/srodowisko/import.ts`), czytane per działka bez egresu.
 * Plik w repo to SEED (puste warstwy) — do czasu zassania warstwa jest
 * „niezaładowana", a jej brak = krytyczny (do weryfikacji, CAP na warunkową).
 *
 * Wynik = FLAGA PRZESIEWOWA „wykryto ograniczenie — wymaga weryfikacji",
 * NIE rozstrzygnięcie prawne (GDOŚ/ISOK zastrzegają brak mocy ustalenia granicy).
 *
 * Runtime: `strefySrodowiskowe(lon, lat)` (WGS84) → dopasowania per warstwa.
 */

import { punktWGeometrii } from "../geo";
import surowe from "./srodowisko_dane.json";

export type WarstwaSrodowiskowa = "powodz_q10" | "powodz_q1" | "powodz_q02" | "ochrona_przyrody" | "osuwiska";
export const WARSTWY: readonly WarstwaSrodowiskowa[] = ["powodz_q10", "powodz_q1", "powodz_q02", "ochrona_przyrody", "osuwiska"];

interface FeatureGeo {
  type: "Feature";
  properties?: Record<string, unknown>;
  geometry?: { type: string; coordinates: number[][][] | number[][][][] };
}
interface KolekcjaGeo {
  type: "FeatureCollection";
  features: FeatureGeo[];
}

const WARSTWY_DANE = (surowe as { warstwy?: Partial<Record<WarstwaSrodowiskowa, KolekcjaGeo>> }).warstwy ?? {};
export const META_SRODOWISKO = (surowe as { meta?: Record<string, unknown> }).meta ?? {};

/** Czy warstwa jest zassana (ma cechy)? Niezaładowana → brak danych = do weryfikacji. */
export function warstwaZaladowana(w: WarstwaSrodowiskowa): boolean {
  return (WARSTWY_DANE[w]?.features?.length ?? 0) > 0;
}

/** Czy punkt [lon,lat] leży w którejkolwiek strefie danej warstwy? */
function wWarstwie(lon: number, lat: number, w: WarstwaSrodowiskowa): boolean {
  const kolekcja = WARSTWY_DANE[w];
  if (!kolekcja?.features?.length) return false;
  for (const f of kolekcja.features) {
    const g = f.geometry;
    if (!g || (g.type !== "Polygon" && g.type !== "MultiPolygon")) continue;
    if (punktWGeometrii(lon, lat, g.type, g.coordinates)) return true;
  }
  return false;
}

export interface WynikSrodowiska {
  /** Najwyższe wykryte prawdopodobieństwo powodzi (Q10 > Q1 > Q0,2%) lub null. */
  powodz: "Q10" | "Q1" | "Q02" | null;
  natura2000: boolean; // wykryto formę ochrony (screening — różny ciężar dopiero po weryfikacji)
  osuwisko: boolean;
  /** Które warstwy są zassane (do decyzji „pass" vs „do weryfikacji" per warstwa). */
  zaladowane: Record<WarstwaSrodowiskowa, boolean>;
}

/**
 * Przecięcie centroidu działki (WGS84 [lon,lat]) z warstwami środowiskowymi.
 * Powódź stopniowana: Q10 (10%) najgroźniejsza, potem Q1 (1% „stuletnia"), potem Q0,2%.
 */
export function strefySrodowiskowe(lon: number, lat: number): WynikSrodowiska {
  const powodz = wWarstwie(lon, lat, "powodz_q10")
    ? "Q10"
    : wWarstwie(lon, lat, "powodz_q1")
      ? "Q1"
      : wWarstwie(lon, lat, "powodz_q02")
        ? "Q02"
        : null;
  return {
    powodz,
    natura2000: wWarstwie(lon, lat, "ochrona_przyrody"),
    osuwisko: wWarstwie(lon, lat, "osuwiska"),
    zaladowane: {
      powodz_q10: warstwaZaladowana("powodz_q10"),
      powodz_q1: warstwaZaladowana("powodz_q1"),
      powodz_q02: warstwaZaladowana("powodz_q02"),
      ochrona_przyrody: warstwaZaladowana("ochrona_przyrody"),
      osuwiska: warstwaZaladowana("osuwiska"),
    },
  };
}
