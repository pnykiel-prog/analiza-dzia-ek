/**
 * Poziom 1 — REWIZJA (deterministyczny, wąski zakres).
 * Zgodny z „wytyczne_claude_code_poziom1_rewizja.md".
 *
 * P1 ocenia wyłącznie trzy rzeczy:
 *  1. Lokalizacja i rozmiar działki (auto z ULDK → powierzchnia).
 *  2. Co można zbudować — z RĘCZNIE wprowadzonej podstawy planistycznej (MPZP/WZ/PnB).
 *  3. Popyt — demografia + rynek (bez mnożnika usług; usługi = Poziom 2).
 *
 * Wynik = dopasowanie POJEMNOŚCI zabudowy do POPYTU, osobno dla profilu młodych
 * i senioralnego. Środowisko/uzbrojenie/dostępność/geotechnika → Poziom 2.
 *
 * Determinizm: brak auto-pobierania źródeł spoza zakresu, brak przeliczeń w pętli;
 * podstawa planistyczna pochodzi od użytkownika (eliminuje pętle z parsowania planów).
 */

import type {
  DaneDzialki,
  DopasowanieProfil,
  PodstawaPlanistyczna,
  PodstawaTyp,
  PojemnoscP1,
  Profil,
  ProfilRekomendowany,
  Werdykt,
  WynikPoziom1,
  WynikPopytu,
} from "../types";
import type { KonfiguracjaPoziom1, KonfiguracjaScoring } from "../config";
import { KONFIG_POPYT, KONFIG_POZIOM1, KONFIG_SCORING } from "../config";
import { ocenPopyt } from "./popyt";
import { clamp, liniowo } from "./utils";
import { statusZeSymbolu } from "../mpzp";

// ── Podstawa planistyczna (z danych) ─────────────────────────────────────────

function ustalPodstawe(d: DaneDzialki): PodstawaPlanistyczna {
  if (d.podstawa) return d.podstawa;
  // Wsteczna kompatybilność: wyprowadź z pól planistycznych.
  const typ: PodstawaTyp =
    d.statusPlanistyczny === "brak_danych" ? "BRAK" : d.statusPlanistyczny === "ouz" || d.statusPlanistyczny === "plan_ogolny_sprzyjajacy" ? "WZ" : "MPZP";
  return { typ, zrodlo: "ręczne" };
}

/** Czy podstawa dopuszcza zabudowę mieszkaniową (wielorodzinną istotną dla SIM). */
function funkcjaDozwolona(d: DaneDzialki, podstawa: PodstawaPlanistyczna, cfg: KonfiguracjaPoziom1): boolean | null {
  if (podstawa.symbol) return !statusZeSymbolu(podstawa.symbol).sprzeczne;
  if (podstawa.typ === "BRAK") return null; // nieoznaczona — nie blokujemy
  if (d.statusPlanistyczny === "sprzeczny") return false;
  if (d.statusPlanistyczny === "brak_danych") return null;
  return true; // mpzp_mieszkaniowy / plan_ogolny / ouz
}

// ── Pojemność zabudowy (z powierzchni + ręcznych wskaźników) ──────────────────

function liczPojemnosc(d: DaneDzialki, cfg: KonfiguracjaPoziom1): PojemnoscP1 {
  const w = d.wskaznikiPlanistyczne;
  if (!w || d.powierzchniaM2 <= 0) {
    return { maxPowZabudowyM2: null, powCalkowitaM2: null, pumM2: null, szacLiczbaMieszkanMlodzi: null, szacLiczbaMieszkanSeniorzy: null };
  }
  // PBC ogranicza powierzchnię zabudowy: zabudowa ≤ (100 − PBC)% działki.
  const maxZabPct = Math.min(w.maxPowZabudowyPct, 100 - w.minPbcPct);
  const maxPowZabudowyM2 = (d.powierzchniaM2 * maxZabPct) / 100;
  const powCalkowitaM2 = w.intensywnosc > 0 ? d.powierzchniaM2 * w.intensywnosc : maxPowZabudowyM2 * w.maxKondygnacje;
  const pumM2 = powCalkowitaM2 * cfg.wspolczynnikEfektywnosci;
  return {
    maxPowZabudowyM2: Math.round(maxPowZabudowyM2),
    powCalkowitaM2: Math.round(powCalkowitaM2),
    pumM2: Math.round(pumM2),
    szacLiczbaMieszkanMlodzi: Math.floor(pumM2 / cfg.metrazSredniM2.mlodzi),
    szacLiczbaMieszkanSeniorzy: Math.floor(pumM2 / cfg.metrazSredniM2.seniorzy),
  };
}

// ── Dopasowanie pojemność ↔ popyt → werdykt ──────────────────────────────────

function pasmoWerdyktu(score: number, cfg: KonfiguracjaPoziom1): Werdykt {
  if (score >= cfg.pasma.zielony) return "zielony";
  if (score >= cfg.pasma.zolty) return "zolty";
  return "czerwony";
}

