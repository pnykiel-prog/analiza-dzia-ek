/**
 * Poziom 1 — REWIZJA (deterministyczny, wąski zakres).
 *
 * P1 ocenia wyłącznie trzy rzeczy:
 *  1. Lokalizacja i rozmiar działki (auto z ULDK → powierzchnia, kształt).
 *  2. Co można zbudować — PROGNOZA orientacyjnego potencjału zabudowy z kształtu
 *     działki + zabudowy sąsiedztwa + spadku terenu (zamiast ręcznych wskaźników
 *     MPZP/WZ/PnB). MPZP jest opcjonalną adnotacją „do potwierdzenia w planie".
 *  3. Popyt — demografia + rynek (bez mnożnika usług; usługi = Poziom 2).
 *
 * Wynik = dopasowanie POJEMNOŚCI (z prognozy) do POPYTU, osobno dla profilu
 * młodych i senioralnego. Środowisko/uzbrojenie/dostępność/geotechnika → Poziom 2.
 *
 * Determinizm: brak auto-pobierania źródeł w pętli; sygnał z sąsiedztwa jest
 * deterministyczny (seed z identyfikatora działki).
 */

import type {
  DaneDzialki,
  DopasowanieProfil,
  PodstawaPlanistyczna,
  PojemnoscP1,
  PrognozaPotencjalu,
  Profil,
  ProfilRekomendowany,
  Werdykt,
  WynikPoziom1,
  WynikPopytu,
} from "../types";
import type { KonfiguracjaPoziom1, KonfiguracjaScoring } from "../config";
import { KONFIG_POPYT, KONFIG_POZIOM1, KONFIG_SCORING } from "../config";
import { ocenPopyt } from "./popyt";
import { prognozaPotencjalu, sasiedztwoDeterministyczne } from "./potencjal";
import { clamp, liniowo } from "./utils";
import { statusZeSymbolu } from "../mpzp";

// ── Podstawa planistyczna ────────────────────────────────────────────────────

function ustalPodstawe(d: DaneDzialki): PodstawaPlanistyczna {
  if (d.podstawa) return d.podstawa;
  // Domyślnie: prognoza potencjału (bez ręcznych wskaźników).
  return { typ: "PROGNOZA", zrodlo: "prognoza" };
}

/** Deklarowana/wykryta obecność MPZP — do adnotacji „do potwierdzenia w planie". */
function obecnoscMpzp(d: DaneDzialki, podstawa: PodstawaPlanistyczna): "jest" | "brak" | "nieznane" {
  if (podstawa.typ === "MPZP") return "jest";
  if (d.mpzpObecnosc) return d.mpzpObecnosc;
  if (podstawa.typ === "BRAK") return "brak";
  if (d.statusPlanistyczny === "brak_danych") return "nieznane";
  return "nieznane";
}

/**
 * Czy funkcja mieszkaniowa jest dopuszczalna. Prognoza nie blokuje zabudowy —
 * blokujemy tylko, gdy wprost wskazano sprzeczne przeznaczenie (symbol MPZP
 * niemieszkaniowy lub jawnie sprzeczny status planistyczny).
 */
function funkcjaDozwolona(d: DaneDzialki, podstawa: PodstawaPlanistyczna): boolean | null {
  if (podstawa.symbol) return !statusZeSymbolu(podstawa.symbol).sprzeczne;
  if (d.statusPlanistyczny === "sprzeczny") return false;
  return null; // prognoza / brak deklaracji — nie blokujemy
}

// ── Pojemność zabudowy z prognozy potencjału ──────────────────────────────────

function liczPrognoze(d: DaneDzialki, mpzp: "jest" | "brak" | "nieznane", cfg: KonfiguracjaPoziom1): PrognozaPotencjalu {
  const sasiedztwo = sasiedztwoDeterministyczne(d.id || `${d.teryt}-${d.powierzchniaM2}`, d.sredniSpadekPct);
  return prognozaPotencjalu({
    powierzchniaM2: d.powierzchniaM2,
    zwartosc: d.zwartoscKsztaltu ?? null,
    minSzerokoscM: d.minSzerokoscM ?? d.frontM ?? null,
    sasiedztwo,
    mpzp,
    metrazSredniM2: cfg.metrazSredniM2,
    wspolczynnikEfektywnosci: cfg.wspolczynnikEfektywnosci,
    cfg: cfg.potencjal,
  });
}

