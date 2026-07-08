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

import type { DaneDzialki, Dostepnosc, OcenaM2, Profil, StatusBramki, Werdykt, WerdyktProfiluM2, WynikPoziom1 } from "../types";
import type { KonfiguracjaM2, ProgUslugi } from "../config";
import { KONFIG_M2 } from "../config";
import { clamp, clamp01 } from "./utils";

const pasmo = (s: number): Werdykt => (s >= 65 ? "zielony" : s >= 40 ? "zolty" : "czerwony");

/** Etykieta usługi z konfiguracji (fallback do klucza). */
function etykietaUslugi(klucz: string, cfg: KonfiguracjaM2): string {
  return cfg.odleglosciPieszo.find((o) => o.klucz === klucz)?.etykieta ?? klucz;
}

const clampBonus = (v: number) => Math.max(0, Math.min(1, v));

/** Etykiety usług pieszo (kanał A) do panelu dostępności. */
const ETYKIETY_USLUG: Record<string, string> = {
  poz: "Przychodnia (POZ)",
  apteka: "Apteka",
  sklep: "Sklep spożywczy",
  szkola: "Szkoła",
  przedszkole: "Przedszkole / żłobek",
};

/**
 * Buduje dane dostępności do PANELU TEKSTOWEGO (odległości + progi + status per usługa).
 * status: `komfort` (≤ komfort), `gradient` (między), `bramka` (≥ dyskwalifikacja — dyskwalifikuje
 * profil), `brak` (nieustalona — pytana ręcznie, niższa pewność; NIE dyskwalifikuje). Czysta funkcja.
 */
export function liczDostepnosc(d: DaneDzialki, cfg: KonfiguracjaM2 = KONFIG_M2): Dostepnosc {
  const pozycje: Dostepnosc["pozycje"] = [];
  // Usługi pieszo (bramka kanału A) — mogą dyskwalifikować.
  for (const [klucz, prog] of Object.entries(cfg.progiUslug)) {
    const m = d.odleglosciM2?.[klucz] ?? null;
    const profile = (["mlodzi", "seniorzy"] as Profil[]).filter((p) => prog[p]);
    let status: "komfort" | "gradient" | "bramka" | "daleko" | "brak" = "brak";
    if (m != null) {
      status = "komfort";
      for (const p of profile) {
        const pr = prog[p]!;
        if (m >= pr.dyskwalifikacjaM) { status = "bramka"; break; }
        if (m > pr.komfortM) status = "gradient";
      }
    }
    const repr = prog.seniorzy ?? prog.mlodzi ?? null;
    pozycje.push({ klucz, etykieta: ETYKIETY_USLUG[klucz] ?? klucz, m, typ: "bramka", profile, progi: repr ? { komfortM: repr.komfortM, dyskwalifikacjaM: repr.dyskwalifikacjaM } : null, status });
  }
  // Otoczenie / jakość życia (modyfikator) — nigdy nie dyskwalifikuje (blisko/w zasięgu/daleko).
  const oc = cfg.otoczenie;
  for (const klucz of oc.kategorie) {
    const m = d.odleglosciM2?.[klucz] ?? null;
    const profile = (["mlodzi", "seniorzy"] as Profil[]).filter((p) => (oc.wagi[p]?.[klucz] ?? 0) > 0);
    let status: "komfort" | "gradient" | "bramka" | "daleko" | "brak" = "brak";
    if (m != null) status = m <= oc.komfortM ? "komfort" : m <= oc.zerM ? "gradient" : "daleko";
    pozycje.push({ klucz, etykieta: oc.etykiety[klucz] ?? klucz, m, typ: "modyfikator", profile, progi: { komfortM: oc.komfortM, dyskwalifikacjaM: oc.zerM }, status });
  }
  return { pozycje };
}

/**
 * Transport zbiorowy — ŁAGODNY modyfikator jakości per profil (wytyczne panel_transport §2–§3).
 * NIE bramka i NIGDY kara: „nie ma"/pominięte/brak przystanków → mnożnik 1,0 (neutralny).
 * „Jest" → bonus (do `maxBonus`) z walkability (najbliższy przystanek) i jakości obsługi
 * (najlepszy przystanek: linie × kursy/dzień; kursy nocne = mała waga, głównie młodzi).
 * Seniorzy ważą walkability mocniej. Zła obsługa = mniejszy bonus, nigdy odjęcie/odrzucenie.
 */
