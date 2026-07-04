/**
 * Kanały wpływu M2 (A–F) — domknięcie „wejście → kanał → wyjście" wg
 * `mapa_wejscia_wyjscia_M2.md`. Rozwiązuje błąd: wpisane dane (zwłaszcza
 * odległości) nie zmieniały wyniku, bo rekomendacja liczyła się ze starego popytu.
 *
 * Trzy rodzaje odległości działają RÓŻNYMI kanałami (to sedno błędu):
 *   A — dostępność usług/transportu pieszo → bramka obsługiwalności + mnożnik popytu,
 *   B — odległość do sieci → koszt uzbrojenia → przydatność ekonomiczna (skaluje, nie dyskwalifikuje),
 *   C — dojazd do aglomeracji / potencjał → modyfikator popytu (skaluje).
 * A i E potrafią zdyskwalifikować; B i C skalują; braki NIE dyskwalifikują (unknown ≠ far).
 *
 * Funkcje czyste (testowalne offline).
 */

import type { DaneDzialki, OcenaM2, Profil, StatusBramki, Werdykt, WerdyktProfiluM2, WynikPoziom1 } from "../types";
import type { KonfiguracjaM2, ProgUslugi } from "../config";
import { KONFIG_M2 } from "../config";
import { clamp, clamp01 } from "./utils";

const pasmo = (s: number): Werdykt => (s >= 65 ? "zielony" : s >= 40 ? "zolty" : "czerwony");

/** Etykieta usługi z konfiguracji (fallback do klucza). */
function etykietaUslugi(klucz: string, cfg: KonfiguracjaM2): string {
  return cfg.odleglosciPieszo.find((o) => o.klucz === klucz)?.etykieta ?? klucz;
}

/**
 * Kanał A — obsługiwalność per profil (spec §4): każda krytyczna usługa ma WŁASNE
 * progi (komfort, dyskwalifikacja). f_usługi = 1,0 (≤ komfort) → `minFaktorUslugi`
 * (liniowo do dyskwalifikacji); ≥ dyskwalifikacja = BRAMKA (weakest-link → mnożnik 0).
 * Braki NIE dyskwalifikują (unknown ≠ far) — schodzą tylko na pewność (F).
 */
export function dostepnoscA(d: DaneDzialki, profil: Profil, cfg: KonfiguracjaM2 = KONFIG_M2): { mnoznik: number; obsluzalny: boolean; powody: string[] } {
  const powody: string[] = [];
  const dyst = Object.entries(cfg.progiUslug)
    .map(([k, p]) => ({ k, prog: p[profil], m: d.odleglosciM2?.[k] }))
    .filter((x): x is { k: string; prog: ProgUslugi; m: number } => x.prog != null && x.m != null && x.m >= 0);
  if (dyst.length === 0) {
    return { mnoznik: 1, obsluzalny: true, powody: [] };
  }
  const g = cfg.minFaktorUslugi;
  let obsluzalny = true;
  const faktory = dyst.map(({ k, prog, m }) => {
    if (m >= prog.dyskwalifikacjaM) {
      obsluzalny = false;
      powody.push(`${etykietaUslugi(k, cfg)}: ${m} m ≥ próg ${prog.dyskwalifikacjaM} m — dyskwalifikuje profil ${profil === "seniorzy" ? "senioralny" : "dla młodych"}.`);
      return 0;
    }
    if (m <= prog.komfortM) return 1;
    return 1 - (1 - g) * ((m - prog.komfortM) / (prog.dyskwalifikacjaM - prog.komfortM)); // 1,0 → g liniowo
  });
  const mnoznik = obsluzalny ? faktory.reduce((a, b) => a + b, 0) / faktory.length : 0;
  return { mnoznik: Math.round(mnoznik * 100) / 100, obsluzalny, powody };
}

/** Kanał B — koszt uzbrojenia (odległość do sieci + spadek) → przydatność ekonomiczna 0–100. */
export function przydatnoscEkonomicznaB(d: DaneDzialki, cfg: KonfiguracjaM2 = KONFIG_M2): { wartosc: number; powody: string[] } {
  const powody: string[] = [];
  let s = 100;
  const dSieci = d.odlegloscDoSieciM;
  if (dSieci != null) {
    if (dSieci > cfg.kosztUzbrojenia.odlegloscDrogaM) {
      const kara = Math.min(45, Math.round((dSieci - cfg.kosztUzbrojenia.odlegloscDrogaM) / 20));
      s -= kara;
      powody.push(`Sieć ${dSieci} m — kosztowne przyłączenie (−${kara}).`);
    }
  } else {
    s -= 8; // brak danych: cicho niższa (F), nie dyskwalifikuje
  }
  const spadek = d.sredniSpadekPct ?? 0;
  if (spadek > cfg.kosztUzbrojenia.karaSpadekPct) {
    const kara = Math.min(25, Math.round((spadek - cfg.kosztUzbrojenia.karaSpadekPct) * 2));
    s -= kara;
    powody.push(`Spadek ${spadek}% — droższe posadowienie (−${kara}).`);
  }
  return { wartosc: clamp(Math.round(s)), powody };
}