/** Mapuje prognozę na strukturę PojemnoscP1 (zgodność z resztą aplikacji). */
function pojemnoscZPrognozy(p: PrognozaPotencjalu): PojemnoscP1 {
  const powCalkowitaM2 = Math.round(p.powierzchniaZabudowyM2 * p.szacowaneKondygnacje);
  return {
    maxPowZabudowyM2: p.powierzchniaZabudowyM2,
    powCalkowitaM2,
    pumM2: p.pumM2,
    szacLiczbaMieszkanMlodzi: p.mieszkania.mlodzi,
    szacLiczbaMieszkanSeniorzy: p.mieszkania.seniorzy,
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
  const funkcjaOk = funkcjaDozwolona(d, podstawa);
  const mpzp = obecnoscMpzp(d, podstawa);

  // Pojemność: PROGNOZA orientacyjnego potencjału (kształt + sąsiedztwo + spadek).
  const prognoza = liczPrognoze(d, mpzp, cfg);
  const pojemnosc = pojemnoscZPrognozy(prognoza);

  // Popyt: demografia + rynek, BEZ mnożnika usług (usługi = Poziom 2).
  const popytM = ocenPopyt(d, "mlodzi", KONFIG_SCORING, KONFIG_POPYT, true);
  const popytS = ocenPopyt(d, "seniorzy", KONFIG_SCORING, KONFIG_POPYT, true);

  const dopMlodzi = dopasuj("mlodzi", popytM, pojemnosc.szacLiczbaMieszkanMlodzi, funkcjaOk, cfg);
  const dopSeniorzy = dopasuj("seniorzy", popytS, pojemnosc.szacLiczbaMieszkanSeniorzy, funkcjaOk, cfg);

  const scoreMlodzi = dopMlodzi.score;
  const scoreSeniorzy = dopSeniorzy.score;
  const profil = funkcjaOk === false ? "zaden" : profilRekomendowany(scoreMlodzi, scoreSeniorzy, cfg);
  const werdykt = funkcjaOk === false ? "czerwony" : profil === "seniorzy" ? dopSeniorzy.werdykt : dopMlodzi.werdykt;

  const tryb: "pelny" | "ograniczony" = pojemnosc.pumM2 === null || d.powierzchniaM2 <= 0 ? "ograniczony" : "pelny";

  const flagi: string[] = [];
  if (funkcjaOk === false)
    flagi.push("Funkcja mieszkaniowa niedozwolona wg wskazanego przeznaczenia — działka nieprzydatna.");
  // Zawsze zaznaczamy orientacyjny charakter prognozy (nie zastępuje ustaleń planu/decyzji).
  flagi.push("Pojemność to orientacyjna prognoza z kształtu działki i zabudowy sąsiedztwa — nie zastępuje ustaleń MPZP/WZ (potwierdzenie na Poziomie 2).");
  for (const f of prognoza.flagi) if (!flagi.includes(f)) flagi.push(f);
  const flagiPopytu = profil === "seniorzy" ? popytS.flagi : profil === "oba" ? [...popytM.flagi, ...popytS.flagi] : popytM.flagi;
  for (const f of flagiPopytu) if (!flagi.includes(f)) flagi.push(f);

  // Pewność P1 = średnia z pewności popytu i pewności prognozy potencjału.
  const pewnoscPopyt = Math.round((popytM.pewnosc + popytS.pewnosc) / 2);
  let pewnosc = Math.round((pewnoscPopyt + prognoza.pewnosc) / 2);
  if (tryb === "ograniczony") pewnosc = Math.round(pewnosc * 0.85);

  return {
    dzialkaId: d.id,
    powierzchniaM2: d.powierzchniaM2,
    podstawa,
    funkcjaMieszkaniowaDozwolona: funkcjaOk !== false,
    prognoza,
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
