/**
 * Ocena popytu P1 — OCZYSZCZONY model (wg „wytyczne_claude_code_model_popytu_oczyszczony").
 * ================================================================================
 * Aplikacja to SITO — pokazuje potencjał przed płatną analizą, nie precyzyjny
 * instrument. Prosta formuła (5 kroków), bez bram, bez osobnego modelu migracji,
 * bez dzielenia zamieniającego brak mianownika w zero:
 *
 *   1. Populacja gminy (GUS)
 *   2. → podział na PROFILE po wieku: aktywni (18–emerytura) · seniorzy
 *   3. → ustawowy próg dochodowy dzieli na KOMUNALNY i SPOŁECZNY (qK, qS)
 *   4. → × UDZIAŁ BEZ MIESZKANIA (tabela per profil × segment)   = POPYT ZASTANY
 *   5. → × korekta MIGRACYJNA (jeden mnożnik, waga per kafel)     = POTENCJAŁ
 *
 * Werdykty (spójność P1/P2 — jednym językiem dla wszystkich 4 kafli):
 *   • społeczny / komunalny — POZIOM POTRZEBY (niski/umiarkowany/wysoki) wyprowadzony
 *     z PROPORCJI KOHORTOWEJ: udział kwalifikujących w segmencie ÷ liczebność WŁASNEJ
 *     kohorty (aktywni ÷ aktywni, seniorzy ÷ seniorzy). Mierzy natężenie potrzeby wewnątrz
 *     grupy klienta, porównywalne między gminami, oczyszczone ze struktury wiekowej.
 *   • P1 NIE odnosi się do POJEMNOŚCI/liczby mieszkań — wystarczalność wobec planowanej
 *     liczby mieszkań liczy dopiero P2. P1 = natychmiastowy przesiew z danych automatycznych.
 *   • brak danych ludnościowych → „nieoznaczony" (nie zero, nie „nie nadaje się").
 *
 * Funkcje czyste (testowalne offline).
 */

import type {
  AtrakcyjnoscMigracyjna,
  DaneDzialki,
  KluczWerdyktu,
  KwalifikacjeProfil,
  OcenaPopytuP1,
  Profil,
  Werdykt,
  WerdyktP1,
} from "../types";
import type { KonfiguracjaPopytP1, KonfiguracjaScoring } from "../config";
import { KONFIG_POPYT_P1, KONFIG_SCORING } from "../config";
import { clamp01, clamp } from "./utils";

// ── Pomocnicze: statystyka rozkładu dochodu ──────────────────────────────────

/** Dystrybuanta rozkładu normalnego (aproksymacja erf Abramowitz-Stegun 7.1.26). */
function normCdf(x: number): number {
  const t = 1 / (1 + 0.2316419 * Math.abs(x));
  const d = 0.3989422804014327 * Math.exp(-(x * x) / 2);
  const p = d * t * (0.319381530 + t * (-0.356563782 + t * (1.781477937 + t * (-1.821255978 + t * 1.330274429))));
  return x >= 0 ? 1 - p : p;
}

/** Dystrybuanta log-normalnego o zadanej ŚREDNIEJ i parametrze kształtu σ(log). */
function logNormCdf(t: number, srednia: number, sigma: number): number {
  if (t <= 0 || srednia <= 0 || sigma <= 0) return 0;
  const muLog = Math.log(srednia) - (sigma * sigma) / 2;
  return normCdf((Math.log(t) - muLog) / sigma);
}

const pasmo = (score: number, cfg: KonfiguracjaPopytP1): Werdykt =>
  score >= cfg.pasma.zielony ? "zielony" : score >= cfg.pasma.zolty ? "zolty" : "czerwony";

/** Próg luki cenowej [%], od którego flagujemy realny popyt na najem społeczny (M1). */
const PROG_LUKI_FLAGA = 30;

const FLAGA_UDZIAL = "Udział bez mieszkania to założenie (dane publiczne) — obniża pewność, nie udajemy precyzji.";

// ── Krok 3–4: kwalifikujący × udział bez mieszkania = POPYT ZASTANY ───────────