export function modyfikatorTransportu(d: DaneDzialki, profil: Profil, cfg: KonfiguracjaM2 = KONFIG_M2): { mnoznik: number; powody: string[] } {
  const t = d.transport;
  const przystanki = t?.jest ? (t.przystanki ?? []).filter((p) => p.odlegloscM != null || p.liczbaLinii != null || p.kursyDzien != null) : [];
  if (!t?.jest || przystanki.length === 0) return { mnoznik: 1, powody: [] };
  const c = cfg.transport;
  const w = c.wagi[profil];

  // Walkability z NAJBLIŻSZEGO przystanku; jakość z NAJLEPSZEGO (najwięcej linii × kursów/dzień).
  const odl = przystanki.map((p) => p.odlegloscM).filter((v): v is number => v != null);
  const najblizszy = odl.length ? Math.min(...odl) : null;
  const walk = najblizszy == null ? 0.5 : clampBonus((c.walkZerM[profil] - najblizszy) / (c.walkZerM[profil] - c.walkKomfortM[profil]));

  const najlepszy = przystanki.reduce((a, b) => ((b.liczbaLinii ?? 0) * (b.kursyDzien ?? 0) >= (a.liczbaLinii ?? 0) * (a.kursyDzien ?? 0) ? b : a));
  const jakosc = clampBonus(0.5 * clampBonus((najlepszy.liczbaLinii ?? 0) / c.liniiPelna) + 0.5 * clampBonus((najlepszy.kursyDzien ?? 0) / c.kursyDzienPelna));
  const noc = clampBonus((najlepszy.kursyNoc ?? 0) / Math.max(1, c.kursyDzienPelna / 4));

  const sygnal = clampBonus(w.walk * walk + w.jakosc * jakosc + w.noc * noc);
  const mnoznik = Math.round((1 + c.maxBonus * sygnal) * 100) / 100;
  const powody: string[] = [];
  if (mnoznik > 1) powody.push(`Transport: najbliższy przystanek ${najblizszy ?? "?"} m, najlepszy ${najlepszy.liczbaLinii ?? 0} linii / ${najlepszy.kursyDzien ?? 0} kursów/dzień → +${Math.round((mnoznik - 1) * 100)}% popytu (jakość, nie bramka).`);
  return { mnoznik, powody };
}

/**
 * Otoczenie / jakość życia — ŁAGODNY modyfikator per profil (zieleń, plac zabaw, poczta, bank).
 * NIE bramka i NIGDY kara: brak obiektu = brak bonusu (mnożnik ≥ 1). Bonus wg walkability
 * (najbliższy obiekt kategorii) i wag per profil (młodzi: zieleń/plac zabaw; seniorzy: poczta/bank).
 */
export function modyfikatorOtoczenia(d: DaneDzialki, profil: Profil, cfg: KonfiguracjaM2 = KONFIG_M2): { mnoznik: number; powody: string[] } {
  const c = cfg.otoczenie;
  const wagi = c.wagi[profil];
  let sygnal = 0;
  const bliskie: string[] = [];
  for (const kat of c.kategorie) {
    const w = wagi[kat] ?? 0;
    if (w <= 0) continue;
    const m = d.odleglosciM2?.[kat];
    if (m == null) continue; // brak → neutralne (nie kara)
    const walk = clampBonus((c.zerM - m) / (c.zerM - c.komfortM));
    sygnal += w * walk;
    if (m <= c.zerM) bliskie.push(`${c.etykiety[kat] ?? kat} ~${m} m`);
  }
  const mnoznik = Math.round((1 + c.maxBonus * clampBonus(sygnal)) * 100) / 100;
  const powody = mnoznik > 1 ? [`Otoczenie: ${bliskie.join(", ")} → +${Math.round((mnoznik - 1) * 100)}% popytu (jakość życia, nie bramka).`] : [];
  return { mnoznik, powody };
}

/** Pozytywne sygnały otoczenia (do raportu): obiekty jakości życia w zasięgu spaceru. */
export function sygnalyOtoczenia(d: DaneDzialki, cfg: KonfiguracjaM2 = KONFIG_M2): string[] {
  const c = cfg.otoczenie;
  const out: string[] = [];
  for (const kat of c.kategorie) {
    const m = d.odleglosciM2?.[kat];
    if (m != null && m <= c.komfortM) out.push(`${c.etykiety[kat] ?? kat} w zasięgu spaceru (~${m} m)`);
  }
  return out;
}

