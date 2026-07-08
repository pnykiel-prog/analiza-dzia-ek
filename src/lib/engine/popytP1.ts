/**
 * Ocena popytu na Poziomie 1 — wersja pełna (wg „wytyczne_claude_code_popyt_poziom1.md").
 * ================================================================================
 * Zamiast dwóch profili → SIATKA 4 WERDYKTÓW o dwóch naturach:
 *   • społeczny (młodzi / seniorzy)  — ocena PROJEKTU na działce (vs pojemność),
 *   • komunalny (młodzi / seniorzy)  — SKALA POTRZEBY w gminie (per mieszkaniec).
 *
 * Kluczowe zasady:
 *   1. Popyt wewnętrzny = LICZBA kwalifikujących się (trójdzielny podział dochodu
 *      K/S/R na rozkładzie log-normal), nie średnia odsetków.
 *   2. Popyt zewnętrzny zastąpiony WSKAŹNIKIEM ATRAKCYJNOŚCI MIGRACYJNEJ
 *      (A1 zmierzone = bramka dla A2/A3 estymowanych).
 *   3. Werdykty komunalne: per mieszkaniec vs mediana regionalna — BEZ pojemności,
 *      luki i migracji.
 *   4. Trend/pustostany/bezrobocie NIE tworzą popytu — są mnożnikami (centrowanymi w 1,0).
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

// ── Trójdzielny podział dochodowy (K / S / R) → liczby bezwzględne ────────────

function kwalifikacje(
  d: DaneDzialki,
  profil: Profil,
  cfg: KonfiguracjaPopytP1
): KwalifikacjeProfil {
  // PROGI od DOCHODU ODNIESIENIA (nie od WO — to koszt budowy, nie dochód).
  const odniesienie = cfg.progiDochodu.dochodOdniesienieFallback;
  const progDolny = odniesienie * cfg.progiDochodu.komunalnyMn; // < → komunalny
  const progGorny = odniesienie * cfg.progiDochodu.spolecznyMn; // < → społeczny; ≥ → rynek

  // ROZKŁAD PER PROFIL: emerytury (seniorzy) ≠ pensje (młodzi). Średnia = dochód
  // gminy × mnożnik profilu; σ profilowa. Progi bezwzględne → frakcja rozkładu.
  const dochodBaza = d.dochodPrzecietnyGmina ?? cfg.dochodFallback;
  const dp = cfg.dochodProfil[profil];
  const srednia = dochodBaza * dp.mnoznikSredniej;
  const qK = logNormCdf(progDolny, srednia, dp.sigma);
  const qKGorny = logNormCdf(progGorny, srednia, dp.sigma);
  const qS = Math.max(0, qKGorny - qK);
  const estymacja = d.dochodPrzecietnyGmina == null;

  // Liczebność grupy [OSOBY]: liczba bezwzględna z BDL; awaryjnie z udziału % × ludność.
  const total = d.liczbaMieszkancowGminy ?? null;
  let nOsoby: number | null =
    profil === "mlodzi" ? d.liczba2039 ?? null : d.liczba65Plus ?? null;
  if (nOsoby == null && total != null) {
    const pct = profil === "mlodzi" ? d.udzial2039Pct : d.udzial65PlusPct;
    if (pct != null) nOsoby = (pct / 100) * total;
  }
  // GOSPODARSTWA = osoby / wielkość gospodarstwa profilu (do porównania z liczbą mieszkań).
  const nGospodarstw = nOsoby == null ? null : nOsoby / cfg.wielkoscGospodarstwa[profil];
  // Konwersja senioralna: reduktor realnej skłonności 65+ do najmu społecznego
  // (własność, wiek). Dotyczy STRUMIENIA SPOŁECZNEGO; skala potrzeby komunalnej
  // (kanał gminny) pozostaje pełna — patrz sekcja 4.2 wytycznych.
  const konw = profil === "seniorzy" ? cfg.konwersjaSenior : 1;

  return {
    // nGrupa raportowane w OSOBACH (liczebność grupy wiekowej).
    nGrupa: nOsoby == null ? null : Math.round(nOsoby),
    qK: Math.round(qK * 1000) / 1000,
    qS: Math.round(qS * 1000) / 1000,
    // nKomunalny = OSOBY (skala potrzeby per mieszkaniec, benchmark /1000 mieszk.).
    nKomunalny: nOsoby == null ? null : Math.round(nOsoby * qK),
    // nSpoleczny = GOSPODARSTWA kwalifikujące (do porównania z liczbą mieszkań), z konwersją senioralną.
    nSpoleczny: nGospodarstw == null ? null : Math.round(nGospodarstw * qS * konw),
    estymacja,
  };
}

// ── Luka cenowa i modyfikatory (centrowane w 1,0) ────────────────────────────

function lukaCenowaPct(d: DaneDzialki, cfgS: KonfiguracjaScoring): number | null {
  if (d.wartoscOdtworzeniowaM2 == null || d.czynszRynkowyM2 == null || d.czynszRynkowyM2 <= 0) return null;
  const pulap = (d.wartoscOdtworzeniowaM2 * cfgS.stopaPulapuCzynszu) / 12;
  return ((d.czynszRynkowyM2 - pulap) / d.czynszRynkowyM2) * 100;
}

/** M_luka = baza + nachylenie×(luka/100), np. 0.75..1.25. Neutralny 1.0 przy braku luki. */
function mLuka(luka: number | null, cfg: KonfiguracjaPopytP1): number {
  if (luka == null) return 1.0;
  return cfg.mLuka.baza + cfg.mLuka.nachylenie * clamp01(luka / 100);
}

