/**
 * Konektor KIMPZP — status planistyczny (M1).
 *
 * WMS GetFeatureInfo w centroidzie terenu. Pułapka z wytycznych: ~75% gmin to
 * rastry (brak atrybutów) → wtedy „brak" (silnik potraktuje jako „do weryfikacji",
 * nigdy „wykluczone"). Atrybuty wyciągniemy tylko z gmin wektorowych.
 *
 * Implementacja best-effort i defensywna: przy niepewnym formacie/osi współrzędnych
 * zwraca „brak", nie błąd. Pełne dostrojenie po weryfikacji na żywych danych.
 */

import type { DaneDzialki, StatusPlanistyczny } from "../../types";
import type { Konektor, Teren, WynikKonektora } from "./types";
import { brakWyniku } from "./types";
import { fetchTekst } from "./net";
import { KONFIG_KONEKTORY } from "../connectorsConfig";

const cfg = KONFIG_KONEKTORY.kimpzp;

/** Heurystyka przeznaczenia z tekstu odpowiedzi WMS (JSON/HTML/XML). */
export function rozpoznajPrzeznaczenie(tekst: string): StatusPlanistyczny | null {
  const t = tekst.toLowerCase();
  if (!t.trim()) return null;
  // Sprzeczne z mieszkaniową (przemysł, las, drogi, tereny zamknięte).
  if (/\b(przemys|produkcyj|tereny zamkn|las|leśn|cmentar|górnicz)/.test(t)) return "sprzeczny";
  // Mieszkaniowe: symbole (MN/MW/MU/MWn) oraz opisy wielowyrazowe
  // („zabudowa … mieszkaniowa/wielofunkcyjna", „funkcja mieszkaniowa").
  // „mieszkanio” łapie deklinacje (mieszkaniowa/-ej/-ych); „mieszkalni” — budynki mieszkalne.
  if (/mieszkanio|mieszkaln|funkcja mieszkan|zabudow[ay][^.]{0,40}mieszkan|\bm[nwu]\b|\bmwn\b/.test(t))
    return "mpzp_mieszkaniowy";
  return null;
}

/** Buduje URL GetFeatureInfo KIMPZP dla punktu (EPSG:2180). Współdzielony z diagnostyką. */
export function urlGetFeatureInfo(x: number, y: number, infoFormat: string = cfg.infoFormat): string {
  const d = 25; // półbok okna zapytania [m]
  // WMS 1.1.1: BBOX = minx,miny,maxx,maxy w naturalnej kolejności SRS.
  const params = new URLSearchParams({
    SERVICE: "WMS",
    VERSION: "1.1.1",
    REQUEST: "GetFeatureInfo",
    SRS: "EPSG:2180",
    LAYERS: cfg.warstwy,
    QUERY_LAYERS: cfg.warstwy,
    BBOX: `${x - d},${y - d},${x + d},${y + d}`,
    WIDTH: "101",
    HEIGHT: "101",
    X: "50",
    Y: "50",
    INFO_FORMAT: infoFormat,
    FEATURE_COUNT: "5",
  });
  return `${cfg.endpoint}?${params.toString()}`;
}

/**
 * Diagnostyka KIMPZP: dla centroidu (EPSG:2180) zwraca URL zapytania, surową
 * odpowiedź WMS i rozpoznane przeznaczenie. Próbuje kolejno formatów odpowiedzi
 * (JSON → tekst → HTML → GML), bo różne gminy udostępniają różne INFO_FORMAT.
 */
export async function diagKimpzp(
  x: number,
  y: number
): Promise<{ formatUzyty: string | null; url: string; dlugosc: number; przeznaczenie: StatusPlanistyczny | null; surowa: string | null }> {
  const formaty = [cfg.infoFormat, "text/plain", "text/html", "application/vnd.ogc.gml"];
  let ostatniUrl = urlGetFeatureInfo(x, y);
  for (const fmt of formaty) {
    const url = urlGetFeatureInfo(x, y, fmt);
    ostatniUrl = url;
    const tekst = await fetchTekst(url, { timeoutMs: 6000, proby: 1 });
    if (tekst && tekst.trim().length > 0) {
      return { formatUzyty: fmt, url, dlugosc: tekst.length, przeznaczenie: rozpoznajPrzeznaczenie(tekst), surowa: tekst.slice(0, 2500) };
    }
  }
  return { formatUzyty: null, url: ostatniUrl, dlugosc: 0, przeznaczenie: null, surowa: null };
}

export const konektorKIMPZP: Konektor = {
  klucz: "KIMPZP",
  zrodlo: "KIMPZP (Krajowa Integracja MPZP)",
  poziom: "P1",
  aktywny: cfg.aktywny,
  async pobierz(teren: Teren): Promise<WynikKonektora> {
    const czas = new Date().toISOString();
    const c = teren.centroid2180;
    if (!c) return brakWyniku(this.klucz, this.zrodlo, czas, "Brak centroidu terenu (brak geometrii).");

    const [x, y] = c;
    const tekst = await fetchTekst(urlGetFeatureInfo(x, y), { timeoutMs: 4500, proby: 1 });
    if (tekst === null) return brakWyniku(this.klucz, this.zrodlo, czas, "Brak odpowiedzi WMS.");

    const przeznaczenie = rozpoznajPrzeznaczenie(tekst);
    if (!przeznaczenie) {
      return brakWyniku(this.klucz, this.zrodlo, czas, "Brak atrybutów (prawdopodobnie raster) — do weryfikacji.");
    }
    const dane: Partial<DaneDzialki> = { statusPlanistyczny: przeznaczenie };
    return {
      klucz: this.klucz,
      zrodlo: this.zrodlo,
      status: "ok",
      czas,
      dane,
      meta: [{ pole: "statusPlanistyczny", zrodlo: this.zrodlo, czas, pewnosc: 60, status: "ok", tryb: "A" }],
    };
  },
};
