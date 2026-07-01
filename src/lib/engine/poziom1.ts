/**
 * Poziom 1 — bramki (Warstwa 0) + scoring 5 wymiarów × 2 profile.
 * Zgodny z `poziom1_scoring.md`.
 *
 * Zasady: bramki przed punktacją; dwa wyniki osobno (młodzi/seniorzy);
 * brak danych = neutralna mediana (obniża pewność, nie werdykt); skala 0–100.
 */

import type {
  BrakDanych,
  DaneDzialki,
  KluczoweLiczby,
  Profil,
  ProfilRekomendowany,
  StatusBramki,
  Sygnal,
  Werdykt,
  WynikBramki,
  WynikMetryki,
  WynikPoziom1,
  WynikWymiaru,
} from "../types";
import type { KonfiguracjaScoring } from "../config";
import { KONFIG_SCORING, KONFIG_POPYT } from "../config";
import type { WynikPopytu } from "../types";
import { ocenPopyt } from "./popyt";
import { clamp, fmt, liniowo, progi, sredniaWazona } from "./utils";

// ── Bramki (Warstwa 0) ──────────────────────────────────────────────────────

function liczBramki(d: DaneDzialki): { szczegoly: WynikBramki[]; flagi: string[] } {
  const szczegoly: WynikBramki[] = [];
  const flagi: string[] = [];

  // MPZP z przeznaczeniem budowlanym jest aktem nadrzędnym: przesądza dostęp do
  // drogi, kwestie środowiskowe/powodziowe/górnicze (plan uchwalony z SOOŚ),
  // odrolnienie/odlesienie i sąsiedztwo (WZ bezprzedmiotowe). Dlatego przy braku
  // danych te bramki NIE są „białą plamą" P1 — zostają objęte planem, a szczegóły
  // przechodzą na Poziom 2.
  const objetePlanem = d.statusPlanistyczny === "mpzp_mieszkaniowy";

  const trojstan = (
    nazwa: string,
    zrodlo: string,
    warunek: boolean | null,
    gdyTrue: StatusBramki,
    uzasadnienieTrue: string,
    uzasadnieniePass = "Brak przeciwwskazań.",
    planemObjete = false
  ): void => {
    if (warunek === null) {
      if (planemObjete)
        szczegoly.push({ nazwa, zrodlo, status: "pass", uzasadnienie: "Przesądzone w MPZP (plan budowlany) — szczegóły na Poziomie 2." });
      else szczegoly.push({ nazwa, zrodlo, status: "do_weryfikacji", uzasadnienie: "Brak danych — do weryfikacji (biała plama ≠ wykluczenie)." });
    } else if (warunek) {
      szczegoly.push({ nazwa, zrodlo, status: gdyTrue, uzasadnienie: uzasadnienieTrue });
    } else {
      szczegoly.push({ nazwa, zrodlo, status: "pass", uzasadnienie: uzasadnieniePass });
    }
  };

  trojstan(
    "Brak dostępu do drogi publicznej",
    "BDOT10k / OSM",
    d.dostepDrogaPubliczna === null ? null : !d.dostepDrogaPubliczna,
    "warunkowo",
    "Brak dostępu do drogi publicznej — możliwa służebność (flaga).",
    "Brak przeciwwskazań.",
    objetePlanem
  );
  if (d.dostepDrogaPubliczna === false) flagi.push("Brak dostępu do drogi publicznej");

  trojstan(
    "Obszar szczególnego zagrożenia powodzią",
    "ISOK / Hydroportal",
    d.ryzykoPowodzioweSzczegolne,
    "fail",
    "Działka w obszarze szczególnego zagrożenia powodzią — wykluczenie.",
    "Brak przeciwwskazań.",
    objetePlanem
  );

  // Przy MPZP budowlanym przeznaczenie budowlane jest przesądzone (odrolnienie/
  // odlesienie nastąpiło na etapie planu) — bramka nieaktywna.
  const gruntChroniony = objetePlanem
    ? false
    : d.gruntLesny === null && d.gruntRolnyKlasaIdoIII === null
      ? null
      : d.gruntLesny === true || d.gruntRolnyKlasaIdoIII === true;
  trojstan(
    "Grunt leśny (Ls) lub rolny kl. I–III bez przeznaczenia budowlanego",
    "EGiB",
    gruntChroniony,
    "warunkowo",
    "Wymaga odrolnienia/odlesienia (flaga, koszt i czas)."
  );
  if (gruntChroniony) flagi.push("Wymagane odrolnienie/odlesienie");

  trojstan(
    "Rezerwat / park narodowy / wykluczająca forma ochrony",
    "GDOŚ Geoserwis",
    d.ochronaWykluczajaca,
    "fail",
    "Wykluczająca forma ochrony przyrody.",
    "Brak przeciwwskazań.",
    objetePlanem
  );

  trojstan(
    "Natura 2000",
    "GDOŚ Geoserwis",
    d.natura2000,
    "warunkowo",
    "Obszar Natura 2000 — ograniczenia, wymagana ocena (flaga).",
    "Brak przeciwwskazań.",
    objetePlanem
  );
  if (d.natura2000 === true) flagi.push("Natura 2000");

  const gorniczeOsuwisko =
    d.terenGorniczy === null && d.osuwisko === null ? null : d.terenGorniczy === true || d.osuwisko === true;
  trojstan(
    "Teren górniczy / osuwisko (SOPO)",
    "MIDAS / SOPO",
    gorniczeOsuwisko,
    "warunkowo",
    "Teren górniczy lub osuwiskowy — ograniczenia posadowienia (flaga).",
    "Brak przeciwwskazań.",
    objetePlanem
  );
  if (gorniczeOsuwisko) flagi.push("Teren górniczy / osuwisko");

  const sprzeczne =
    d.przeznaczenieSprzeczneZMieszkaniowa === null && d.statusPlanistyczny !== "sprzeczny"
      ? null
      : d.przeznaczenieSprzeczneZMieszkaniowa === true || d.statusPlanistyczny === "sprzeczny";
  trojstan(
    "Przeznaczenie w MPZP / planie ogólnym sprzeczne z funkcją mieszkaniową",
    "KIMPZP / Rejestr Urbanistyczny",
    sprzeczne,
    "fail",
    "Przeznaczenie sprzeczne z funkcją mieszkaniową — wykluczenie.",
    "Brak przeciwwskazań.",
    objetePlanem
  );

  return { szczegoly, flagi };
}