function kwalifikacje(d: DaneDzialki, profil: Profil, cfg: KonfiguracjaPopytP1): KwalifikacjeProfil {
  // Krok 3 — ustawowy próg dochodowy dzieli grupę na komunalny (qK) i społeczny (qS).
  const odniesienie = cfg.progiDochodu.dochodOdniesienieFallback;
  const progDolny = odniesienie * cfg.progiDochodu.komunalnyMn;
  const progGorny = odniesienie * cfg.progiDochodu.spolecznyMn;
  const dochodBaza = d.dochodPrzecietnyGmina ?? cfg.dochodFallback;
  const dp = cfg.dochodProfil[profil];
  const srednia = dochodBaza * dp.mnoznikSredniej;
  const qK = logNormCdf(progDolny, srednia, dp.sigma);
  const qS = Math.max(0, logNormCdf(progGorny, srednia, dp.sigma) - qK);
  const estymacja = d.dochodPrzecietnyGmina == null;

  // Krok 1–2 — populacja grupy wiekowej [OSOBY]; liczba bezwzględna z BDL, awaryjnie z udziału %.
  const total = d.liczbaMieszkancowGminy ?? null;
  let nOsoby: number | null = profil === "mlodzi" ? d.liczbaAktywni ?? null : d.liczba65Plus ?? null;
  if (nOsoby == null && total != null) {
    const pct = profil === "mlodzi" ? d.udzialAktywniPct : d.udzial65PlusPct;
    if (pct != null) nOsoby = (pct / 100) * total;
  }

  // Krok 4 — × udział bez mieszkania (tabela per profil × segment) = POPYT ZASTANY.
  const uB = cfg.udzialBezMieszkania[profil];
  // Komunalny: BEZWZGLĘDNA liczba osób bez mieszkania (segment K) — kotwica werdyktu komunalnego.
  const nKomunalny = nOsoby == null ? null : Math.round(nOsoby * qK * uB.komunalny);
  // Społeczny: gospodarstwa bez mieszkania (segment S) — do porównania z liczbą mieszkań.
  const nSpoleczny = nOsoby == null ? null : Math.round((nOsoby * qS * uB.spoleczny) / cfg.wielkoscGospodarstwa[profil]);

  return {
    nGrupa: nOsoby == null ? null : Math.round(nOsoby),
    qK: Math.round(qK * 1000) / 1000,
    qS: Math.round(qS * 1000) / 1000,
    nKomunalny,
    nSpoleczny,
    estymacja,
  };
}

// ── Krok 5: korekta migracyjna — jeden mnożnik ───────────────────────────────

interface Migracja {
  mBazowy: number;
  saldo1000: number | null;
  dostepna: boolean;
  /** true, gdy bilans oszacowano TYLKO z napływu (brak odpływu i salda netto) — niższa pewność. */
  zNaplywu: boolean;
}

/**
 * M = clamp(1 + saldo_na_1000 × k). Gmina rosnąca podnosi popyt, kurcząca się obniża.
 * Kolejność źródeł (od najlepszego): SALDO NETTO (jedna, spójna liczba z jednego roku) →
 * napływ−odpływ → sam napływ (fallback). Saldo netto jest preferowane, bo napływ i odpływ
 * mogą pochodzić z RÓŻNYCH lat (fallback roczny w konektorze), co czyni ich różnicę
 * niewiarygodną. Fallback z napływu: gdy nie ma salda ani odpływu, a napływ jest —
 * bilans szacujemy względem benchmarku napływu i słabszym współczynnikiem (niższa pewność).
 */