/**
 * Flaga transportowa (wytyczne panel_transport §2.1, §5): „Nie ma" komunikacji → INFORMACYJNA
 * flaga „teren bez komunikacji zbiorowej", NIGDY odjęcie punktów, mocniej eksponowana dla
 * seniorów. Pominięcie/brak danych → bez flagi (nie wiemy — tylko niższa pewność).
 */
export function flagiTransportu(d: DaneDzialki): string[] {
  if (d.transport?.jest !== false) return [];
  return ["Teren bez komunikacji zbiorowej — informacyjnie, nie obniża oceny (istotne dla seniorów)"];
}

/**
 * Kanał A — obsługiwalność per profil (spec §4): każda krytyczna usługa PIESZO ma WŁASNE
 * progi (komfort, dyskwalifikacja). f_usługi = 1,0 (≤ komfort) → `minFaktorUslugi`
 * (liniowo do dyskwalifikacji); ≥ dyskwalifikacja = BRAMKA (weakest-link → mnożnik 0).
 * Braki NIE dyskwalifikują (unknown ≠ far) — schodzą tylko na pewność (F).
 * Transport zbiorowy NIE jest tu bramką (panel ręczny → modyfikator, patrz `modyfikatorTransportu`).
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
  // UWAGA (3.1): trend ludności i pustostany NIE wchodzą tu ponownie — są już
  // liczone w napięciu mieszkaniowym M1 (sygnał popytu gminnego, nie lokalizacji).
  // Podwójne liczenie usunięte, by jeden sygnał demograficzny nie uderzał dwa razy.
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
  // 2.1 Dane KRYTYCZNE niezweryfikowane (bramki „do weryfikacji": środowisko/MPZP/
  // droga) → CAP: zielony wynik wstrzymany (max „żółty/warunkowy") do potwierdzenia.
  // Nie zeruje score — tylko blokuje zielony (biała plama danych krytycznych ≠ ryzyko OK).
  const capDoWeryfikacji = dopuszczalnosc === "do_weryfikacji";

  const werdyktProfilu = (profil: Profil): WerdyktProfiluM2 => {
    const popytM1 = profil === "mlodzi" ? p1.scoreMlodzi : p1.scoreSeniorzy;
    const A = dostepnoscA(d, profil, cfg);
    const C = modyfikatorPopytuC(d, profil, cfg);
    const T = modyfikatorTransportu(d, profil, cfg); // łagodny bonus jakości transportu (nie bramka)
    const O = modyfikatorOtoczenia(d, profil, cfg); // łagodny bonus jakości otoczenia (nie bramka)
    const popytRealizowalny = clamp(Math.round(popytM1 * A.mnoznik * C.mnoznik * T.mnoznik * O.mnoznik));
    const ekonFaktor = 0.7 + 0.3 * (przydat.wartosc / 100); // B skaluje, nie zeruje
    let score = clamp(Math.round(popytRealizowalny * ekonFaktor));
    const powody = [...A.powody, ...C.powody, ...T.powody, ...O.powody, ...przydat.powody];
    if (!A.obsluzalny) {
      score = 0;
      powody.unshift("Profil nieobsługiwalny — usługi poza zasięgiem (kanał A).");
    }
    if (!dopuszczalny) {
      score = 0;
      powody.unshift("Bramka bezwzględna — działka niedopuszczalna (kanał E).");
    }
    // CAP zielonego przy niezweryfikowanych danych krytycznych (2.1).
    let werdykt = pasmo(score);
    if (capDoWeryfikacji && werdykt === "zielony") {
      werdykt = "zolty";
      powody.unshift("Wynik wstrzymany na warunkowym — dane krytyczne (środowisko/MPZP/droga) wymagają weryfikacji; zielony po potwierdzeniu.");
    }
    return {
      profil,
      popytM1,
      dostepnoscA: A.mnoznik,
      modyfikatorC: C.mnoznik,
      popytRealizowalny,
      przydatnoscEkonomiczna: przydat.wartosc,
      score,
      werdykt,
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
  return { werdykty, dopuszczalnosc, rekomendacja, powodBrak, flagi: flagiTransportu(d) };
}