function agregujBramki(szczegoly: WynikBramki[]): StatusBramki {
  if (szczegoly.some((s) => s.status === "fail")) return "fail";
  if (szczegoly.some((s) => s.status === "warunkowo")) return "warunkowo";
  if (szczegoly.some((s) => s.status === "do_weryfikacji")) return "do_weryfikacji";
  return "pass";
}

// ── Metryki pomocnicze ──────────────────────────────────────────────────────

function metryka(
  nazwa: string,
  wartoscRaw: number | string | null,
  punkty: number | null,
  waga: number,
  pn: number,
  profil?: Profil,
  sufiks = ""
): WynikMetryki {
  const fallback = punkty === null;
  return {
    nazwa,
    wartosc:
      wartoscRaw === null
        ? "brak danych"
        : typeof wartoscRaw === "number"
          ? fmt(wartoscRaw, sufiks, Number.isInteger(wartoscRaw) ? 0 : 1)
          : wartoscRaw,
    punkty: fallback ? pn : clamp(punkty as number),
    waga,
    fallback,
    profil,
  };
}

// ── Wymiary ─────────────────────────────────────────────────────────────────

function pulapCzynszu(d: DaneDzialki, cfg: KonfiguracjaScoring): number | null {
  if (d.wartoscOdtworzeniowaM2 === null) return null;
  return (d.wartoscOdtworzeniowaM2 * cfg.stopaPulapuCzynszu) / 12;
}

