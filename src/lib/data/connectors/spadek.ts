/**
 * Konektor spadku terenu (M2, kanał B) — sredniSpadekPct z NMT (próbki wysokości).
 *
 * Próbkujemy wysokość w centroidzie + 4 punktach w odległości `offsetM` (N/S/E/W),
 * jednym zapytaniem do publicznego API wysokości (opentopodata, model EU-DEM).
 * Spadek = maks. nachylenie względem centroidu. Kanał B (przydatność ekonomiczna):
 * większy spadek → droższe posadowienie (tarasowanie/podpiwniczenie). Jedna próba
 * + timeout + degradacja (awaria → „brak", nie dyskwalifikuje).
 *
 * Funkcje czyste (próbki, przeliczenie spadku) testowane offline.
 */

import type { DaneDzialki } from "../../types";
import type { Konektor, Teren, WynikKonektora, MetaPola } from "./types";
import { brakWyniku } from "./types";
import { KONFIG_KONEKTORY } from "../connectorsConfig";
import { logDebug, skrot } from "../debug";
import { USER_AGENT } from "./net";

const cfg = KONFIG_KONEKTORY.spadek;

/** Centroid + 4 punkty w odległości offsetM (N/S/E/W) — [lat, lon]. */
export function punktyProbek(lat: number, lon: number, offsetM: number): [number, number][] {
  const dLat = offsetM / 111320;
  const dLon = offsetM / (111320 * Math.cos((lat * Math.PI) / 180) || 1);
  return [
    [lat, lon], // 0 = centroid
    [lat + dLat, lon],
    [lat - dLat, lon],
    [lat, lon + dLon],
    [lat, lon - dLon],
  ];
}

/** Maks. spadek [%] boków względem centroidu (elev[0]) na dystansie offsetM. */
export function spadekPct(elev: number[], offsetM: number): number | null {
  if (elev.length < 2 || elev.some((e) => e == null || !Number.isFinite(e))) return null;
  const srodek = elev[0];
  let max = 0;
  for (let i = 1; i < elev.length; i++) {
    const s = (Math.abs(elev[i] - srodek) / offsetM) * 100;
    if (s > max) max = s;
  }
  return Math.round(max * 10) / 10;
}

async function pobierzWysokosci(punkty: [number, number][]): Promise<number[] | null> {
  const locs = punkty.map(([la, lo]) => `${la.toFixed(6)},${lo.toFixed(6)}`).join("|");
  const url = `${cfg.endpoint}?locations=${encodeURIComponent(locs)}`;
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), cfg.timeoutMs);
  try {
    logDebug(`Spadek → NMT ${punkty.length} próbek`);
    const r = await fetch(url, { signal: ctrl.signal, headers: { "User-Agent": USER_AGENT, Accept: "application/json" } });
    if (!r.ok) {
      logDebug(`Spadek HTTP ${r.status}`);
      return null;
    }
    const txt = await r.text();
    logDebug(`Spadek ← ${skrot(txt, 200)}`);
    const j = JSON.parse(txt) as { results?: { elevation: number | null }[] };
    const el = j.results?.map((x) => x.elevation);
    return Array.isArray(el) && el.every((e) => typeof e === "number") ? (el as number[]) : null;
  } catch (e) {
    logDebug(`Spadek błąd: ${String(e)}`);
    return null;
  } finally {
    clearTimeout(t);
    ctrl.abort();
  }
}

export const konektorSpadek: Konektor = {
  klucz: "NMT_SPADEK",
  zrodlo: "NMT / EU-DEM (spadek terenu)",
  poziom: "P2",
  aktywny: cfg.aktywny,
  async pobierz(teren: Teren): Promise<WynikKonektora> {
    const czas = new Date().toISOString();
    if (!teren.centroid4326) return brakWyniku(this.klucz, this.zrodlo, czas, "Brak centroidu WGS84 (brak geometrii).");
    const [lon, lat] = teren.centroid4326;
    const wys = await pobierzWysokosci(punktyProbek(lat, lon, cfg.offsetM));
    if (wys === null) return brakWyniku(this.klucz, this.zrodlo, czas, "Brak wysokości z NMT (spadek nieoznaczony).");
    const spadek = spadekPct(wys, cfg.offsetM);
    if (spadek === null) return brakWyniku(this.klucz, this.zrodlo, czas, "Niepełne próbki wysokości.");
    const dane: Partial<DaneDzialki> = { sredniSpadekPct: spadek };
    const meta: MetaPola[] = [{ pole: "sredniSpadekPct", zrodlo: this.zrodlo, czas, pewnosc: 65, status: "ok", tryb: "A" }];
    return { klucz: this.klucz, zrodlo: this.zrodlo, status: "ok", czas, dane, meta };
  },
};