function korektaMigracji(d: DaneDzialki, cfg: KonfiguracjaPopytP1): Migracja {
  const total = d.liczbaMieszkancowGminy ?? null;
  let saldo1000: number | null = null;
  let zNaplywu = false;
  let k = cfg.migracja.k;
  if (d.saldoMigracjiMlodzi != null && total != null && total > 0) {
    saldo1000 = (d.saldoMigracjiMlodzi / total) * 1000; // saldo NETTO (absolutne → /total) — najczystszy sygnał
  } else if (d.naplywZameldowanNa1000 != null && d.odplywMlodychNa1000 != null) {
    saldo1000 = d.naplywZameldowanNa1000 - d.odplywMlodychNa1000; // obie już na 1000
  } else if (d.naplywZameldowanNa1000 != null) {
    // FALLBACK: sam napływ względem benchmarku, słabszym współczynnikiem i niższą pewnością.
    saldo1000 = d.naplywZameldowanNa1000 - cfg.migracja.benchmarkNaplyw1000;
    k = cfg.migracja.kNaplyw;
    zNaplywu = true;
  }
  const dostepna = saldo1000 != null;
  const mBazowy = dostepna ? Math.max(cfg.migracja.min, Math.min(cfg.migracja.max, 1 + saldo1000! * k)) : 1;
  return { mBazowy, saldo1000, dostepna, zNaplywu };
}

/** popyt_kafla = popyt_zastany × (1 + (M − 1) × waga_kafla). */
function zMigracja(popyt: number, mBazowy: number, waga: number): number {
  return popyt * (1 + (mBazowy - 1) * waga);
}

// ── Werdykty ─────────────────────────────────────────────────────────────────

function lukaCenowaPct(d: DaneDzialki, cfgS: KonfiguracjaScoring): number | null {
  if (d.wartoscOdtworzeniowaM2 == null || d.czynszRynkowyM2 == null || d.czynszRynkowyM2 <= 0) return null;
  const pulap = (d.wartoscOdtworzeniowaM2 * cfgS.stopaPulapuCzynszu) / 12;
  return ((d.czynszRynkowyM2 - pulap) / d.czynszRynkowyM2) * 100;
}

/** 4.2 — wzorzec „pułapki senioralnej": 65+ rośnie przy malejącej populacji (flaga informacyjna). */
function flagaPulapkaSenioralna(d: DaneDzialki): boolean {
  return d.trend65Plus === "rosnacy" && d.populacjaStabilna === false;
}

/** Werdykt „nieoznaczony" — brak podstawy ludnościowej (nie zero, nie „nie nadaje się"). */
function werdyktNieoznaczony(klucz: KluczWerdyktu, natura: "spoleczny" | "komunalny", profil: Profil): WerdyktP1 {
  return {
    klucz,
    natura,
    profil,
    score: 0,
    werdykt: "zolty",
    nieoznaczony: true,
    liczbaKwalifikujacych: null,
    pewnosc: 25,
    flagi: ["Brak danych ludnościowych — werdykt nieoznaczony (do potwierdzenia)."],
    komentarz: "Nieoznaczony — brak podstawy ludnościowej.",
  };
}

/** Etykieta kohorty (mianownik proporcji) dla profilu. */
const ETYK_KOHORTA: Record<Profil, string> = { mlodzi: "aktywnych", seniorzy: "seniorów" };

/**
 * POZIOM SŁOWNY z proporcji kohortowej → score (kolor werdyktu). To OPIS, NIE bramka:
 * niski poziom = realna, ale niewielka potrzeba (żółty), NIGDY „nie nadaje się".
 * Policzone ~zero (dane obecne) → najniższy score, wciąż nie czerwony-jak-brak.
 */
function poziomZProporcji(prop: number, progi: { umiarkowany: number; wysoki: number }): { poziom: string; score: number } {
  if (prop >= progi.wysoki) return { poziom: "wysoki", score: 85 };
  if (prop >= progi.umiarkowany) return { poziom: "umiarkowany", score: 60 };
  if (prop > 0) return { poziom: "niski", score: 45 };
  return { poziom: "niski", score: 35 };
}