/** Luka najemcy w procentach (czynsz rynkowy vs pułap SIM) — null przy braku danych. */
function lukaPctZDanych(d: DaneDzialki, cfg: KonfiguracjaScoring): number | null {
  const pulap = pulapCzynszu(d, cfg);
  if (pulap === null || d.czynszRynkowyM2 === null || d.czynszRynkowyM2 <= 0) return null;
  return ((d.czynszRynkowyM2 - pulap) / d.czynszRynkowyM2) * 100;
}
function lukaCenowaPkt(d: DaneDzialki, cfg: KonfiguracjaScoring): number | null {
  const luka = lukaPctZDanych(d, cfg);
  if (luka === null) return null;
  return luka >= 45 ? 100 : luka >= 30 ? 80 : luka >= 15 ? 55 : luka >= 5 ? 30 : 10;
}
function lukaCenowaOpis(d: DaneDzialki, cfg: KonfiguracjaScoring): string {
  const luka = lukaPctZDanych(d, cfg);
  return luka === null ? "brak danych" : `${Math.round(luka)}%`;
}

function liczWymiary(
  d: DaneDzialki,
  cfg: KonfiguracjaScoring
): { wymiary: WynikWymiaru[]; kluczowe: KluczoweLiczby; flagiW5: string[]; popyt: { mlodzi: WynikPopytu; seniorzy: WynikPopytu } } {
  const pn = cfg.punktNeutralny;
  const flagiW5: string[] = [];

  // W1 — Dopuszczalność i otoczenie planistyczne (wspólne dla profili)
  const statusPkt =
    d.statusPlanistyczny === "mpzp_mieszkaniowy"
      ? 100
      : d.statusPlanistyczny === "plan_ogolny_sprzyjajacy" || d.statusPlanistyczny === "ouz"
        ? 75
        : d.statusPlanistyczny === "sprzeczny"
          ? 10
          : null; // brak_danych → fallback
  const mStatus = metryka(
    "Status planistyczny",
    d.statusPlanistyczny === "brak_danych" ? null : d.statusPlanistyczny,
    statusPkt,
    0.6,
    pn
  );
  // Przy MPZP budowlanym kryterium „dobrego sąsiedztwa"/WZ jest bezprzedmiotowe
  // (WZ wydaje się tylko wobec braku planu) — nie traktujemy go jako białej plamy.
  const mSasiedztwo =
    d.statusPlanistyczny === "mpzp_mieszkaniowy"
      ? metryka("Spójność z zabudową sąsiedztwa (dobre sąsiedztwo / WZ)", "MPZP — kryterium bezprzedmiotowe", 100, 0.4, pn)
      : metryka(
          "Spójność z zabudową sąsiedztwa (dobre sąsiedztwo / WZ)",
          d.zabudowaMieszkaniowaWSasiedztwie === null ? null : d.zabudowaMieszkaniowaWSasiedztwie ? "mieszkaniowa w sąsiedztwie" : "brak",
          d.zabudowaMieszkaniowaWSasiedztwie === null ? null : d.zabudowaMieszkaniowaWSasiedztwie ? 100 : 30,
          0.4,
          pn
        );
  const w1Metryki = [mStatus, mSasiedztwo];
  const w1 = sredniaWazona(w1Metryki);

  // W2 — Popyt (pod-model: wewnętrzny + zewnętrzny × mnożniki), zob. popyt.ts.
  const popytMlodzi = ocenPopyt(d, "mlodzi", cfg, KONFIG_POPYT);
  const popytSeniorzy = ocenPopyt(d, "seniorzy", cfg, KONFIG_POPYT);
  const w2Mlodzi = popytMlodzi.realizowalny;
  const w2Seniorzy = popytSeniorzy.realizowalny;

  // Metryka pomocnicza budująca wiersz W2 z komponentu popytu (fallback = brak danych).
  const mPop = (nazwa: string, wartosc: string, punkty: number, profil: Profil | undefined, fallback: boolean): WynikMetryki => ({
    nazwa,
    wartosc: fallback ? `${wartosc} (szac.)` : wartosc,
    punkty: fallback ? pn : clamp(punkty),
    waga: 1,
    fallback,
    profil,
  });
  const skl = (p: WynikPopytu, n: string) => p.skladniki.find((s) => s.nazwa.startsWith(n));
  const w2Metryki: WynikMetryki[] = [
    mPop("Popyt realizowalny", `${popytMlodzi.realizowalny}/100`, popytMlodzi.realizowalny, "mlodzi", false),
    mPop("· wewnętrzny / zewnętrzny", `${popytMlodzi.wewnetrzny} / ${popytMlodzi.zewnetrzny}`, popytMlodzi.potencjalny, "mlodzi", false),
    mPop("Popyt realizowalny ", `${popytSeniorzy.realizowalny}/100`, popytSeniorzy.realizowalny, "seniorzy", false),
    mPop("· wewnętrzny / zewnętrzny ", `${popytSeniorzy.wewnetrzny} / ${popytSeniorzy.zewnetrzny}`, popytSeniorzy.potencjalny, "seniorzy", false),
    mPop(
      "Kwalifikacja dochodowa (luka czynszowa)",
      popytMlodzi.udzialKwalifikujacyPct === null ? "brak danych" : `${popytMlodzi.udzialKwalifikujacyPct}%`,
      popytMlodzi.udzialKwalifikujacyPct ?? pn,
      undefined,
      skl(popytMlodzi, "Kwalifikacja")?.fallback ?? false
    ),
    mPop("Napięcie mieszkaniowe", `${popytMlodzi.napiecie}/100`, popytMlodzi.napiecie, undefined, skl(popytMlodzi, "Napięcie")?.fallback ?? false),
    mPop(
      "Napływ migracyjny (25–39)",
      skl(popytMlodzi, "Napływ")?.wartosc ?? "—",
      skl(popytMlodzi, "Napływ")?.udzial ?? pn,
      "mlodzi",
      skl(popytMlodzi, "Napływ")?.fallback ?? false
    ),
    mPop("Luka cenowa (czynsz vs pułap)", lukaCenowaOpis(d, cfg), lukaCenowaPkt(d, cfg) ?? pn, undefined, lukaCenowaPkt(d, cfg) === null),
  ];

  // W3 — Dostępność komunikacyjna
  const dojazdPkt =
    d.czasDojazdAglomeracjaMin === null
      ? null
      : progi(d.czasDojazdAglomeracjaMin, [{ max: 30, pkt: 100 }, { max: 45, pkt: 70 }, { max: 60, pkt: 40 }], 15);
  const mDojazd = metryka("Czas dojazdu do centrum aglomeracji", d.czasDojazdAglomeracjaMin, dojazdPkt, 0.65, pn, "mlodzi", " min");
  const mPrzystanek = metryka(
    "Przystanek z sensowną częstotliwością (≤800 m)",
    d.przystanekZCzestotliwoscia === null ? null : d.przystanekZCzestotliwoscia ? "jest" : "brak",
    d.przystanekZCzestotliwoscia === null ? null : d.przystanekZCzestotliwoscia ? 100 : 25,
    0.35,
    pn,
    "mlodzi"
  );
  const mUslugiPieszo = metryka(
    "Bliskość uzbrojonej tkanki z usługami (pieszo)",
    d.uslugiPodstawowePieszo === null ? null : d.uslugiPodstawowePieszo ? "w zasięgu spaceru" : "izolacja",
    d.uslugiPodstawowePieszo === null ? null : d.uslugiPodstawowePieszo ? 100 : 20,
    0.7,
    pn,
    "seniorzy"
  );
  const w3Metryki = [mDojazd, mPrzystanek, mUslugiPieszo];
  const w3Mlodzi = sredniaWazona([
    { punkty: mDojazd.punkty, waga: mDojazd.waga },
    { punkty: mPrzystanek.punkty, waga: mPrzystanek.waga },
  ]);
  const w3Seniorzy = sredniaWazona([
    { punkty: mUslugiPieszo.punkty, waga: mUslugiPieszo.waga },
    { punkty: mDojazd.punkty, waga: 0.3 },
  ]);

  // W4 — Teren i proxy kosztów uzbrojenia (spadek silniej karze seniorów)
  const spadekMlodziPkt =
    d.sredniSpadekPct === null
      ? null
      : progi(d.sredniSpadekPct, [{ max: 3, pkt: 100 }, { max: 8, pkt: 75 }, { max: 12, pkt: 45 }], 20);
  const spadekSeniorzyPkt =
    d.sredniSpadekPct === null
      ? null
      : progi(d.sredniSpadekPct, [{ max: 3, pkt: 100 }, { max: 8, pkt: 60 }, { max: 12, pkt: 25 }], 10);
  const mSpadekM = metryka("Średni spadek terenu", d.sredniSpadekPct, spadekMlodziPkt, 0.4, pn, "mlodzi", "%");
  const mSpadekS = metryka("Średni spadek terenu (ostrzej dla seniorów)", d.sredniSpadekPct, spadekSeniorzyPkt, 0.4, pn, "seniorzy", "%");
  const odl = d.odlegloscDoZabudowyM ?? d.odlegloscDoSieciM;
  const odlPkt = odl === null ? null : progi(odl, [{ max: 50, pkt: 100 }, { max: 300, pkt: 70 }, { max: 500, pkt: 40 }], 15);
  const mOdl = metryka("Odległość do zabudowy/sieci (proxy przyłączy)", odl, odlPkt, 0.35, pn, undefined, " m");
  let powPkt: number | null = liniowo(d.powierzchniaM2, 500, 1500, 20, 100);
  if (d.proporcjaBokow !== null && d.proporcjaBokow > 2.5) powPkt = powPkt * 0.8;
  const mPow = metryka("Powierzchnia/kształt — czy mieści program wielorodzinny", d.powierzchniaM2, powPkt, 0.25, pn, undefined, " m²");
  const w4Metryki = [mSpadekM, mSpadekS, mOdl, mPow];
  const w4Mlodzi = sredniaWazona([
    { punkty: mSpadekM.punkty, waga: mSpadekM.waga },
    { punkty: mOdl.punkty, waga: mOdl.waga },
    { punkty: mPow.punkty, waga: mPow.waga },
  ]);
  const w4Seniorzy = sredniaWazona([
    { punkty: mSpadekS.punkty, waga: mSpadekS.waga },
    { punkty: mOdl.punkty, waga: mOdl.waga },
    { punkty: mPow.punkty, waga: mPow.waga },
  ]);

  // W5 — Luka dostępności cenowej / ekonomia SIM (wspólne dla profili)
  const pulap = pulapCzynszu(d, cfg);
  let lukaPkt: number | null = null;
  let lukaPct: number | null = null;
  if (pulap !== null && d.czynszRynkowyM2 !== null && d.czynszRynkowyM2 > 0) {
    lukaPct = ((d.czynszRynkowyM2 - pulap) / d.czynszRynkowyM2) * 100;
    lukaPkt =
      lukaPct >= 45 ? 100 : lukaPct >= 30 ? 80 : lukaPct >= 15 ? 55 : lukaPct >= 5 ? 30 : 10;
  }
  const mLuka = metryka(
    "Luka najemcy (czynsz rynkowy vs pułap SIM)",
    lukaPct === null ? null : fmt(lukaPct, "%", 0),
    lukaPkt,
    cfg.w5Udzialy.lukaNajemcy,
    pn
  );

  // wykonalność: koszt budowy (lub cena nowych + wykończenie) / wartość odtworzeniowa
  const kosztM2 = d.kosztBudowyM2 ?? (d.cenaNowychM2 !== null ? d.cenaNowychM2 - 2000 + 1800 : null); // korekta wykończenia
  let relacjaPct: number | null = null;
  let wykonPkt: number | null = null;
  if (kosztM2 !== null && d.wartoscOdtworzeniowaM2 !== null && d.wartoscOdtworzeniowaM2 > 0) {
    relacjaPct = (kosztM2 / d.wartoscOdtworzeniowaM2) * 100;
    wykonPkt = relacjaPct <= 110 ? 100 : relacjaPct <= 130 ? 70 : relacjaPct <= 160 ? 40 : 15;
    if (relacjaPct > cfg.progFlagaWysokaDotacjaPct) flagiW5.push("Wysoka dotacja / ryzyko rentowności");
  }
  const mWykon = metryka(
    "Wymagana dotacja (koszt vs wartość odtworzeniowa)",
    relacjaPct === null ? null : fmt(relacjaPct, "%", 0),
    wykonPkt,
    cfg.w5Udzialy.wykonalnosc,
    pn
  );
  const w5Metryki = [mLuka, mWykon];
  const w5 = sredniaWazona([
    { punkty: mLuka.punkty, waga: mLuka.waga },
    { punkty: mWykon.punkty, waga: mWykon.waga },
  ]);

  const wymiary: WynikWymiaru[] = [
    {
      kod: "W1",
      nazwa: "Dopuszczalność i otoczenie planistyczne",
      punktyMlodzi: w1,
      punktySeniorzy: w1,
      wagaMlodzi: cfg.wagiWymiarow.mlodzi.W1,
      wagaSeniorzy: cfg.wagiWymiarow.seniorzy.W1,
      metryki: w1Metryki,
    },
    {
      kod: "W2",
      nazwa: "Popyt (wewnętrzny + zewnętrzny)",
      punktyMlodzi: w2Mlodzi,
      punktySeniorzy: w2Seniorzy,
      wagaMlodzi: cfg.wagiWymiarow.mlodzi.W2,
      wagaSeniorzy: cfg.wagiWymiarow.seniorzy.W2,
      metryki: w2Metryki,
    },
    {
      kod: "W3",
      nazwa: "Dostępność komunikacyjna",
      punktyMlodzi: w3Mlodzi,
      punktySeniorzy: w3Seniorzy,
      wagaMlodzi: cfg.wagiWymiarow.mlodzi.W3,
      wagaSeniorzy: cfg.wagiWymiarow.seniorzy.W3,
      metryki: w3Metryki,
    },
    {
      kod: "W4",
      nazwa: "Teren i proxy kosztów uzbrojenia",
      punktyMlodzi: w4Mlodzi,
      punktySeniorzy: w4Seniorzy,
      wagaMlodzi: cfg.wagiWymiarow.mlodzi.W4,
      wagaSeniorzy: cfg.wagiWymiarow.seniorzy.W4,
      metryki: w4Metryki,
    },
    {
      kod: "W5",
      nazwa: "Luka dostępności cenowej / ekonomia SIM",
      punktyMlodzi: w5,
      punktySeniorzy: w5,
      wagaMlodzi: cfg.wagiWymiarow.mlodzi.W5,
      wagaSeniorzy: cfg.wagiWymiarow.seniorzy.W5,
      metryki: w5Metryki,
    },
  ];

  const kluczowe: KluczoweLiczby = {
    pulapCzynszuSimM2: pulap === null ? null : Math.round(pulap * 10) / 10,
    czynszRynkowyM2: d.czynszRynkowyM2,
    lukaNajemcyPct: lukaPct === null ? null : Math.round(lukaPct),
    relacjaKosztDoWartOdtworzeniowejPct: relacjaPct === null ? null : Math.round(relacjaPct),
    czasDojazdAglomeracjaMin: d.czasDojazdAglomeracjaMin,
    sredniSpadekPct: d.sredniSpadekPct,
  };

  return { wymiary, kluczowe, flagiW5, popyt: { mlodzi: popytMlodzi, seniorzy: popytSeniorzy } };
}

