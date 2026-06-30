/**
 * Wzorzec konektora (wytyczne integracji, sekcja 1).
 *
 * Jeden moduł na źródło, wspólny interfejs `fetch(teren) → wynik`. Awaria jednego
 * konektora nie wywraca raportu (runner łapie błędy). Każda dana niesie metadane:
 * źródło, czas, pewność, status — niezbędne do wskaźnika pewności i śladu audytu.
 */

import type { DaneDzialki } from "../../types";
import type { Tryb } from "../../fieldModes";

export type StatusKonektora = "ok" | "brak" | "blad";

/** „Teren inwestycji" — wejście wspólne dla konektorów (po geokodowaniu ULDK). */
export interface Teren {
  id: string;
  teryt: string; // TERYT gminy
  wojewodztwo: string;
  powiat: string;
  gmina: string;
  centroid2180: [number, number] | null; // do zapytań WMS GetFeatureInfo
  wktList: string[]; // geometrie składowych działek (EPSG:2180)
  powierzchniaM2: number;
}

/** Metadana pojedynczego pola wypełnionego automatycznie. */
export interface MetaPola {
  pole: keyof DaneDzialki;
  zrodlo: string;
  czas: string; // ISO
  pewnosc: number; // 0–100
  status: StatusKonektora;
  tryb: Tryb;
}

export interface WynikKonektora {
  klucz: string;
  zrodlo: string;
  status: StatusKonektora;
  czas: string;
  /** Pola DaneDzialki wypełnione przez ten konektor (tylko niepuste). */
  dane: Partial<DaneDzialki>;
  meta: MetaPola[];
  /** Komunikat diagnostyczny / surowa odpowiedź (tryb debug). */
  debug?: string;
}

export interface Konektor {
  klucz: string;
  zrodlo: string;
  poziom: "P1" | "P2";
  /** Czy konektor jest aktywny (z konfiguracji). */
  aktywny: boolean;
  pobierz(teren: Teren): Promise<WynikKonektora>;
}

/** Pomocnik: pusty wynik „brak danych" (biała plama, nie błąd). */
export function brakWyniku(klucz: string, zrodlo: string, czas: string, debug?: string): WynikKonektora {
  return { klucz, zrodlo, status: "brak", czas, dane: {}, meta: [], debug };
}
