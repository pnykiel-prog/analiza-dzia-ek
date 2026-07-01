/**
 * Model oceny popytu (pod-model wymiaru W2) — zgodny z `model_oceny_popytu.md`.
 *
 * Rozdziela popyt na WEWNĘTRZNY (lokalni kwalifikujący się pod presją) i
 * ZEWNĘTRZNY (napływ migracyjny × luka cenowa), a następnie mnoży przez mnożnik
 * luki cenowej i mnożnik usług/dostępności (profil) → popyt realizowalny 0–100,
 * który zasila wymiar W2. Zasada „brak danych ≠ nie": braki są neutralne i obniżają
 * pewność, nie zerują popytu. Funkcje czyste (testowane offline).
 */

import type { DaneDzialki, Profil, SkladnikPopytu, WynikPopytu } from "../types";
import type { KonfiguracjaPopyt, KonfiguracjaScoring } from "../config";
import { KONFIG_POPYT } from "../config";
import { clamp, liniowo, progi } from "./utils";

const c01 = (x: number) => Math.max(0, Math.min(1, x));

// ── Filtr najmu długoterminowego (twarda reguła czyszczenia danych, sekcja 2) ──

export interface OfertaNajmu {
  cena: number; // kwota oferty
  jednostka?: "miesiac" | "doba" | "noc" | "tydzien" | "weekend";
  m2?: number;
  krotkoterminowy?: boolean;
  opis?: string;
}

const WZORZEC_KROTKOTERMINOWY = /doba|dob[eę]|noc|nocleg|weekend|airbnb|booking|apartament na doby|kwatera|turyst/i;

/**
 * Zostawia wyłącznie oferty najmu długoterminowego z ceną MIESIĘCZNĄ; odrzuca
 * dobowe/turystyczne. Zwraca oferty czyste i udział krótkoterminowych w podaży
 * (sygnał „rynek turystyczny").
 */
export function filtrujNajemDlugoterminowy(oferty: OfertaNajmu[]): {
  dlugoterminowe: OfertaNajmu[];
  udzialKrotkoterminowego: number; // 0–1
  rynekTurystyczny: boolean;
} {
  if (!oferty.length) return { dlugoterminowe: [], udzialKrotkoterminowego: 0, rynekTurystyczny: false };
  const krotki = (o: OfertaNajmu) =>
    o.krotkoterminowy === true ||
    (o.jednostka !== undefined && o.jednostka !== "miesiac") ||
    (o.opis !== undefined && WZORZEC_KROTKOTERMINOWY.test(o.opis));
  const dlugoterminowe = oferty.filter((o) => !krotki(o));
  const udzial = (oferty.length - dlugoterminowe.length) / oferty.length;
  return { dlugoterminowe, udzialKrotkoterminowego: udzial, rynekTurystyczny: udzial >= 0.4 };
}

// ── Składowe indeksy (0–1) ────────────────────────────────────────────────────

/** Luka najemcy: (czynsz rynkowy − pułap SIM) / czynsz rynkowy [%]. */
export function lukaCenowaPct(d: DaneDzialki, cfgS: KonfiguracjaScoring): number | null {
  if (d.wartoscOdtworzeniowaM2 === null || d.czynszRynkowyM2 === null || d.czynszRynkowyM2 <= 0) return null;
  const pulap = (d.wartoscOdtworzeniowaM2 * cfgS.stopaPulapuCzynszu) / 12;
  return ((d.czynszRynkowyM2 - pulap) / d.czynszRynkowyM2) * 100;
}

