/** Narzędzia wspólne silników: interpolacja, progi, formatowanie. */

import type { Maybe } from "../types";

export function clamp(x: number, min = 0, max = 100): number {
  return Math.min(max, Math.max(min, x));
}

/** Punktacja progowa malejąca: zwraca pkt dla pierwszego progu, który `x` spełnia. */
export function progi(
  x: number,
  reguly: { max: number; pkt: number }[],
  ponizej: number
): number {
  for (const r of reguly) {
    if (x <= r.max) return r.pkt;
  }
  return ponizej;
}

/** Liniowa interpolacja x z [x0,x1] na [y0,y1] z obcięciem do przedziału. */
export function liniowo(x: number, x0: number, x1: number, y0: number, y1: number): number {
  if (x1 === x0) return y0;
  const t = (x - x0) / (x1 - x0);
  return clamp(y0 + t * (y1 - y0), Math.min(y0, y1), Math.max(y0, y1));
}

/** Średnia ważona; ignoruje pozycje o wadze 0. */
export function sredniaWazona(pozycje: { punkty: number; waga: number }[]): number {
  const sumaWag = pozycje.reduce((s, p) => s + p.waga, 0);
  if (sumaWag === 0) return 0;
  return pozycje.reduce((s, p) => s + p.punkty * p.waga, 0) / sumaWag;
}

export function fmt(v: Maybe<number>, sufiks = "", miejsca = 0): string {
  if (v === null || v === undefined || Number.isNaN(v)) return "brak danych";
  return `${v.toFixed(miejsca)}${sufiks}`;
}

/** Annuita roczna: rata kredytu (kwota, oprocentowanie roczne, okres w latach). */
export function annuita(kwota: number, oprocentowanie: number, lata: number): number {
  if (kwota <= 0) return 0;
  if (oprocentowanie <= 0) return kwota / lata;
  const r = oprocentowanie;
  return (kwota * r) / (1 - Math.pow(1 + r, -lata));
}

/** Indeksacja wartości o roczny CAGR przez `lata` lat. */
export function indeksuj(wartosc: number, cagrRoczny: number, lata: number): number {
  return wartosc * Math.pow(1 + cagrRoczny, lata);
}