/** Kanał C — modyfikator popytu per profil (aglomeracja, potencjał rozwoju, pustostany). */
export function modyfikatorPopytuC(d: DaneDzialki, profil: Profil, cfg: KonfiguracjaM2 = KONFIG_M2): { mnoznik: number; powody: string[] } {
  const powody: string[] = [];
  let m = 1;
  // Bliskość aglomeracji: model pierścieni (preferowany) — sygnał → modyfikator per profil.
  if (d.bliskoscAglomeracji) {
    const ba = d.bliskoscAglomeracji;
    m *= ba.modyfikator[profil];
    const czolo = ba.miastaWPoblizu[0];
    if (czolo) powody.push(`Bliskość aglomeracji: ${czolo.nazwa} ${czolo.odlegloscKm} km (${czolo.pierscien === 0 ? "rdzeń" : "pierścień " + czolo.pierscien}), sygnał ${ba.sygnal} → ×${ba.modyfikator[profil]}.`);
    else powody.push(`Poza zasięgiem dużych ośrodków (sygnał ${ba.sygnal}) — tłumi popyt${profil === "mlodzi" ? " młodych" : ""}.`);
  } else if (d.czasDojazdAglomeracjaMin != null) {
    // Fallback (gdy brak modelu): proxy czasu dojazdu.
    const dojazd = d.czasDojazdAglomeracjaMin;
    const t = clamp01((cfg.modyfikatorPopytu.dojazdMaxMin - dojazd) / (cfg.modyfikatorPopytu.dojazdMaxMin - cfg.modyfikatorPopytu.dojazdKomfortMin));
    const waga = cfg.modyfikatorPopytu.wagaAglomeracji[profil];
    m *= 1 - waga * (1 - t);
    if (dojazd > cfg.modyfikatorPopytu.dojazdMaxMin && profil === "mlodzi") powody.push(`Daleki dojazd do aglomeracji (${dojazd} min) — tłumi popyt młodych.`);
  }
  if (d.liczbaPodmiotowGosp != null) {
    if (d.liczbaPodmiotowGosp > 140) m *= 1.05;
    else if (d.liczbaPodmiotowGosp < 80) m *= 0.95;
  }
  if (d.trendLudnosc === "malejaca") {
    m *= 0.9;
    powody.push("Malejąca ludność — niższy potencjał rozwoju.");
  } else if (d.trendLudnosc === "rosnaca") {
    m *= 1.05;
  }
  if (d.pustostanyPct != null && d.pustostanyPct > 8) {
    m *= 0.9;
    powody.push(`Wysokie pustostany (${d.pustostanyPct}%) — tłumią popyt.`);
  }
  return { mnoznik: clamp(Math.round(m * 100), 40, 130) / 100, powody };
}

/**
 * Synteza M2 (sekcja 5): werdykt per profil na popycie realizowalnym (M1 × A × C) +
 * przydatności ekonomicznej (B) + bramkach (E); rekomendacja = najlepszy z dopuszczalnych
 * i obsługiwalnych profili, „brak" gdy żaden.
 */
export function ocenM2(d: DaneDzialki, p1: WynikPoziom1, dopuszczalnosc: StatusBramki, cfg: KonfiguracjaM2 = KONFIG_M2): OcenaM2 {
  const przydat = przydatnoscEkonomicznaB(d, cfg);
  const dopuszczalny = dopuszczalnosc !== "fail";

  const werdyktProfilu = (profil: Profil): WerdyktProfiluM2 => {
    const popytM1 = profil === "mlodzi" ? p1.scoreMlodzi : p1.scoreSeniorzy;
    const A = dostepnoscA(d, profil, cfg);
    const C = modyfikatorPopytuC(d, profil, cfg);
    const popytRealizowalny = clamp(Math.round(popytM1 * A.mnoznik * C.mnoznik));
    const ekonFaktor = 0.7 + 0.3 * (przydat.wartosc / 100); // B skaluje, nie zeruje
    let score = clamp(Math.round(popytRealizowalny * ekonFaktor));
    const powody = [...A.powody, ...C.powody, ...przydat.powody];
    if (!A.obsluzalny) {
      score = 0;
      powody.unshift("Profil nieobsługiwalny — usługi poza zasięgiem (kanał A).");
    }
    if (!dopuszczalny) {
      score = 0;
      powody.unshift("Bramka bezwzględna — działka niedopuszczalna (kanał E).");
    }
    return {
      profil,
      popytM1,
      dostepnoscA: A.mnoznik,
      modyfikatorC: C.mnoznik,
      popytRealizowalny,
      przydatnoscEkonomiczna: przydat.wartosc,
      score,
      werdykt: pasmo(score),
      obsluzalny: A.obsluzalny,
      dopuszczalny,
      powody,
    };
  };

  const werdykty: Record<Profil, WerdyktProfiluM2> = {
    mlodzi: werdyktProfilu("mlodzi"),
    seniorzy: werdyktProfilu("seniorzy"),
  };
  const kandydaci = (["mlodzi", "seniorzy"] as Profil[]).filter((p) => werdykty[p].obsluzalny && werdykty[p].dopuszczalny);
  let rekomendacja: Profil | "brak" = "brak";
  let powodBrak: string | undefined;
  if (kandydaci.length === 0) {
    powodBrak = !dopuszczalny
      ? "Bramka bezwzględna (środowisko/grunt/droga) — lokalizacja niedopuszczalna."
      : "Usługi poza zasięgiem dla obu profili (kanał A).";
  } else {
    rekomendacja = kandydaci.reduce((a, b) => (werdykty[b].score > werdykty[a].score ? b : a));
  }
  return { werdykty, dopuszczalnosc, rekomendacja, powodBrak };
}