/** Udział kwalifikujący się dochodowo (luka czynszowa): rynek za drogi ∧ dochód > pułap komunalny. */
function kwalifikacjaDochodowa(
  d: DaneDzialki,
  profil: Profil,
  cfg: KonfiguracjaPopyt
): { udzial: number; pct: number | null; fallback: boolean } {
  if (d.dochodyGospDomowe === null || d.czynszRynkowyM2 === null || d.czynszRynkowyM2 <= 0) {
    return { udzial: 0.5, pct: null, fallback: true }; // neutralnie, obniżona pewność
  }
  const metraz = cfg.metrazTypowyM2[profil];
  const obciazeniePct = ((d.czynszRynkowyM2 * metraz) / d.dochodyGospDomowe) * 100; // % dochodu na czynsz
  const prog = cfg.progDochoduNaCzynszPct;
  // Rynek za drogi: obciążenie rośnie powyżej progu → wyższy udział kwalifikujących.
  const rynekZaDrogi = liniowo(obciazeniePct, prog * 0.7, prog, 0.3, 0.95);
  // Dochód powyżej pułapu komunalnego → nie łapie się na komunalny (luka społeczna).
  const ponadKomunalny =
    d.dochodyGospDomowe >= cfg.pulapKomunalnyDochod
      ? 0.9
      : liniowo(d.dochodyGospDomowe, cfg.pulapKomunalnyDochod * 0.6, cfg.pulapKomunalnyDochod, 0.3, 0.9);
  const udzial = c01(rynekZaDrogi * ponadKomunalny);
  return { udzial, pct: Math.round(udzial * 100), fallback: false };
}

/** Napięcie mieszkaniowe (0–1): niskie pustostany + rosnąca ludność. */
function napiecieMieszkaniowe(d: DaneDzialki): { idx: number; fallback: boolean } {
  const pustFallback = d.pustostanyPct === null;
  const pustIdx = pustFallback ? 0.55 : liniowo(d.pustostanyPct as number, 2, 12, 1, 0.15);
  const trendIdx =
    d.trendLudnosc === null ? 0.55 : d.trendLudnosc === "rosnaca" ? 1 : d.trendLudnosc === "stabilna" ? 0.6 : 0.25;
  return { idx: c01(0.6 * pustIdx + 0.4 * trendIdx), fallback: pustFallback && d.trendLudnosc === null };
}

/** Baza grupy docelowej (0–1) — intensywność grupy z korektą trendu (seniorzy). */
function grupaDocelowa(d: DaneDzialki, profil: Profil): { idx: number; opis: string; fallback: boolean } {
  if (profil === "mlodzi") {
    if (d.udzial2039Pct === null || d.mediana2039Woj === null) return { idx: 0.5, opis: "brak danych", fallback: true };
    const idx = liniowo(d.udzial2039Pct, d.mediana2039Woj * 0.6, d.mediana2039Woj * 1.15, 0.35, 1);
    return { idx: c01(idx), opis: `${d.udzial2039Pct}% (mediana ${d.mediana2039Woj}%)`, fallback: false };
  }
  if (d.udzial65PlusPct === null || d.trend65Plus === null) return { idx: 0.5, opis: "brak danych", fallback: true };
  const baza = liniowo(d.udzial65PlusPct, 12, 26, 0.4, 1);
  // Korekta „pułapki seniorów": rosnący udział przy wyludnianiu to wymieranie, nie popyt.
  const mod =
    d.trend65Plus === "rosnacy"
      ? d.populacjaStabilna
        ? 1.0
        : 0.55
      : d.trend65Plus === "stabilny"
        ? 0.85
        : 0.7;
  return { idx: c01(baza * mod), opis: `${d.udzial65PlusPct}% 65+`, fallback: false };
}

/** Pull gospodarczy (0–1): niskie bezrobocie + gęstość podmiotów. */
function pullGospodarczy(d: DaneDzialki): { idx: number; fallback: boolean } {
  const bFallback = d.bezrobociePct === null;
  const pFallback = d.liczbaPodmiotowGosp === null;
  const bIdx = bFallback ? 0.55 : progi(d.bezrobociePct as number, [{ max: 3, pkt: 1 }, { max: 5, pkt: 0.75 }, { max: 8, pkt: 0.4 }], 0.2);
  const pIdx = pFallback ? 0.55 : c01(liniowo(d.liczbaPodmiotowGosp as number, 80, 220, 0.4, 1));
  return { idx: c01(0.5 * bIdx + 0.5 * pIdx), fallback: bFallback && pFallback };
}