/** Napięcie mieszkaniowe 0..1 (niskie pustostany + rosnąca ludność). */
function napiecie01(d: DaneDzialki): number {
  const pustIdx = d.pustostanyPct == null ? 0.55 : clamp01((12 - d.pustostanyPct) / 10);
  const trendIdx =
    d.trendLudnosc == null ? 0.55 : d.trendLudnosc === "rosnaca" ? 1 : d.trendLudnosc === "stabilna" ? 0.6 : 0.2;
  return clamp01(0.6 * pustIdx + 0.4 * trendIdx);
}

const skala = (x01: number, min: number, max: number) => min + (max - min) * clamp01(x01);

/**
 * M_trend (4.2): wspólny zakres dla obu profili. NIE tłumimy realnej potrzeby
 * senioralnej dodatkowym mnożnikiem — „pułapka wyludniania" była fałszywie
 * negatywna na wsi. Ostrzeżenie o ryzyku utrwalania odpływu idzie jako FLAGA
 * (patrz `flagaPulapkaSenioralna` w werdyktKomunalny), nie jako cięcie score.
 */
function mTrend(d: DaneDzialki, _profil: Profil, cfg: KonfiguracjaPopytP1): number {
  const t01 = d.trendLudnosc == null ? 0.5 : d.trendLudnosc === "rosnaca" ? 1 : d.trendLudnosc === "stabilna" ? 0.55 : 0;
  return skala(t01, cfg.mTrend.min, cfg.mTrend.max);
}

/** 4.2 — wzorzec „pułapki senioralnej": 65+ rośnie przy malejącej populacji. */
function flagaPulapkaSenioralna(d: DaneDzialki): boolean {
  return d.trend65Plus === "rosnacy" && d.populacjaStabilna === false;
}

/** Pull gospodarczy 0..1 (niskie bezrobocie + gęstość podmiotów) — do atrakcyjności. */
function pull01(d: DaneDzialki): number {
  const bIdx = d.bezrobociePct == null ? 0.55 : clamp01((10 - d.bezrobociePct) / 8);
  const pIdx = d.liczbaPodmiotowGosp == null ? 0.55 : clamp01((d.liczbaPodmiotowGosp - 80) / 140);
  return clamp01(0.5 * bIdx + 0.5 * pIdx);
}

// ── Wskaźnik atrakcyjności migracyjnej (A1 zmierzone → bramka A2/A3) ──────────

function atrakcyjnoscMigracyjna(
  d: DaneDzialki,
  luka: number | null,
  cfg: KonfiguracjaPopytP1
): AtrakcyjnoscMigracyjna {
  const lukaNorm = luka == null ? 0 : clamp01(luka / 100);
  const pull = pull01(d);

  // A1 — zmierzony napływ vs benchmark (bench → 50). Proxy z salda, gdy brak napływu brutto.
  let a1: number;
  let fallback: boolean;
  if (d.naplywZameldowanNa1000 != null) {
    a1 = clamp(Math.round((d.naplywZameldowanNa1000 / cfg.atrakcyjnosc.naplywBenchNa1000) * 50));
    fallback = false;
  } else if (d.saldoMigracjiMlodzi != null) {
    a1 = d.saldoMigracjiMlodzi > 0 ? 60 : d.saldoMigracjiMlodzi === 0 ? 40 : 20;
    fallback = true;
  } else {
    a1 = 40;
    fallback = true;
  }

  // Bramka wiarygodności: gdy A1≈0 i luka mała → brak „życzeniowej" migracji.
  const brama = clamp01((a1 / 100) * 0.7 + lukaNorm * 0.3);
  // A2 — potencjał odblokowany tańszą ofertą (luka + rynek pracy).
  const a2 = Math.round(brama * clamp01(0.5 * lukaNorm + 0.5 * pull) * 100);
  // A3 — zatrzymany odpływ (odpływ młodych × luka).
  const odplywNorm = d.odplywMlodychNa1000 == null ? 0.4 : clamp01(d.odplywMlodychNa1000 / cfg.atrakcyjnosc.odplywBenchNa1000);
  const a3 = Math.round(brama * clamp01(0.5 * odplywNorm + 0.5 * lukaNorm) * 100);

  // A1 liczone RAZ (3.2): jest BRAMĄ wiarygodności (skaluje A2/A3), więc NIE dodajemy
  // go drugi raz wprost. Wartość = potencjał odblokowany (A2) + zatrzymany odpływ (A3),
  // już przefiltrowane przez wiarygodność A1.
  const wartosc = clamp(Math.round(cfg.atrakcyjnosc.waga2 * a2 + cfg.atrakcyjnosc.waga3 * a3), 0, cfg.atrakcyjnosc.sufit);
  // Pewność: zmierzony napływ (nie fallback) i wiarygodna brama → wyższa.
  const pewnosc = clamp(Math.round((fallback ? 55 : 80) - 15 * (1 - brama)));
  return { a1, a2, a3, wartosc, pewnosc, fallback };
}

