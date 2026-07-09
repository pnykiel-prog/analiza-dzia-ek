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
  OcenaPopytuP1,
  PodstawaPlanistyczna,
  PojemnoscP1,
  Profil,
  PrognozaPotencjalu,
  ProfilRekomendowany,
  WerdyktP1,
  WynikPoziom1,
  WynikPopytu,
} from "../types";
import type { KonfiguracjaPoziom1, KonfiguracjaScoring } from "../config";
import { KONFIG_POZIOM1, KONFIG_SCORING } from "../config";
import type { BramkaWielkosci, SasiedztwoDane } from "../types";
import { ocenPopytP1 } from "./popytP1";
import { prognozaPotencjalu, sasiedztwoDeterministyczne } from "./potencjal";
import { liczBramkeWielkosci } from "./bramkaWielkosci";
import { clamp } from "./utils";
import { statusZeSymbolu } from "../mpzp";

// ── Podstawa planistyczna ────────────────────────────────────────────────────

function ustalPodstawe(d: DaneDzialki): PodstawaPlanistyczna {
  // Jawna deklaracja MPZP użytkownika (z symbolem) ma pierwszeństwo.
  if (d.podstawa?.typ === "MPZP" && d.podstawa.symbol) return d.podstawa;
  // Auto z KIMPZP (gmina wektorowa) — gdy użytkownik nie podał własnego symbolu.
  const symKimpzp = d.mpzpMeta?.standard || d.mpzpMeta?.symbol;
  if (symKimpzp) return { typ: "MPZP", symbol: symKimpzp, zrodlo: "kimpzp" };
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
  // Podstawa z KIMPZP: ufamy statusowi planistycznemu z konektora (heurystyka symbolu+opisu),
  // nie samemu symbolowi — standard bywa spoza słownika i statusZeSymbolu myliłby się na „sprzeczny".
  if (podstawa.zrodlo === "kimpzp") {
    if (d.statusPlanistyczny === "sprzeczny") return false;
    if (d.statusPlanistyczny === "mpzp_mieszkaniowy") return true;
    return null;
  }
  if (podstawa.symbol) return !statusZeSymbolu(podstawa.symbol).sprzeczne;
  if (d.statusPlanistyczny === "sprzeczny") return false;
  return null; // prognoza / brak deklaracji — nie blokujemy
}

// ── Pojemność zabudowy z prognozy potencjału ──────────────────────────────────

/**
 * Prognoza potencjału z REKOMENDOWANEJ formy zabudowy (spójna z bramką wielkości):
 * forma niska → kondygnacje ≤ maxKondygnacjeNiska + mniejsze wspólne (bez wind).
 */