/** Napływ migracyjny (0–1) — dla seniorów mały bazowy (rzadko migrują). */
function naplyw(d: DaneDzialki, profil: Profil): { idx: number; opis: string; fallback: boolean } {
  if (profil === "seniorzy") return { idx: 0.3, opis: "niski (seniorzy rzadko migrują)", fallback: false };
  if (d.saldoMigracjiMlodzi === null) return { idx: 0.5, opis: "brak danych", fallback: true };
  const idx = d.saldoMigracjiMlodzi > 0 ? 0.85 : d.saldoMigracjiMlodzi === 0 ? 0.5 : 0.2;
  return { idx, opis: `saldo ${d.saldoMigracjiMlodzi > 0 ? "+" : ""}${d.saldoMigracjiMlodzi}`, fallback: false };
}

/** Siła luki cenowej (0–1) — pull dla wypchniętych z rynku. */
function silaLuki(luka: number | null): { idx: number; fallback: boolean } {
  if (luka === null) return { idx: 0.5, fallback: true };
  const idx = luka >= 45 ? 1 : luka >= 30 ? 0.8 : luka >= 15 ? 0.5 : luka >= 5 ? 0.3 : 0.15;
  return { idx, fallback: false };
}

/** Mnożnik usług/dostępności (profil) — gate konwersji popytu (sekcja 6). */
function mnoznikUslug(d: DaneDzialki, profil: Profil, cfg: KonfiguracjaPopyt): { m: number; fallback: boolean } {
  const dojazdIdx =
    d.czasDojazdAglomeracjaMin === null ? 0.6 : progi(d.czasDojazdAglomeracjaMin, [{ max: 30, pkt: 1 }, { max: 45, pkt: 0.6 }, { max: 60, pkt: 0.3 }], 0.1);
  let raw: number;
  let fallback: boolean;
  if (profil === "mlodzi") {
    const przyst = d.przystanekZCzestotliwoscia === null ? 0.6 : d.przystanekZCzestotliwoscia ? 1 : 0.3;
    const szkoly = d.zlobkiSzkolyWZasiegu === null ? 0.7 : d.zlobkiSzkolyWZasiegu ? 1 : 0.5;
    raw = (dojazdIdx + przyst + szkoly) / 3;
    fallback = d.przystanekZCzestotliwoscia === null && d.czasDojazdAglomeracjaMin === null && d.zlobkiSzkolyWZasiegu === null;
  } else {
    const poz = d.pozWZasiegu === null ? 0.6 : d.pozWZasiegu ? 1 : 0.3;
    const uslugi = d.uslugiPodstawowePieszo === null ? 0.6 : d.uslugiPodstawowePieszo ? 1 : 0.2;
    raw = 0.5 * poz + 0.4 * uslugi + 0.1 * dojazdIdx;
    fallback = d.pozWZasiegu === null && d.uslugiPodstawowePieszo === null;
  }
  return { m: cfg.mnoznikUslug.min + cfg.mnoznikUslug.wklad * c01(raw), fallback };
}

// ── Główna: ocena popytu per profil ───────────────────────────────────────────

