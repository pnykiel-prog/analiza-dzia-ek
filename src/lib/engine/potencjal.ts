/**
 * Prognoza orientacyjnego potencjału zabudowy (port `potential.py`).
 * ===================================================================
 * Zastępuje ręczne wprowadzanie wskaźników MPZP/WZ/PnB na Poziomie 1. Zamiast
 * pytać użytkownika „co dopuszcza plan", szacuje „ile orientacyjnie da się
 * zbudować" z:
 *   1) KSZTAŁTU działki (powierzchnia, zwartość, szerokość zabudowalna),
 *   2) ZABUDOWY SĄSIEDZTWA (pokrycie, typowa liczba kondygnacji) — odwzorowanie
 *      zasady „dobrego sąsiedztwa" z WZ,
 *   3) SPADKU terenu (NMT).
 *
 * WAŻNE: wynik to „orientacyjny potencjał zabudowy", a NIE „co dopuszcza plan".
 * Gdy dla działki istnieje MPZP, dokładamy adnotację „do potwierdzenia w planie".
 *
 * Determinizm (spec §3): brak auto-pobierania w pętli — sygnał z sąsiedztwa jest
 * deterministyczny (seed z identyfikatora działki), z zostawionym szwem na LIVE
 * (BDOT budynki + NMT spadek). Funkcje są czyste i testowalne offline.
 */

import type { PrognozaPotencjalu, Profil, SasiedztwoDane } from "../types";
import type { KonfiguracjaPotencjal } from "../config";
import { KONFIG_POZIOM1 } from "../config";

// ── Metryki kształtu → efektywność zabudowy ──────────────────────────────────

/**
 * Efektywność kształtu 0.5..1.0 — jak dobrze działka nadaje się pod efektywną
 * zabudowę. Gdy brak geometrii (zwartość/szerokość nieznane) → wartość neutralna.
 */
export function efektywnoscKsztaltu(
  zwartosc: number | null | undefined,
  minSzerokoscM: number | null | undefined,
  cfg: KonfiguracjaPotencjal
): { eff: number; flagi: string[] } {
  const flagi: string[] = [];
  if (zwartosc == null && minSzerokoscM == null) {
    // Brak geometrii (np. powierzchnia podana ręcznie) — kształt nieoceniony.
    return { eff: cfg.efektywnoscNeutralna, flagi };
  }
  const comp = zwartosc ?? cfg.zwartoscNeutralna;
  let eff = 0.6 + 0.4 * comp; // zwartość: 0.6..1.0
  if (minSzerokoscM != null && minSzerokoscM < cfg.minSzerokoscWielorodzinnaM) {
    eff *= 0.7; // wąska działka — trudna zabudowa wielorodzinna
    flagi.push(`wąska działka (~${Math.round(minSzerokoscM)} m) — ograniczona zabudowa wielorodzinna`);
  }
  if (comp < 0.4) flagi.push("nieregularny/wydłużony kształt — niższa efektywność zabudowy");
  return { eff: Math.max(0.5, Math.min(1.0, eff)), flagi };
}

/** Mnożnik potencjału ze względu na spadek terenu [%]. */
export function mnoznikSpadku(spadekPct: number): { mult: number; flagi: string[] } {
  if (spadekPct < 3) return { mult: 1.0, flagi: [] };
  if (spadekPct < 8) return { mult: 0.9, flagi: [] };
  if (spadekPct < 12) return { mult: 0.7, flagi: ["znaczny spadek terenu — wyższy koszt/ograniczenia"] };
  return { mult: 0.5, flagi: ["duży spadek terenu — istotne ograniczenia zabudowy"] };
}

// ── Sygnał z sąsiedztwa ──────────────────────────────────────────────────────

