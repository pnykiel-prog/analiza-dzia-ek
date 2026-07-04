/**
 * Bliskość aglomeracji (kanał C) — sygnał ze STATYCZNEJ listy miast z klasami A–D
 * i pierścieniami skalowanymi wielkością miasta. Deterministyczne, w pełni lokalne
 * (bez API na żywo, bez routingu, bez pętli) — wg wytycznych „bliskość aglomeracji".
 *
 * „10 km od aglomeracji A" daje mocniejszy sygnał niż „10 km od miasta D" (płaska
 * odległość tego nie łapie). Sygnał → modyfikator popytu per profil (młodzi mocniej).
 *
 * Funkcje czyste (testowane offline).
 */

import type { BliskoscAglomeracji, KlasaMiasta, MiastoWPoblizu } from "../types";
import type { KonfiguracjaAglomeracji } from "../config";
import { KONFIG_AGLOMERACJA } from "../config";
import { haversineM } from "../data/connectors/geoUslugi";
import miastaJson from "../data/miasta.json";

export interface Miasto {
  nazwa: string;
  lat: number;
  lon: number;
  klasa: KlasaMiasta;
}

export const MIASTA: Miasto[] = ((miastaJson as { miasta?: Miasto[] }).miasta ?? []).filter(
  (m) => typeof m.lat === "number" && typeof m.lon === "number" && ["A", "B", "C", "D"].includes(m.klasa)
);

const clamp = (v: number, lo = 0, hi = 100) => Math.max(lo, Math.min(hi, v));

/** Siła oddziaływania miasta klasy K na dystansie d [km] + numer pierścienia. */
export function silaMiasta(klasa: KlasaMiasta, distKm: number, cfg: KonfiguracjaAglomeracji = KONFIG_AGLOMERACJA): { sila: number; pierscien: number } {
  const p = cfg.pierscienie[klasa];
  if (distKm <= p.rdzenKm) return { sila: p.silaBazowa, pierscien: 0 };
  if (distKm > p.zasiegKm) return { sila: 0, pierscien: -1 };
  const sila = p.silaBazowa * ((p.zasiegKm - distKm) / (p.zasiegKm - p.rdzenKm));
  const pierscien = Math.floor((distKm - p.rdzenKm) / p.krokKm) + 1;
  return { sila: Math.round(sila * 10) / 10, pierscien };
}

/** Modyfikator popytu per profil z sygnału (50 = neutralny 1,0). */
export function modyfikatorZSygnalu(sygnal: number, cfg: KonfiguracjaAglomeracji = KONFIG_AGLOMERACJA): { mlodzi: number; seniorzy: number } {
  const mod = (amp: number) => Math.round((1 + (sygnal / 100 - 0.5) * amp) * 1000) / 1000;
  return { mlodzi: mod(cfg.amplitudaProfil.mlodzi), seniorzy: mod(cfg.amplitudaProfil.seniorzy) };
}

/**
 * Bliskość aglomeracji dla punktu (lat, lon): sygnał (max siła + bonus za drugi ośrodek),
 * lista ośrodków w pobliżu (siła > 0) oraz modyfikator per profil.
 */
export function bliskoscAglomeracji(
  lat: number,
  lon: number,
  cfg: KonfiguracjaAglomeracji = KONFIG_AGLOMERACJA,
  miasta: Miasto[] = MIASTA
): BliskoscAglomeracji {
  const wPoblizu: MiastoWPoblizu[] = [];
  for (const m of miasta) {
    const distKm = haversineM(lat, lon, m.lat, m.lon) / 1000;
    const { sila, pierscien } = silaMiasta(m.klasa, distKm, cfg);
    if (sila > 0) {
      wPoblizu.push({ nazwa: m.nazwa, klasa: m.klasa, odlegloscKm: Math.round(distKm), pierscien, sila });
    }
  }
  wPoblizu.sort((a, b) => b.sila - a.sila);
  const glowny = wPoblizu[0]?.sila ?? 0;
  const drugi = wPoblizu[1]?.sila ?? 0;
  const sygnal = clamp(Math.round((glowny + cfg.bonusDrugiOsrodek * drugi) * 10) / 10);
  return { sygnal, miastaWPoblizu: wPoblizu, modyfikator: modyfikatorZSygnalu(sygnal, cfg) };
}