export function ocenPopyt(
  d: DaneDzialki,
  profil: Profil,
  cfgS: KonfiguracjaScoring,
  cfg: KonfiguracjaPopyt = KONFIG_POPYT
): WynikPopytu {
  const grupa = grupaDocelowa(d, profil);
  const kwal = kwalifikacjaDochodowa(d, profil, cfg);
  const nap = napiecieMieszkaniowe(d);
  const luka = lukaCenowaPct(d, cfgS);
  const napl = naplyw(d, profil);
  const pull = pullGospodarczy(d);
  const sila = silaLuki(luka);
  const mUsl = mnoznikUslug(d, profil, cfg);

  // Popyt wewnętrzny = grupa × kwalifikacja × napięcie.
  const wewnetrzny = c01(grupa.idx * kwal.udzial * nap.idx);
  // Popyt zewnętrzny = (napływ wzmocniony pullem) × siła luki.
  const naplywEff = c01(0.6 * napl.idx + 0.4 * pull.idx);
  const zewnetrzny = c01(naplywEff * sila.idx);

  const wagi = cfg.wagi[profil];
  const potencjalny = c01(wagi.wewnetrzny * wewnetrzny + wagi.zewnetrzny * zewnetrzny);

  const mnoznikLuka = luka === null ? 1.0 : liniowo(luka, 0, 45, cfg.mnoznikLuka.min, cfg.mnoznikLuka.max);
  const realizowalny = clamp(Math.round(potencjalny * mnoznikLuka * mUsl.m * 100));

  // Interpretacja kombinacji (sekcja 7).
  const prog = cfg.progInterpretacji;
  const w100 = Math.round(wewnetrzny * 100);
  const z100 = Math.round(zewnetrzny * 100);
  const interpretacja =
    w100 >= prog && z100 >= prog
      ? "Silny, rosnący rynek — mocno „za”."
      : w100 >= prog
        ? "Realna potrzeba lokalna przy słabym napływie — „za” społecznie, ostrożnie inwestycyjnie."
        : z100 >= prog
          ? "Rynek napływowy/rozwojowy — „za”, zwłaszcza dla młodych/commuterów."
          : "Słaby popyt — sygnał „przeciw”.";

  // Flagi.
  const flagi: string[] = [];
  if (
    profil === "seniorzy" &&
    d.udzial65PlusPct !== null &&
    d.udzial65PlusPct >= 22 &&
    (d.trendLudnosc === "malejaca" || d.populacjaStabilna === false)
  )
    flagi.push("Pułapka seniorów: wysoki udział 65+ może oznaczać wyludnianie, nie realną potrzebę — zweryfikuj trend i napięcie.");
  if (luka === null) flagi.push("Brak lokalnego czynszu rynkowego — luka i popyt zewnętrzny szacunkowe (obniżona pewność).");

  // Składniki do prezentacji (W2) + ślad fallbacków.
  const skladniki: SkladnikPopytu[] = [
    { nazwa: "Grupa docelowa", wartosc: grupa.opis, udzial: Math.round(grupa.idx * 100), fallback: grupa.fallback },
    { nazwa: "Kwalifikacja dochodowa (luka czynszowa)", wartosc: kwal.pct === null ? "szac." : `${kwal.pct}%`, udzial: Math.round(kwal.udzial * 100), fallback: kwal.fallback },
    { nazwa: "Napięcie mieszkaniowe", wartosc: `${Math.round(nap.idx * 100)}/100`, udzial: Math.round(nap.idx * 100), fallback: nap.fallback },
    { nazwa: "Napływ migracyjny", wartosc: napl.opis, udzial: Math.round(napl.idx * 100), fallback: napl.fallback },
    { nazwa: "Mnożnik usług/dostępności", wartosc: `×${mUsl.m.toFixed(2)}`, udzial: Math.round((mUsl.m - cfg.mnoznikUslug.min) / cfg.mnoznikUslug.wklad * 100), fallback: mUsl.fallback },
  ];

  const fallbacki = skladniki.filter((s) => s.fallback).length + (sila.fallback ? 1 : 0);
  const pewnosc = clamp(Math.round((1 - fallbacki / (skladniki.length + 1)) * 100));

  return {
    profil,
    wewnetrzny: w100,
    zewnetrzny: z100,
    potencjalny: Math.round(potencjalny * 100),
    realizowalny,
    mnoznikLuka: Math.round(mnoznikLuka * 100) / 100,
    mnoznikUslugi: Math.round(mUsl.m * 100) / 100,
    udzialKwalifikujacyPct: kwal.pct,
    napiecie: Math.round(nap.idx * 100),
    interpretacja,
    flagi,
    pewnosc,
    skladniki,
  };
}