// ── Werdykty ─────────────────────────────────────────────────────────────────

function werdyktSpoleczny(
  profil: Profil,
  kw: KwalifikacjeProfil,
  pojemnoscMieszkan: number,
  atrakcyjnosc: AtrakcyjnoscMigracyjna,
  luka: number | null,
  d: DaneDzialki,
  cfg: KonfiguracjaPopytP1
): WerdyktP1 {
  const klucz: KluczWerdyktu = profil === "mlodzi" ? "spolecznyMlodzi" : "spolecznySeniorzy";
  const flagi: string[] = [];
  const fSila = clamp((kw.qS ?? 0) / cfg.qBenchS, 0.3, 1.3);
  // Wystarczalność: GOSPODARSTWA kwalifikujące vs liczba mieszkań × margines gospodarstw.
  const denom = Math.max(1, pojemnoscMieszkan * cfg.marginesGospodarstwa);
  const fWystarcz = kw.nSpoleczny == null ? 0.5 : clamp01(kw.nSpoleczny / denom);
  const popytWew = clamp(Math.round(100 * fWystarcz * fSila));

  const wagi = cfg.wagiSpoleczne[profil];
  // FILTR DOCHODOWY MIGRACJI (3.3): napływ zasila popyt SPOŁECZNY tylko w części
  // kwalifikującej się dochodowo (udział K+S) — zamożny migrant nie zwiększa
  // popytu na mieszkanie społeczne.
  const udzialKwalif = clamp01((kw.qK ?? 0) + (kw.qS ?? 0));
  const atrakcyjnoscFiltr = atrakcyjnosc.wartosc * udzialKwalif;
  const baza = wagi.wew * popytWew + wagi.zew * atrakcyjnoscFiltr;
  const score = clamp(Math.round(baza * mLuka(luka, cfg) * skala(napiecie01(d), cfg.mNapiecie.min, cfg.mNapiecie.max)));

  // Luka czynszowa → sygnał popytu na najem społeczny (estymacja — miejsce w M1, nie M2).
  if (luka != null && luka >= PROG_LUKI_FLAGA) flagi.push(`Wysoka luka cenowa (${Math.round(luka)}%) — realny popyt na najem społeczny.`);
  if (kw.nSpoleczny == null) flagi.push("Brak liczb ludności/dochodu — popyt społeczny szacowany (obniżona pewność).");
  if (kw.estymacja) flagi.push("Udział dochodowy (segment społeczny) estymowany z rozkładu regionalnego — do potwierdzenia na P2.");
  if (luka == null) flagi.push("Brak lokalnego czynszu rynkowego — luka i atrakcyjność szacunkowe.");

  const pewnoscBaza = kw.nSpoleczny == null ? 45 : kw.estymacja ? 70 : 82;
  const pewnosc = clamp(Math.round(pewnoscBaza * (1 - wagi.zew) + atrakcyjnosc.pewnosc * wagi.zew));
  const komentarz =
    kw.nSpoleczny == null
      ? "Brak danych ludnościowych — werdykt orientacyjny."
      : `${kw.nSpoleczny} gospodarstw kwalifikujących się (segment społeczny) wobec pojemności ${pojemnoscMieszkan} mieszk. × margines ${cfg.marginesGospodarstwa}.`;
  return { klucz, natura: "spoleczny", profil, score, werdykt: pasmo(score, cfg), liczbaKwalifikujacych: kw.nSpoleczny, pewnosc, flagi, komentarz };
}