function liczPrognoze(
  d: DaneDzialki,
  sasiedztwo: SasiedztwoDane,
  mpzp: "jest" | "brak" | "nieznane",
  bramka: BramkaWielkosci,
  cfg: KonfiguracjaPoziom1
): PrognozaPotencjalu {
  const forma = bramka.formaRekomendowana;
  return prognozaPotencjalu({
    powierzchniaM2: d.powierzchniaM2,
    zwartosc: d.zwartoscKsztaltu ?? null,
    minSzerokoscM: d.minSzerokoscM ?? d.frontM ?? null,
    sasiedztwo,
    mpzp,
    metrazSredniM2: cfg.metrazSredniM2,
    wspolczynnikEfektywnosci: cfg.wspolczynnikEfektywnosci,
    cfg: cfg.potencjal,
    forma,
    maxKondygnacje: forma === "niska" ? cfg.bramka.maxKondygnacjeNiska : undefined,
    udzialWspolne: cfg.bramka.udzialWspolne[forma],
    udzialUslugi: cfg.bramka.udzialUslugi,
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

// ── Rekomendacja profilu (dla Poziomu 2/3) z werdyktów społecznych ────────────

function profilRekomendowany(scoreM: number, scoreS: number, cfg: KonfiguracjaPoziom1): ProfilRekomendowany {
  if (scoreM < cfg.pasma.zolty && scoreS < cfg.pasma.zolty) return "zaden";
  if (scoreM >= cfg.pasma.zielony && scoreS >= cfg.pasma.zielony && Math.abs(scoreM - scoreS) <= 10) return "oba";
  return scoreM >= scoreS ? "mlodzi" : "seniorzy";
}

/** Zgodność wsteczna: buduje WynikPopytu (W2) z werdyktu społecznego + atrakcyjności. */
function kompatPopyt(profil: Profil, w: WerdyktP1, ocena: OcenaPopytuP1): WynikPopytu {
  const kw = ocena.kwalifikacje[profil];
  return {
    profil,
    wewnetrzny: w.score,
    zewnetrzny: 0, // popyt zewnętrzny/migracyjny usunięty (popyt czysto niekorygowany)
    potencjalny: w.score,
    realizowalny: w.score,
    mnoznikLuka: 1,
    mnoznikUslugi: 1,
    udzialKwalifikujacyPct: kw.qS == null ? null : Math.round(kw.qS * 100),
    napiecie: 0,
    interpretacja: w.komentarz,
    flagi: w.flagi,
    pewnosc: w.pewnosc,
    skladniki: [
      { nazwa: "Grupa docelowa", wartosc: kw.nGrupa == null ? "brak danych" : `${kw.nGrupa} os.`, udzial: 0, fallback: kw.nGrupa == null },
    ],
  };
}

function kompatDopas(w: WerdyktP1, pojemnoscMieszkan: number | null): DopasowanieProfil {
  return { profil: w.profil, popyt: w.score, pojemnoscMieszkan, score: w.score, werdykt: w.werdykt, komentarz: w.komentarz };
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

  // Bramka wielkości/kształtu (na pewnej geometrii, PRZED popytem/pojemnością):
  // fizyczna wykonalność (twarda) + forma zabudowy (niska/wysoka) + próg opłacalności (miękki).
  const sasiedztwo = sasiedztwoDeterministyczne(d.id || `${d.teryt}-${d.powierzchniaM2}`, d.sredniSpadekPct);
  const bramkaWielkosci = liczBramkeWielkosci(d, sasiedztwo, mpzp, cfg);

  // Pojemność: PROGNOZA orientacyjnego potencjału rekomendowanej formy (spójna z bramką).
  const prognoza = liczPrognoze(d, sasiedztwo, mpzp, bramkaWielkosci, cfg);
  const pojemnosc = pojemnoscZPrognozy(prognoza);

  // Popyt: pełna ocena P1 — siatka 4 werdyktów (społeczne vs komunalne × profil).
  const ocenaPopytu = ocenPopytP1(d, { mlodzi: prognoza.mieszkania.mlodzi, seniorzy: prognoza.mieszkania.seniorzy });

  // Blokada przydatności: sprzeczne przeznaczenie zeruje werdykty społeczne (projekt niedozwolony).
  if (funkcjaOk === false) {
    for (const w of Object.values(ocenaPopytu.werdykty)) {
      if (w.natura === "spoleczny") { w.score = 0; w.werdykt = "czerwony"; w.flagi = [...w.flagi, "Funkcja mieszkaniowa niedozwolona wg przeznaczenia."]; }
    }
  }

  const spoleczneM = ocenaPopytu.werdykty.spolecznyMlodzi;
  const spoleczneS = ocenaPopytu.werdykty.spolecznySeniorzy;
  const scoreMlodzi = spoleczneM.score;
  const scoreSeniorzy = spoleczneS.score;

  // Rekomendacja profilu dla P2/P3 (natura projektowa = werdykty społeczne).
  const profil = funkcjaOk === false ? "zaden" : profilRekomendowany(scoreMlodzi, scoreSeniorzy, cfg);
  const werdykt = funkcjaOk === false ? "czerwony" : profil === "seniorzy" ? spoleczneS.werdykt : spoleczneM.werdykt;

  const tryb: "pelny" | "ograniczony" = pojemnosc.pumM2 === null || d.powierzchniaM2 <= 0 ? "ograniczony" : "pelny";

  const flagi: string[] = [];
  if (funkcjaOk === false) flagi.push("Funkcja mieszkaniowa niedozwolona wg wskazanego przeznaczenia — działka nieprzydatna.");
  if (bramkaWielkosci.ponizejProguOplacalnosci && bramkaWielkosci.fizycznieWykonalna && bramkaWielkosci.notaSkali) {
    flagi.push(bramkaWielkosci.notaSkali);
  }
  flagi.push("Pojemność to orientacyjna prognoza z kształtu działki i zabudowy sąsiedztwa — nie zastępuje ustaleń MPZP/WZ (potwierdzenie na Poziomie 2).");
  for (const f of prognoza.flagi) if (!flagi.includes(f)) flagi.push(f);
  const rek = ocenaPopytu.werdykty[ocenaPopytu.rekomendowanyKierunek];
  for (const f of rek.flagi) if (!flagi.includes(f)) flagi.push(f);

  // Pewność P1 = średnia z pewności rekomendowanego werdyktu popytu i prognozy potencjału.
  let pewnosc = Math.round((ocenaPopytu.pewnoscOgolna + prognoza.pewnosc) / 2);
  if (tryb === "ograniczony") pewnosc = Math.round(pewnosc * 0.85);

  return {
    dzialkaId: d.id,
    powierzchniaM2: d.powierzchniaM2,
    podstawa,
    funkcjaMieszkaniowaDozwolona: funkcjaOk !== false,
    bramkaWielkosci,
    prognoza,
    ocenaPopytu,
    dynamikaGminy: d.dynamikaGminy ?? null,
    pojemnosc,
    popyt: { mlodzi: kompatPopyt("mlodzi", spoleczneM, ocenaPopytu), seniorzy: kompatPopyt("seniorzy", spoleczneS, ocenaPopytu) },
    dopasowanie: {
      mlodzi: kompatDopas(spoleczneM, pojemnosc.szacLiczbaMieszkanMlodzi),
      seniorzy: kompatDopas(spoleczneS, pojemnosc.szacLiczbaMieszkanSeniorzy),
    },
    scoreMlodzi,
    scoreSeniorzy,
    profilRekomendowany: profil,
    werdyktMlodzi: spoleczneM.werdykt,
    werdyktSeniorzy: spoleczneS.werdykt,
    werdykt,
    pewnosc: clamp(pewnosc),
    tryb,
    flagi,
  };
}