function dopasuj(
  profil: Profil,
  popyt: WynikPopytu,
  pojemnoscMieszkan: number | null,
  funkcjaOk: boolean | null,
  cfg: KonfiguracjaPoziom1
): DopasowanieProfil {
  const popytPkt = popyt.realizowalny;
  if (funkcjaOk === false)
    return { profil, popyt: popytPkt, pojemnoscMieszkan, score: 0, werdykt: "czerwony", komentarz: "Funkcja mieszkaniowa niedozwolona wg podstawy planistycznej." };

  if (pojemnoscMieszkan === null)
    return {
      profil,
      popyt: popytPkt,
      pojemnoscMieszkan,
      score: popytPkt,
      werdykt: pasmoWerdyktu(popytPkt, cfg),
      komentarz: "Brak podstawy planistycznej — pojemność nieoznaczona; ocena z samego popytu.",
    };

  const modPoj = pojemnoscMieszkan >= cfg.progMieszkanViable ? 1 : liniowo(pojemnoscMieszkan, 0, cfg.progMieszkanViable, 0.5, 1);
  const score = clamp(Math.round(popytPkt * modPoj));
  const duzyPopyt = popytPkt >= cfg.pasma.zielony;
  const malaPojemnosc = pojemnoscMieszkan < cfg.progMieszkanViable;
  const komentarz = duzyPopyt
    ? malaPojemnosc
      ? `Duży popyt, ograniczona pojemność (${pojemnoscMieszkan} mieszk.) — realny, lecz niewielki wkład.`
      : `Popyt i pojemność (${pojemnoscMieszkan} mieszk.) zgodne — mocne dopasowanie.`
    : popytPkt < cfg.pasma.zolty
      ? "Słaby popyt — inwestycja mało uzasadniona niezależnie od pojemności."
      : `Umiarkowany popyt przy pojemności ${pojemnoscMieszkan} mieszk.`;
  return { profil, popyt: popytPkt, pojemnoscMieszkan, score, werdykt: pasmoWerdyktu(score, cfg), komentarz };
}

function profilRekomendowany(scoreM: number, scoreS: number, cfg: KonfiguracjaPoziom1): ProfilRekomendowany {
  if (scoreM < cfg.pasma.zolty && scoreS < cfg.pasma.zolty) return "zaden";
  if (scoreM >= cfg.pasma.zielony && scoreS >= cfg.pasma.zielony && Math.abs(scoreM - scoreS) <= 10) return "oba";
  return scoreM >= scoreS ? "mlodzi" : "seniorzy";
}

// ── Wejście silnika P1 ───────────────────────────────────────────────────────

export function uruchomPoziom1(
  d: DaneDzialki,
  _cfgScoring: KonfiguracjaScoring = KONFIG_SCORING,
  cfg: KonfiguracjaPoziom1 = KONFIG_POZIOM1
): WynikPoziom1 {
  const podstawa = ustalPodstawe(d);
  const funkcjaOk = funkcjaDozwolona(d, podstawa, cfg);
  const pojemnosc = liczPojemnosc(d, cfg);

  // Popyt: demografia + rynek, BEZ mnożnika usług (usługi = Poziom 2).
  const popytM = ocenPopyt(d, "mlodzi", KONFIG_SCORING, KONFIG_POPYT, true);
  const popytS = ocenPopyt(d, "seniorzy", KONFIG_SCORING, KONFIG_POPYT, true);

  const dopMlodzi = dopasuj("mlodzi", popytM, pojemnosc.szacLiczbaMieszkanMlodzi, funkcjaOk, cfg);
  const dopSeniorzy = dopasuj("seniorzy", popytS, pojemnosc.szacLiczbaMieszkanSeniorzy, funkcjaOk, cfg);

  const scoreMlodzi = dopMlodzi.score;
  const scoreSeniorzy = dopSeniorzy.score;
  const profil = funkcjaOk === false ? "zaden" : profilRekomendowany(scoreMlodzi, scoreSeniorzy, cfg);
  const werdykt = funkcjaOk === false ? "czerwony" : profil === "seniorzy" ? dopSeniorzy.werdykt : dopMlodzi.werdykt;

  const tryb: "pelny" | "ograniczony" = pojemnosc.pumM2 === null ? "ograniczony" : "pelny";

  const flagi: string[] = [];
  if (funkcjaOk === false)
    flagi.push("Funkcja mieszkaniowa niedozwolona wg podstawy planistycznej — działka nieprzydatna.");
  if (tryb === "ograniczony")
    flagi.push("Brak podstawy planistycznej — pojemność nieoznaczona (tryb ograniczony). Uzupełnij MPZP/WZ/PnB.");
  const flagiPopytu = profil === "seniorzy" ? popytS.flagi : profil === "oba" ? [...popytM.flagi, ...popytS.flagi] : popytM.flagi;
  for (const f of flagiPopytu) if (!flagi.includes(f)) flagi.push(f);

  let pewnosc = Math.round((popytM.pewnosc + popytS.pewnosc) / 2);
  if (tryb === "ograniczony") pewnosc = Math.round(pewnosc * 0.85);

  return {
    dzialkaId: d.id,
    powierzchniaM2: d.powierzchniaM2,
    podstawa,
    funkcjaMieszkaniowaDozwolona: funkcjaOk !== false,
    pojemnosc,
    popyt: { mlodzi: popytM, seniorzy: popytS },
    dopasowanie: { mlodzi: dopMlodzi, seniorzy: dopSeniorzy },
    scoreMlodzi,
    scoreSeniorzy,
    profilRekomendowany: profil,
    werdyktMlodzi: dopMlodzi.werdykt,
    werdyktSeniorzy: dopSeniorzy.werdykt,
    werdykt,
    pewnosc: clamp(pewnosc),
    tryb,
    flagi,
  };
}
