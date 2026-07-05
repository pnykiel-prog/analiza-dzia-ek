/**
 * DataService — orkiestracja pozyskania danych działki.
 *
 * Punktem startowym jest identyfikator działki (lub punkt na mapie). Od niego
 * "rozwijają się" wszystkie zapytania przestrzenne. Service:
 *  1. pobiera dane z dostępnych źródeł (tu: provider przykładowy),
 *  2. wykrywa "białe plamy" (pola `null`) i raportuje pokrycie danych,
 *  3. nie zamienia braków na werdykt — to robi dopiero silnik (median fallback).
 */

import type { DaneDzialki } from "../types";
import { DZIALKI_PRZYKLADOWE } from "./sample";

export interface RaportPokrycia {
  polaWypelnione: number;
  polaPuste: number;
  pokryciePct: number;
  bialePlamy: string[]; // nazwy pól bez danych
}

/** Pola, których brak liczymy jako "białą plamę" wpływającą na pewność. */
const POLA_DANYCH: (keyof DaneDzialki)[] = [
  "statusPlanistyczny",
  "wskaznikiPlanistyczne",
  "zabudowaMieszkaniowaWSasiedztwie",
  "dostepDrogaPubliczna",
  "sredniSpadekPct",
  "ryzykoPowodzioweSzczegolne",
  "odlegloscDoSieciM",
  "odlegloscDoZabudowyM",
  "czasDojazdAglomeracjaMin",
  "uslugiPodstawowePieszo",
  "pozWZasiegu",
  "zlobkiSzkolyWZasiegu",
  "udzial2039Pct",
  "saldoMigracjiMlodzi",
  "udzial65PlusPct",
  "trendLudnosc",
  "bezrobociePct",
  "natura2000",
  "wartoscOdtworzeniowaM2",
  "czynszRynkowyM2",
  "cenaNowychM2",
  "pustostanyPct",
];

function jestPuste(v: unknown): boolean {
  return v === null || v === undefined;
}

export function raportPokrycia(dane: DaneDzialki): RaportPokrycia {
  const bialePlamy: string[] = [];
  for (const pole of POLA_DANYCH) {
    if (jestPuste(dane[pole])) bialePlamy.push(pole);
  }
  const wypelnione = POLA_DANYCH.length - bialePlamy.length;
  return {
    polaWypelnione: wypelnione,
    polaPuste: bialePlamy.length,
    pokryciePct: Math.round((wypelnione / POLA_DANYCH.length) * 100),
    bialePlamy,
  };
}

/**
 * Pobiera dane działki po identyfikatorze.
 * Provider przykładowy; realna implementacja iterowałaby po adapterach
 * (ULDK → EGiB → GUS → OSM …) i scalała wyniki, tolerując niedostępne źródła.
 */
export async function pobierzDaneDzialki(id: string): Promise<DaneDzialki | null> {
  const dane = DZIALKI_PRZYKLADOWE.find((d) => d.id === id);
  return dane ?? null;
}

export function wszystkieDzialki(): DaneDzialki[] {
  return DZIALKI_PRZYKLADOWE;
}