function werdyktSpoleczny(
  profil: Profil,
  kw: KwalifikacjeProfil,
  mig: Migracja,
  luka: number | null,
  d: DaneDzialki,
  cfg: KonfiguracjaPopytP1
): WerdyktP1 {
  const klucz: KluczWerdyktu = profil === "mlodzi" ? "spolecznyMlodzi" : "spolecznySeniorzy";
  if (kw.nSpoleczny == null || kw.nGrupa == null || kw.nGrupa <= 0) return werdyktNieoznaczony(klucz, "spoleczny", profil);

  // Krok 5 — korekta migracyjna z wagą kafla [gospodarstwa segmentu S].
  const popytGosp = zMigracja(kw.nSpoleczny, mig.mBazowy, cfg.migracja.wagi[klucz]);
  // PROPORCJA KOHORTOWA (spójność P1/P2): osoby segmentu S ÷ WŁASNA kohorta (nie gmina).
  // gospodarstwa → osoby przez wielkość gospodarstwa; mianownik = liczebność kohorty.
  const osobyS = popytGosp * cfg.wielkoscGospodarstwa[profil];
  const prop = clamp01(osobyS / kw.nGrupa);
  const { poziom, score } = poziomZProporcji(prop, cfg.progiKohortowe[klucz]);

  const flagi: string[] = [FLAGA_UDZIAL];
  if (luka != null && luka >= PROG_LUKI_FLAGA) flagi.push(`Wysoka luka cenowa (${Math.round(luka)}%) — realny popyt na najem społeczny.`);
  if (kw.estymacja) flagi.push("Dochód gminy estymowany (brak danej BDL) — podział K/S orientacyjny.");
  if (mig.dostepna && mig.mBazowy !== 1)
    flagi.push(
      `Korekta migracyjna ×${Math.round(mig.mBazowy * 100) / 100} (${mig.zNaplywu ? "z napływu, bez odpływu" : `saldo ${Math.round((mig.saldo1000 ?? 0) * 10) / 10}/1000`}).`
    );

  const pewnosc = clamp(Math.round(78 - (kw.estymacja ? 8 : 0) - (mig.dostepna ? (mig.zNaplywu ? 3 : 0) : 6)));
  const komentarz = `${Math.round(popytGosp)} gosp. bez mieszkania (segment społeczny) — potrzeba ${poziom} (${(prop * 100).toFixed(1)}% ${ETYK_KOHORTA[profil]} kohorty). Wystarczalność wobec liczby mieszkań: Poziom 2.`;
  return {
    klucz,
    natura: "spoleczny",
    profil,
    score,
    werdykt: pasmo(score, cfg),
    liczbaKwalifikujacych: Math.round(popytGosp),
    proporcjaKohortowaPct: Math.round(prop * 1000) / 10,
    poziom,
    pewnosc,
    flagi,
    komentarz,
  };
}

function werdyktKomunalny(profil: Profil, kw: KwalifikacjeProfil, mig: Migracja, d: DaneDzialki, cfg: KonfiguracjaPopytP1): WerdyktP1 {
  const klucz: KluczWerdyktu = profil === "mlodzi" ? "komunalnyMlodzi" : "komunalnySeniorzy";
  if (kw.nKomunalny == null || kw.nGrupa == null || kw.nGrupa <= 0) return werdyktNieoznaczony(klucz, "komunalny", profil);

  // Krok 5 — korekta migracyjna z wagą kafla (komunalny-seniorzy ≈ 0) [osoby segmentu K].
  const popyt = Math.round(zMigracja(kw.nKomunalny, mig.mBazowy, cfg.migracja.wagi[klucz]));
  // PROPORCJA KOHORTOWA: osoby segmentu K ÷ WŁASNA kohorta (aktywni ÷ aktywni / seniorzy ÷ seniorzy).
  const prop = clamp01(popyt / kw.nGrupa);
  const { poziom, score } = poziomZProporcji(prop, cfg.progiKohortowe[klucz]);

  const flagi: string[] = [FLAGA_UDZIAL];
  if (kw.estymacja) flagi.push("Dochód gminy estymowany — podział K/S orientacyjny.");
  if (profil === "seniorzy") {
    flagi.push("Kierunek: mieszkania wspomagane dla seniorów (senioralne ze wsparciem).");
    if (flagaPulapkaSenioralna(d))
      flagi.push("Uwaga: rosnący udział 65+ przy malejącej populacji — ryzyko utrwalania odpływu (informacyjnie, nie obniża oceny).");
  }
  const pewnosc = clamp(Math.round((profil === "seniorzy" ? 60 : 68) - (kw.estymacja ? 8 : 0)));
  const komentarz = `Skala potrzeby komunalnej: ${popyt} os. bez mieszkania (segment K) — poziom ${poziom} (${(prop * 100).toFixed(1)}% ${ETYK_KOHORTA[profil]} kohorty).`;
  return {
    klucz,
    natura: "komunalny",
    profil,
    score,
    werdykt: pasmo(score, cfg),
    liczbaKwalifikujacych: popyt,
    proporcjaKohortowaPct: Math.round(prop * 1000) / 10,
    poziom,
    pewnosc,
    flagi,
    komentarz,
  };
}