// ── Agregacja, werdykt, pewność ─────────────────────────────────────────────

function werdyktZPunktow(score: number, cfg: KonfiguracjaScoring): Werdykt {
  if (score >= cfg.pasma.zielony) return "zielony";
  if (score >= cfg.pasma.zolty) return "zolty";
  return "czerwony";
}

function nalozBramki(w: Werdykt, statusBramek: StatusBramki): Werdykt {
  if (statusBramek === "fail") return "czerwony";
  if (statusBramek === "warunkowo" && w === "zielony") return "zolty";
  return w;
}

function profilRekomendowany(
  scoreM: number,
  scoreS: number,
  cfg: KonfiguracjaScoring
): ProfilRekomendowany {
  if (scoreM < cfg.pasma.zolty && scoreS < cfg.pasma.zolty) return "zaden";
  if (scoreM >= cfg.pasma.zielony && scoreS >= cfg.pasma.zielony && Math.abs(scoreM - scoreS) <= 10) return "oba";
  return scoreM >= scoreS ? "mlodzi" : "seniorzy";
}

// ── Flagi/sygnały + realne białe plamy (panele wyniku P1) ───────────────────

/** Flagi i sygnały: ostrzeżenia z bramek + pozytywy z dostępności/rynku. */
function liczSygnaly(d: DaneDzialki, szczegoly: WynikBramki[], cfg: KonfiguracjaScoring): Sygnal[] {
  const s: Sygnal[] = [];
  for (const b of szczegoly) {
    if (b.status === "fail" || b.status === "warunkowo") s.push({ tekst: b.nazwa, ton: "ostrzezenie" });
  }
  const poz = (w: boolean | null, tekst: string) => {
    if (w === true) s.push({ tekst, ton: "pozytyw" });
  };
  poz(d.przystanekZCzestotliwoscia, "Przystanek z sensowną częstotliwością (≤800 m)");
  poz(d.zlobkiSzkolyWZasiegu, "Szkoła / żłobek w zasięgu");
  poz(d.pozWZasiegu, "POZ w zasięgu");
  poz(d.uslugiPodstawowePieszo, "Usługi podstawowe pieszo");
  if (d.statusPlanistyczny !== "mpzp_mieszkaniowy") poz(d.zabudowaMieszkaniowaWSasiedztwie, "Zabudowa mieszkaniowa w sąsiedztwie");
  if (d.statusPlanistyczny === "brak_danych" && d.mpzpZadeklarowany !== true)
    s.push({ tekst: "Brak MPZP — biała plama planistyczna", ton: "ostrzezenie" });
  const luka = lukaPctZDanych(d, cfg);
  if (luka !== null && luka >= 30) s.push({ tekst: `Wysoka luka cenowa (${Math.round(luka)}%) — realny popyt na najem społeczny`, ton: "pozytyw" });
  return s;
}