function werdyktKomunalny(
  profil: Profil,
  kw: KwalifikacjeProfil,
  d: DaneDzialki,
  cfg: KonfiguracjaPopytP1
): WerdyktP1 {
  const klucz: KluczWerdyktu = profil === "mlodzi" ? "komunalnyMlodzi" : "komunalnySeniorzy";
  const flagi: string[] = [];
  const total = d.liczbaMieszkancowGminy ?? null;
  let score = 0;
  if (kw.nKomunalny != null && total != null && total > 0) {
    const gestosc = (kw.nKomunalny / total) * 1000; // na 1000 mieszk.
    const ratio = gestosc / cfg.benchKomNa1000;
    const scoreBase = clamp(Math.round(50 * ratio)); // ratio=1 (mediana) → 50
    const mNap = skala(napiecie01(d), cfg.mNapiecieKom.min, cfg.mNapiecieKom.max);
    score = clamp(Math.round(scoreBase * mNap * mTrend(d, profil, cfg)));
  } else {
    flagi.push("Brak liczb ludności — skala potrzeby komunalnej nieoznaczona.");
  }
  if (kw.estymacja) flagi.push("Podział dochodowy (segment komunalny) estymowany — obniżona pewność.");

  // Pewność: komunalne niższe od społecznych; komunalny-seniorzy najniższy.
  let pewnosc = clamp(Math.round((kw.nKomunalny == null ? 45 : 70) - (kw.estymacja ? 8 : 0)));
  if (profil === "seniorzy") {
    pewnosc = clamp(pewnosc - 10);
    flagi.push("Kierunek: mieszkania wspomagane dla seniorów (senioralne ze wsparciem).");
    // 4.2 Ryzyko utrwalania odpływu jako FLAGA (nie cięcie score) — realna potrzeba pokazana.
    if (flagaPulapkaSenioralna(d))
      flagi.push("Uwaga: rosnący udział 65+ przy malejącej populacji — ryzyko utrwalania odpływu (informacyjnie, nie obniża oceny).");
  }
  const komentarz =
    kw.nKomunalny == null
      ? "Brak danych ludnościowych — skala potrzeby nieoznaczona."
      : `Skala potrzeby komunalnej: ${kw.nKomunalny} os. (segment K) — porównanie per mieszkaniec do mediany regionalnej.`;
  return { klucz, natura: "komunalny", profil, score, werdykt: pasmo(score, cfg), liczbaKwalifikujacych: kw.nKomunalny, pewnosc, flagi, komentarz };
}

// ── Główna: pełna ocena popytu P1 ────────────────────────────────────────────

export function ocenPopytP1(
  d: DaneDzialki,
  pojemnosc: { mlodzi: number; seniorzy: number },
  cfg: KonfiguracjaPopytP1 = KONFIG_POPYT_P1,
  cfgS: KonfiguracjaScoring = KONFIG_SCORING
): OcenaPopytuP1 {
  const luka = lukaCenowaPct(d, cfgS);
  const kwMlodzi = kwalifikacje(d, "mlodzi", cfg);
  const kwSeniorzy = kwalifikacje(d, "seniorzy", cfg);
  const atrakcyjnosc = atrakcyjnoscMigracyjna(d, luka, cfg);

  const werdykty: Record<KluczWerdyktu, WerdyktP1> = {
    spolecznyMlodzi: werdyktSpoleczny("mlodzi", kwMlodzi, pojemnosc.mlodzi, atrakcyjnosc, luka, d, cfg),
    spolecznySeniorzy: werdyktSpoleczny("seniorzy", kwSeniorzy, pojemnosc.seniorzy, atrakcyjnosc, luka, d, cfg),
    komunalnyMlodzi: werdyktKomunalny("mlodzi", kwMlodzi, d, cfg),
    komunalnySeniorzy: werdyktKomunalny("seniorzy", kwSeniorzy, d, cfg),
  };

  // 4.1 Rekomendacja DZIAŁKI wybierana spośród werdyktów SPOŁECZNYCH (ocena projektu
  // na działce). Kafle komunalne to „potrzeba gminy" (skala per mieszkaniec, bez
  // pojemności/lokalizacji) — nie mogą samodzielnie rekomendować konkretnej działki.
  const spoleczne = [werdykty.spolecznyMlodzi, werdykty.spolecznySeniorzy];
  const rekomendowany = spoleczne.reduce((a, b) => (b.score > a.score ? b : a));
  const pewnoscOgolna = rekomendowany.pewnosc;

  return {
    kwalifikacje: { mlodzi: kwMlodzi, seniorzy: kwSeniorzy },
    atrakcyjnoscMigracyjna: atrakcyjnosc,
    werdykty,
    rekomendowanyKierunek: rekomendowany.klucz,
    pewnoscOgolna,
  };
}