// ── Główna: oczyszczona ocena popytu P1 ──────────────────────────────────────

export function ocenPopytP1(
  d: DaneDzialki,
  // Pojemność (z prognozy) NIE wchodzi już do P1 — wystarczalność wobec liczby mieszkań
  // liczy P2. Parametr zachowany dla zgodności wołaczy (świadomie nieużywany w P1).
  _pojemnosc: { mlodzi: number; seniorzy: number },
  cfg: KonfiguracjaPopytP1 = KONFIG_POPYT_P1,
  cfgS: KonfiguracjaScoring = KONFIG_SCORING
): OcenaPopytuP1 {
  const luka = lukaCenowaPct(d, cfgS);
  const mig = korektaMigracji(d, cfg);
  const kwMlodzi = kwalifikacje(d, "mlodzi", cfg);
  const kwSeniorzy = kwalifikacje(d, "seniorzy", cfg);

  const werdykty: Record<KluczWerdyktu, WerdyktP1> = {
    spolecznyMlodzi: werdyktSpoleczny("mlodzi", kwMlodzi, mig, luka, d, cfg),
    spolecznySeniorzy: werdyktSpoleczny("seniorzy", kwSeniorzy, mig, luka, d, cfg),
    komunalnyMlodzi: werdyktKomunalny("mlodzi", kwMlodzi, mig, d, cfg),
    komunalnySeniorzy: werdyktKomunalny("seniorzy", kwSeniorzy, mig, d, cfg),
  };

  // Rekomendacja DZIAŁKI wybierana spośród werdyktów SPOŁECZNYCH (poziom potrzeby w kohorcie).
  // Kafle komunalne to „potrzeba gminy" — nie rekomendują konkretnej działki.
  const spoleczne = [werdykty.spolecznyMlodzi, werdykty.spolecznySeniorzy];
  const rekomendowany = spoleczne.reduce((a, b) => (b.score > a.score ? b : a));

  // Zgodność wsteczna: pole atrakcyjności = sygnał migracyjny (0–100) z jednego mnożnika.
  const sygnalMigracji = clamp(Math.round(((mig.mBazowy - 1) / (cfg.migracja.max - 1)) * 100), 0, 100);
  const atrakcyjnoscMigracyjna: AtrakcyjnoscMigracyjna = {
    a1: 0,
    a2: 0,
    a3: 0,
    wartosc: sygnalMigracji,
    pewnosc: mig.dostepna ? (mig.zNaplywu ? 60 : 75) : 45,
    fallback: !mig.dostepna || mig.zNaplywu,
  };

  return {
    kwalifikacje: { mlodzi: kwMlodzi, seniorzy: kwSeniorzy },
    atrakcyjnoscMigracyjna,
    korektaMigracyjna: { mBazowy: Math.round(mig.mBazowy * 100) / 100, saldo1000: mig.saldo1000 == null ? null : Math.round(mig.saldo1000 * 10) / 10, dostepna: mig.dostepna, zNaplywu: mig.zNaplywu },
    werdykty,
    rekomendowanyKierunek: rekomendowany.klucz,
    pewnoscOgolna: rekomendowany.pewnosc,
  };
}