/** Deterministyczny hash (FNV-1a 32-bit) — powtarzalny seed dla trybu offline. */
function hash32(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/**
 * TRYB DETERMINISTYCZNY (offline/test): sąsiedztwo wyprowadzone z seeda działki.
 * LIVE: zastąp funkcją czytającą BDOT (budynki w buforze) + NMT (spadek):
 *   - pokrycieUdzial = suma obrysów budynków / powierzchnia bufora
 *   - typoweKondygnacje = mediana kondygnacji (BDOT); wysokosciDostepne wg danych
 *   - spadekPct = średni spadek z NMT na terenie działki
 * `spadekRealny` (z NMT) nadpisuje spadek deterministyczny, gdy dostępny.
 */
export function sasiedztwoDeterministyczne(seed: string, spadekRealny?: number | null): SasiedztwoDane {
  const h = hash32(seed);
  const pokrycie = 0.15 + (h % 30) / 100; // 0.15..0.44
  const kondygnacje = 2 + (h % 6); // 2..7
  const spadekDet = (h >>> 8) % 15; // 0..14 %
  const wysokosci = h % 4 !== 0; // ~75% przypadków realne wysokości
  return {
    pokrycieUdzial: Math.round(pokrycie * 1000) / 1000,
    typoweKondygnacje: kondygnacje,
    liczbaProbki: 6 + (h % 20),
    wysokosciDostepne: wysokosci,
    spadekPct: spadekRealny != null ? spadekRealny : spadekDet,
    zrodlo: "deterministyczne",
  };
}

// ── Rdzeń: prognoza potencjału ───────────────────────────────────────────────

export function prognozaPotencjalu(args: {
  powierzchniaM2: number;
  zwartosc?: number | null;
  minSzerokoscM?: number | null;
  sasiedztwo: SasiedztwoDane;
  mpzp?: "jest" | "brak" | "nieznane";
  metrazSredniM2?: Record<Profil, number>;
  wspolczynnikEfektywnosci?: number;
  cfg?: KonfiguracjaPotencjal;
}): PrognozaPotencjalu {
  const cfg = args.cfg ?? KONFIG_POZIOM1.potencjal;
  const metraz = args.metrazSredniM2 ?? KONFIG_POZIOM1.metrazSredniM2;
  const pumEff = args.wspolczynnikEfektywnosci ?? KONFIG_POZIOM1.wspolczynnikEfektywnosci;
  const mpzp = args.mpzp ?? "nieznane";
  const nb = args.sasiedztwo;
  const area = Math.max(0, args.powierzchniaM2);

  const { eff: shapeEff, flagi: flagiKsztalt } = efektywnoscKsztaltu(args.zwartosc, args.minSzerokoscM, cfg);
  const { mult: slopeMult, flagi: flagiSpadek } = mnoznikSpadku(nb.spadekPct);

  const pokrycie = Math.min(nb.pokrycieUdzial, cfg.gornyLimitPokrycia);
  const kondygnacje = nb.wysokosciDostepne ? nb.typoweKondygnacje : cfg.kondygnacjeFallback;

  const powZabudowy = area * pokrycie * shapeEff * slopeMult;
  const powCalkowita = powZabudowy * kondygnacje;
  const pum = powCalkowita * pumEff;
  const mieszkania = {
    mlodzi: Math.floor(pum / metraz.mlodzi),
    seniorzy: Math.floor(pum / metraz.seniorzy),
  };

  // Pewność: obniżana przez fallbacki, małą próbę, kształt, spadek, obecność MPZP.
  let pewnosc = 100;
  const flagi: string[] = [];
  if (!nb.wysokosciDostepne) {
    pewnosc -= 20;
    flagi.push("brak realnych wysokości w sąsiedztwie — kondygnacje szacowane");
  }
  if (nb.liczbaProbki < 5) {
    pewnosc -= 20;
    flagi.push(`mała próba zabudowy w otoczeniu (${nb.liczbaProbki})`);
  }
  if (args.zwartosc == null && args.minSzerokoscM == null) {
    pewnosc -= 15;
    flagi.push("brak geometrii działki — kształt nieoceniony (przyjęto wartość neutralną)");
  }
  flagi.push(...flagiKsztalt, ...flagiSpadek);
  if (flagiKsztalt.length) pewnosc -= 10;
  if (flagiSpadek.length) pewnosc -= 10;
  if (mpzp === "jest") {
    pewnosc -= 15;
    flagi.push("obowiązuje MPZP — potencjał do potwierdzenia w planie (Poziom 2)");
  }
  pewnosc = Math.max(0, Math.min(100, pewnosc));

  return {
    etykieta: "orientacyjny potencjał zabudowy",
    powierzchniaDzialkiM2: Math.round(area * 10) / 10,
    szacowanePokrycie: Math.round(pokrycie * 1000) / 1000,
    szacowaneKondygnacje: Math.round(kondygnacje * 10) / 10,
    powierzchniaZabudowyM2: Math.round(powZabudowy),
    pumM2: Math.round(pum),
    mieszkania,
    pewnosc,
    flagi,
    flagaMpzp: mpzp,
    sasiedztwo: nb,
  };
}