/**
 * Realne białe plamy — czego aplikacja faktycznie nie pobrała dla tej działki.
 * Źródła: brak MPZP, bramki „do weryfikacji" (warstwy niepodłączone/bez danych),
 * brak czynszu rynkowego oraz pozostałe metryki na fallbacku (biała plama).
 */
function liczBraki(d: DaneDzialki, wymiary: WynikWymiaru[], szczegoly: WynikBramki[]): BrakDanych[] {
  const braki: BrakDanych[] = [];
  const ujete = new Set<string>();

  if (d.statusPlanistyczny === "brak_danych" && d.mpzpZadeklarowany !== true) {
    braki.push({
      tytul: "MPZP / Studium uwarunkowań",
      opis: `Brak cyfrowego planu dla obrębu ${d.gmina || "—"}`,
      wplyw: "pewność przeznaczenia obniżona (fallback z sąsiedztwa)",
    });
    ujete.add("Status planistyczny");
  }
  // Deklaracja MPZP „zamyka" pytanie planistyczne — nie raportujemy metryki statusu jako braku.
  if (d.mpzpZadeklarowany === true) ujete.add("Status planistyczny");
  if (d.czynszRynkowyM2 === null) {
    braki.push({
      tytul: "Rynek najmu (czynsze długoterminowe)",
      opis: "Brak ofert długoterminowych w zasięgu drabiny przestrzennej",
      wplyw: "luka cenowa i popyt zewnętrzny szacunkowe",
    });
    ujete.add("Luka najemcy (czynsz rynkowy vs pułap SIM)");
    ujete.add("Luka cenowa (czynsz vs pułap)");
  }
  // Warstwy, których źródła nie są podłączone / bez danych (bramki „do weryfikacji").
  for (const b of szczegoly)
    if (b.status === "do_weryfikacji")
      braki.push({ tytul: b.nazwa, opis: `${b.zrodlo} — źródło niepodłączone lub brak danych`, wplyw: "bramka: do weryfikacji (nie wyklucza)" });

  // Pozostałe białe plamy w metrykach (unikalne, poza już ujętymi).
  const fallbacki = new Set<string>();
  for (const w of wymiary) for (const m of w.metryki) if (m.fallback) fallbacki.add(m.nazwa);
  for (const nazwa of fallbacki)
    if (!ujete.has(nazwa)) braki.push({ tytul: nazwa, opis: "Biała plama — brak danych wejściowych", wplyw: "obniża pewność analizy" });

  return braki;
}

