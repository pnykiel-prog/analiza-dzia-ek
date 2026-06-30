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
  // Mieszkaniowe (MN/MW lub słownie).
  if (/\b(mieszkanio|zabudow[ay] mieszkan|\bmn\b|\bmw\b|\bmnw\b)/.test(t)) return "mpzp_mieszkaniowy";
  return null;
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
      INFO_FORMAT: cfg.infoFormat,
      FEATURE_COUNT: "5",
    });
    const tekst = await fetchTekst(`${cfg.endpoint}?${params.toString()}`, { timeoutMs: 4500, proby: 1 });
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