export function uruchomPoziom1(d: DaneDzialki, cfg: KonfiguracjaScoring = KONFIG_SCORING): WynikPoziom1 {
  const { szczegoly, flagi: flagiBramek } = liczBramki(d);
  const statusBramek = agregujBramki(szczegoly);

  const { wymiary, kluczowe, flagiW5, popyt } = liczWymiary(d, cfg);

  // Wynik profilu = Σ(waga × wynik wymiaru) ÷ 100
  const scoreMlodzi = clamp(
    wymiary.reduce((s, w) => s + w.wagaMlodzi * w.punktyMlodzi, 0) /
      wymiary.reduce((s, w) => s + w.wagaMlodzi, 0)
  );
  const scoreSeniorzy = clamp(
    wymiary.reduce((s, w) => s + w.wagaSeniorzy * w.punktySeniorzy, 0) /
      wymiary.reduce((s, w) => s + w.wagaSeniorzy, 0)
  );

  let werdyktMlodzi = nalozBramki(werdyktZPunktow(scoreMlodzi, cfg), statusBramek);
  let werdyktSeniorzy = nalozBramki(werdyktZPunktow(scoreSeniorzy, cfg), statusBramek);

  // Flaga wysokiej dotacji obniża werdykt o jeden poziom (poziom1_scoring.md §3 W5)
  const obnizOPoziom = (w: Werdykt): Werdykt => (w === "zielony" ? "zolty" : w === "zolty" ? "czerwony" : w);
  if (flagiW5.includes("Wysoka dotacja / ryzyko rentowności")) {
    werdyktMlodzi = obnizOPoziom(werdyktMlodzi);
    werdyktSeniorzy = obnizOPoziom(werdyktSeniorzy);
  }

  const profil = statusBramek === "fail" ? "zaden" : profilRekomendowany(scoreMlodzi, scoreSeniorzy, cfg);
  const werdykt =
    statusBramek === "fail"
      ? "czerwony"
      : profil === "seniorzy"
        ? werdyktSeniorzy
        : werdyktMlodzi;

  // Pewność = udział metryk i bramek opartych na realnych danych
  const metrykiUnikalne = new Map<string, boolean>();
  for (const w of wymiary) for (const m of w.metryki) metrykiUnikalne.set(m.nazwa, m.fallback);
  const fallbackMetryk = [...metrykiUnikalne.values()].filter(Boolean).length;
  const bramkiBezDanych = szczegoly.filter((s) => s.status === "do_weryfikacji").length;
  const total = metrykiUnikalne.size + szczegoly.length;
  const realne = total - fallbackMetryk - bramkiBezDanych;
  const pewnosc = clamp(Math.round((realne / total) * 100));

  // Flagi popytu: bierzemy z rekomendowanego profilu (lub obu, gdy „oba").
  const flagiPopytu =
    profil === "seniorzy" ? popyt.seniorzy.flagi : profil === "oba" ? [...popyt.mlodzi.flagi, ...popyt.seniorzy.flagi] : popyt.mlodzi.flagi;
  const flagi = [...new Set([...flagiBramek, ...flagiW5, ...flagiPopytu])];

  const sygnaly = liczSygnaly(d, szczegoly, cfg);
  const braki = liczBraki(d, wymiary, szczegoly);

  return {
    dzialkaId: d.id,
    bramki: { status: statusBramek, flagi: flagiBramek, szczegoly },
    scoreMlodzi: Math.round(scoreMlodzi),
    scoreSeniorzy: Math.round(scoreSeniorzy),
    profilRekomendowany: profil,
    werdyktMlodzi,
    werdyktSeniorzy,
    werdykt,
    pewnosc,
    wymiary,
    kluczoweLiczby: kluczowe,
    flagi,
    popyt,
    sygnaly,
    braki,
  };
}
