/**
 * Warstwa konfiguracji — parametry edytowalne POZA kodem.
 *
 * Zasada przekrojowa #6 (architektura_aplikacji.md): "Parametry w konfiguracji,
 * nie w kodzie. Progi, wagi, wskaźniki i parametry programów są edytowalne — bo
 * się zmieniają."
 *
 * Rozdział tempa zmian (sekcja 7 architektury):
 *  - Scoring P1: progi/wagi — zmiana po kalibracji
 *  - Zabudowa P2: efektywność, metraże, parking — rzadko
 *  - Finanse P3: % grantu, kredyt, oprocentowanie, pułap, indeksy — co rok / co nowelizację
 */

import type { FormaZabudowy, KluczWerdyktu, Profil, Rezim } from "./types";

/**
 * Bramki środowiskowe (Natura 2000, powódź, wykluczająca ochrona, osuwiska/teren górniczy)
 * — ZAPARKOWANE. Źródła WMS (GDOŚ Geoserwis, ISOK/Hydroportal, PIG-PIB SOPO, NID) są obecnie
 * niedostępne (timeout/HTTP/WAF Incapsula), więc te dane NIE wchodzą do analizy M1 ani M2.
 * Ustaw `true`, gdy źródła znów działają — logika bramek wróci bez innych zmian.
 */
export const BRAMKI_SRODOWISKOWE_AKTYWNE = false;

// ── POZIOM 1: progi i wagi ──────────────────────────────────────────────────

export interface KonfiguracjaScoring {
  /** Pasma werdyktu (per profil) — kalibrowalne. */
  pasma: { zielony: number; zolty: number };
  /** Wagi wymiarów per profil (suma = 100). */
  wagiWymiarow: Record<Profil, { W1: number; W2: number; W3: number; W4: number; W5: number }>;
  /** Udział sygnałów w W5: luka najemcy vs wykonalność. */
  w5Udzialy: { lukaNajemcy: number; wykonalnosc: number };
  /** Pułap czynszu SIM = wartość odtworzeniowa × stopa ÷ 12. */
  stopaPulapuCzynszu: number; // np. 0.05 (5%) — 0.04 dla starszych kredytów
  /** Punkt neutralny (mediana) używany przy braku danej. */
  punktNeutralny: number;
  /** Próg flagi wysokiej dotacji (relacja koszt/wart. odtworzeniowa). */
  progFlagaWysokaDotacjaPct: number;
}

export const KONFIG_SCORING: KonfiguracjaScoring = {
  pasma: { zielony: 70, zolty: 45 },
  wagiWymiarow: {
    mlodzi: { W1: 10, W2: 20, W3: 25, W4: 15, W5: 30 },
    seniorzy: { W1: 10, W2: 25, W3: 15, W4: 20, W5: 30 },
  },
  w5Udzialy: { lukaNajemcy: 0.6, wykonalnosc: 0.4 },
  stopaPulapuCzynszu: 0.05,
  punktNeutralny: 50,
  progFlagaWysokaDotacjaPct: 160,
};

// ── POZIOM 1 (rewizja): pojemność zabudowy × popyt → werdykt ────────────────

export interface KonfiguracjaPoziom1 {
  /** Pasma werdyktu dopasowania pojemność↔popyt (per profil). */
  pasma: { zielony: number; zolty: number };
  /** Liczba mieszkań uznawana za „pełną" wykonalność projektu społecznego. */
  progMieszkanViable: number;
  /** Współczynnik efektywności PUM (pow. całkowita → PUM). */
  wspolczynnikEfektywnosci: number;
  /** Średni metraż mieszkania per profil [m²] (do szacunku liczby mieszkań). */
  metrazSredniM2: Record<Profil, number>;
  /** Symbole MPZP z dozwoloną zabudową mieszkaniową (wielorodzinna istotna). */
  symboleMieszkaniowe: string[];
  /** Parametry prognozy potencjału zabudowy (kształt + sąsiedztwo + spadek). */
  potencjal: KonfiguracjaPotencjal;
  /** Bramka wielkości/kształtu: fizyczna wykonalność + formy + progi opłacalności. */
  bramka: KonfiguracjaBramka;
}

/** Bramka wielkości/kształtu (M1) — progi strojone, nie twarde granice logiki. */
export interface KonfiguracjaBramka {
  /** Maksymalna liczba kondygnacji zabudowy niskiej. */
  maxKondygnacjeNiska: number;
  /** Próg opłacalności (liczba lokali) formy niskiej — punkt decyzyjny, nie odrzucenie. */
  progOplacalnosciNiska: number;
  /** Próg opłacalności (liczba lokali) formy wysokiej. */
  progOplacalnosciWysoka: number;
  /** Minimalna szerokość zabudowalna [m] — poniżej nie zmieści się budynek (fizyczna bramka). */
  minSzerokoscBudowlanaM: number;
  /** Poniżej tej powierzchni [m²] fizyczna niewykonalność sugeruje scalenie, nie „nieprzydatna". */
  progScalenieM2: number;
  /** Udział powierzchni wspólnych (klatki/windy/komunikacja) wg formy — niska mniejszy (bez wind). */
  udzialWspolne: Record<FormaZabudowy, number>;
  /** Udział usług w parterze — obniża PUM. */
  udzialUslugi: number;
}

/** Kalibracja prognozy potencjału zabudowy (port `potential.py`). */
export interface KonfiguracjaPotencjal {
  minSzerokoscWielorodzinnaM: number; // poniżej tej szerokości wielorodzinna trudna
  gornyLimitPokrycia: number; // górne ograniczenie szacowanego pokrycia (0..1)
  kondygnacjeFallback: number; // gdy brak wysokości w sąsiedztwie
  zwartoscNeutralna: number; // przyjmowana zwartość, gdy brak geometrii
  efektywnoscNeutralna: number; // efektywność kształtu, gdy brak geometrii
}

export const KONFIG_POZIOM1: KonfiguracjaPoziom1 = {
  pasma: { zielony: 65, zolty: 40 },
  progMieszkanViable: 15,
  wspolczynnikEfektywnosci: 0.8,
  metrazSredniM2: { mlodzi: 41, seniorzy: 45 },
  symboleMieszkaniowe: ["MW", "MWn", "MU", "MW/U", "MN/U", "MN"],
  potencjal: {
    minSzerokoscWielorodzinnaM: 18,
    gornyLimitPokrycia: 0.45,
    kondygnacjeFallback: 2,
    zwartoscNeutralna: 0.7,
    efektywnoscNeutralna: 0.85,
  },
  bramka: {
    maxKondygnacjeNiska: 2,
    progOplacalnosciNiska: 20,
    progOplacalnosciWysoka: 40,
    minSzerokoscBudowlanaM: 6,
    progScalenieM2: 500,
    // η_PU (0,80) × (1 − wspólne − usługi) daje realny udział PUM w GFA:
    //   wysoka młodzi ≈ 0,80×(1−0,16−0,05)=0,63 ; niska ≈ 0,80×(1−0,08−0,05)=0,70.
    udzialWspolne: { niska: 0.08, wysoka: 0.16 },
    udzialUslugi: 0.05,
  },
};

// ── MODEL OCENY POPYTU (pod-model wymiaru W2) ───────────────────────────────

export interface KonfiguracjaPopyt {
  /** Wagi popytu wewnętrznego vs zewnętrznego per profil (suma = 1). */
  wagi: Record<Profil, { wewnetrzny: number; zewnetrzny: number }>;
  /** Próg obciążenia dochodu czynszem, powyżej którego rynek „za drogi" [%]. */
  progDochoduNaCzynszPct: number;
  /** Proxy pułapu dochodowego zasobu komunalnego [zł/mc gosp.]. Dochód powyżej → luka społeczna. */
  pulapKomunalnyDochod: number;
  /** Typowy metraż do liczenia obciążenia czynszem per profil [m²]. */
  metrazTypowyM2: Record<Profil, number>;
  /** Mnożnik usług: min + wklad × sygnał(0–1) → [min, min+wklad]. */
  mnoznikUslug: { min: number; wklad: number };
  /** Mnożnik luki cenowej: interpolacja od braku luki do luki maksymalnej. */
  mnoznikLuka: { min: number; max: number };
  /** Próg (0–100) rozdzielający „wysoki/niski" popyt w interpretacji (sekcja 7). */
  progInterpretacji: number;
  /** Udział ofert krótkoterminowych, powyżej którego flaga „rynek turystyczny". */
  progTurystycznyUdzial: number;
  /** Napięcie mieszkaniowe: zakres pustostanów [%] i wagi składników. */
  napiecie: { pustostanyMin: number; pustostanyMax: number; wagaPustostany: number; wagaTrend: number };
  /** Progi bezrobocia [%] → punkt (0–1); poniżej ostatniego progu = `bezrobociePoza`. */
  bezrobocieProgi: { max: number; pkt: number }[];
  bezrobociePoza: number;
  /** Zakres liczby podmiotów gosp. na 1000 mieszk. do interpolacji pull-u. */
  podmiotyZakres: { min: number; max: number };
  /** Siła luki cenowej: progi luki [%] → indeks (0–1), malejąco. */
  lukaProgi: { prog: number; idx: number }[];
  lukaPoza: number;
  /** Progi czasu dojazdu do aglomeracji [min] → punkt (0–1); poza = `dojazdPoza`. */
  dojazdProgi: { max: number; pkt: number }[];
  dojazdPoza: number;
}

export const KONFIG_POPYT: KonfiguracjaPopyt = {
  wagi: {
    mlodzi: { wewnetrzny: 0.6, zewnetrzny: 0.4 },
    seniorzy: { wewnetrzny: 0.85, zewnetrzny: 0.15 },
  },
  progDochoduNaCzynszPct: 35,
  pulapKomunalnyDochod: 5000,
  metrazTypowyM2: { mlodzi: 45, seniorzy: 40 },
  mnoznikUslug: { min: 0.6, wklad: 0.5 }, // [0,60–1,10]
  mnoznikLuka: { min: 0.9, max: 1.15 },
  progInterpretacji: 50,
  progTurystycznyUdzial: 0.4,
  napiecie: { pustostanyMin: 2, pustostanyMax: 12, wagaPustostany: 0.6, wagaTrend: 0.4 },
  bezrobocieProgi: [{ max: 3, pkt: 1 }, { max: 5, pkt: 0.75 }, { max: 8, pkt: 0.4 }],
  bezrobociePoza: 0.2,
  podmiotyZakres: { min: 80, max: 220 },
  lukaProgi: [
    { prog: 45, idx: 1 },
    { prog: 30, idx: 0.8 },
    { prog: 15, idx: 0.5 },
    { prog: 5, idx: 0.3 },
  ],
  lukaPoza: 0.15,
  dojazdProgi: [{ max: 30, pkt: 1 }, { max: 45, pkt: 0.6 }, { max: 60, pkt: 0.3 }],
  dojazdPoza: 0.1,
};

// ── POZIOM 1: ocena popytu (wersja pełna) — 4 werdykty, 2 natury ──────────────

export interface KonfiguracjaPopytP1 {
  /**
   * Progi dochodowe K/S/R zakotwiczone w DOCHODZIE ODNIESIENIA (nie w wartości
   * odtworzeniowej!). WO to koszt budowy — nie ma nic wspólnego z progiem
   * kwalifikacji dochodowej. Kotwica = przeciętne wynagrodzenie / ustawowe limity
   * SIM-TBS. Dzięki temu odświeżenie warstwy WO nie przesuwa kwalifikacji.
   */
  progiDochodu: {
    dochodOdniesienieFallback: number; // [zł/mc gosp.] proxy ustawowej kotwicy (przeciętne wynagrodzenie), gdy brak danej regionalnej
    komunalnyMn: number; // dochód < mn × odniesienie → komunalny (próg dolny)
    spolecznyMn: number; // dochód < mn × odniesienie → społeczny (≥ → rynek)
  };
  /**
   * Rozkład dochodów PER PROFIL (emerytury ≠ pensje): mnożnik średniej gminnej
   * i parametr kształtu σ(log). Seniorzy: niższa średnia, mniejsza wariancja;
   * młodzi: wyższa średnia, większa wariancja.
   */
  dochodProfil: Record<Profil, { mnoznikSredniej: number; sigma: number }>;
  /** Domyślny dochód gminy [zł/mc] gdy brak danych (baza rozkładu). */
  dochodFallback: number;
  /** Wielkość gospodarstwa per profil — konwersja osoby → gospodarstwa (kafel społeczny vs mieszkania). */
  wielkoscGospodarstwa: Record<Profil, number>;
  /** Ilu GOSPODARSTW segmentu S na 1 mieszkanie = pełna wystarczalność (kafel społeczny). */
  marginesGospodarstwa: number;
  /** Próg wieku emerytalnego [lata] — linia podziału profil aktywny/senioralny (parametr). */
  progWiekuEmerytalnegoLat: number;
  /**
   * UDZIAŁ BEZ MIESZKANIA — jedyna szczerze niepewna wielkość (założenie, obniża
   * pewność). Per profil × segment (komunalny = najubożsi; społeczny = luka
   * czynszowa). Udział bez własnego lokalu rośnie ku młodszym/uboższym; po 45. r.ż.
   * większość uwłaszczona. Kalibrowalne (GUS/Eurostat/NSP).
   */
  udzialBezMieszkania: Record<Profil, { komunalny: number; spoleczny: number }>;
  /**
   * KOREKTA MIGRACYJNA — jeden mnożnik (nie osobny popyt). M = clamp(1 + saldo/1000 × k),
   * przyłożony z wagą per kafel (najmocniej: aktywni-społeczny; pomijalnie: seniorzy-komunalny).
   */
  migracja: { k: number; min: number; max: number; wagi: Record<KluczWerdyktu, number> };
  /** Progi poziomu potrzeby KOMUNALNEJ — na BEZWZGLĘDNEJ liczbie kwalifikujących bez mieszkania (segment K). */
  progiKomunalne: { wysoki: number; sredni: number; niski: number };
  /** Pasma werdyktu (score → kolor). */
  pasma: { zielony: number; zolty: number };
}

export const KONFIG_POPYT_P1: KonfiguracjaPopytP1 = {
  // Kotwica dochodowa ~8000 zł/mc (przeciętne wynagrodzenie) → próg komunalny
  // ~6000, społeczny ~12000 zł/mc gosp. NIEZALEŻNE od wartości odtworzeniowej.
  progiDochodu: { dochodOdniesienieFallback: 8000, komunalnyMn: 0.75, spolecznyMn: 1.5 },
  dochodProfil: {
    mlodzi: { mnoznikSredniej: 1.05, sigma: 0.65 },
    seniorzy: { mnoznikSredniej: 0.72, sigma: 0.45 },
  },
  dochodFallback: 6500,
  wielkoscGospodarstwa: { mlodzi: 2.2, seniorzy: 1.4 },
  marginesGospodarstwa: 1.5,
  progWiekuEmerytalnegoLat: 65,
  // Udział bez mieszkania (założenie): aktywni komunalni ~co drugi, aktywni społeczni
  // ~co trzeci; seniorzy komunalni ~1/7 (reszta uwłaszczona), seniorzy społeczni najmniej.
  udzialBezMieszkania: {
    mlodzi: { komunalny: 0.45, spoleczny: 0.3 },
    seniorzy: { komunalny: 0.15, spoleczny: 0.07 },
  },
  migracja: {
    k: 0.03, // saldo +5/1000 → M≈1,15; +13/1000 → sufit 1,40
    min: 0.85,
    max: 1.4,
    wagi: { spolecznyMlodzi: 1.0, komunalnyMlodzi: 0.3, spolecznySeniorzy: 0.2, komunalnySeniorzy: 0.0 },
  },
  progiKomunalne: { wysoki: 3000, sredni: 1000, niski: 300 },
  pasma: { zielony: 65, zolty: 40 },
};

// ── POZIOM 2: parametry zabudowy ────────────────────────────────────────────

export interface KonfiguracjaZabudowy {
  /** Współczynnik efektywności: PUM ≈ pow. całkowita × wsp. (0,75–0,85). */
  wspolczynnikEfektywnosci: number;
  /** Udział powierzchni wspólnej/usługowej w PUM. */
  udzialPowWspolnejPct: Record<Profil, number>;
  /** Normatyw parkingowy (miejsc/lokal) — fallback gdy brak w MPZP. */
  normatywParkingowy: Record<Profil, number>;
  /** Wysokość kondygnacji [m] do przeliczeń obwiedni z wysokości. */
  wysokoscKondygnacjiM: number;
  /** Mix metraży per profil (udziały muszą sumować się do 100). */
  mixMetrazy: Record<Profil, { etykieta: string; metrazSredniM2: number; udzialPct: number }[]>;
  /** Próg PBC, powyżej którego parking schodzi pod ziemię. */
  progPbcParkingPodziemnyPct: number;
  /** Próg spadku wymuszającego tarasowanie/podpiwniczenie. */
  progSpadkuTarasowaniePct: number;
  /** Minimalna powierzchnia działki dla efektywnego budynku z windą. */
  minPowierzchniaEfektywnaM2: number;
  /** Fallback wskaźników z sąsiedztwa (gdy brak MPZP). */
  fallbackSasiedztwo: {
    intensywnosc: number;
    maxKondygnacje: number;
    maxPowZabudowyPct: number;
    minPbcPct: number;
  };
}

export const KONFIG_ZABUDOWA: KonfiguracjaZabudowy = {
  wspolczynnikEfektywnosci: 0.8,
  udzialPowWspolnejPct: { mlodzi: 12, seniorzy: 20 },
  normatywParkingowy: { mlodzi: 0.7, seniorzy: 0.5 },
  wysokoscKondygnacjiM: 3.2,
  mixMetrazy: {
    mlodzi: [
      { etykieta: "kawalerka 25–35 m²", metrazSredniM2: 30, udzialPct: 45 },
      { etykieta: "2-pok 40–50 m²", metrazSredniM2: 45, udzialPct: 40 },
      { etykieta: "3-pok 55–65 m²", metrazSredniM2: 60, udzialPct: 15 },
    ],
    seniorzy: [
      { etykieta: "1-pok 35–45 m²", metrazSredniM2: 40, udzialPct: 55 },
      { etykieta: "2-pok 45–55 m²", metrazSredniM2: 50, udzialPct: 45 },
    ],
  },
  progPbcParkingPodziemnyPct: 40,
  progSpadkuTarasowaniePct: 10,
  minPowierzchniaEfektywnaM2: 800,
  fallbackSasiedztwo: {
    intensywnosc: 0.9,
    maxKondygnacje: 4,
    maxPowZabudowyPct: 35,
    minPbcPct: 30,
  },
};

// ── POZIOM 3: parametry finansowe per reżim ─────────────────────────────────

export interface ParametryRezimu {
  nazwa: string;
  maxUdzialKredytuPct: number;
  oprocentowanie: number; // roczne
  prowizjaPct: number;
  okresKredytuLata: number;
  maxGrantPct: number;
  maxPartycypacjaNajemcowPct: number; // % kosztu lokalu
  stopaPulapuCzynszu: number; // % wartości odtworzeniowej rocznie
  flagaNiepewnosci: boolean;
  opis: string;
}

export interface KonfiguracjaFinanse {
  rezimDomyslny: Rezim;
  rezimy: Record<Rezim, ParametryRezimu>;
  /** Oś czasu — czas trwania faz [miesiące]. */
  osCzasu: {
    projektDecyzjeMies: number;
    naborFinansowaniaMies: number;
    budowaMies: number;
  };
  /** Rok bazowy analizy (T0). */
  rokBazowy: number;
  /** Indeksy roczne (CAGR) do "czasu martwego". */
  indeksy: {
    kosztBudowyRocznie: number;
    wartoscOdtworzeniowaRocznie: number;
    dochodyRocznie: number;
  };
  /** Założenia montażu i eksploatacji. */
  zalozenia: {
    pustostanyPct: number;
    rezerwaRyzykoPct: number; // % kosztu budowy+uzbrojenia
    kosztyProjektowePct: number;
    kosztyOperacyjneM2Mc: number; // eksploatacja + remonty + zarząd (strumień OPERACYJNY — NIE wchodzi do zdolności kredytowej)
    /** Bufor bezpieczeństwa zdolności czynszowej [%] — DSCR ~1,11–1,15 (widełki 10–15%). */
    rezerwaBezpieczenstwaPct: number;
    domyslnaPartycypacjaNajemcowPct: number;
    domyslnyWkladGminyPct: number;
    /** 6 — próg [%] udziału wkładu własnego, powyżej którego montaż dostaje flagę
     *  „wymaga wysokiego wkładu" (miękkie sprzężenie → rekomendacja warunkowa; NIE „nie spina"). */
    progWkladuOstrzezeniePct: number;
  };
  /** Mnożniki scenariuszy (na koszt budowy i stopę wzrostu wartości). */
  scenariusze: {
    konserwatywny: { mnoznikKosztu: number; mnoznikWartOdtw: number; mnoznikStopy: number };
    oczekiwany: { mnoznikKosztu: number; mnoznikWartOdtw: number; mnoznikStopy: number };
    korzystny: { mnoznikKosztu: number; mnoznikWartOdtw: number; mnoznikStopy: number };
  };
  /** Suwak kosztu budowy [zł/m²] w wyniku M3 — przelicza montaż na żywo. */
  kosztBudowySuwak: { min: number; max: number; domyslny: number; krok: number };
}

export const KONFIG_FINANSE: KonfiguracjaFinanse = {
  // 5.3 Rekomendację kotwiczymy w reżimie OBECNYM (pewne dane); przyszły (2027+)
  // ma parametry `tbc` i służy jako scenariusz. Przekrój M3 nadal pokazuje oba.
  rezimDomyslny: "A_SBC_2026",
  rezimy: {
    A_SBC_2026: {
      nazwa: "A — obecny SBC (do jesieni 2026)",
      maxUdzialKredytuPct: 80,
      oprocentowanie: 0.02,
      prowizjaPct: 0.0075,
      okresKredytuLata: 30,
      maxGrantPct: 35,
      maxPartycypacjaNajemcowPct: 30,
      stopaPulapuCzynszu: 0.05,
      flagaNiepewnosci: false,
      opis: "Obecny program SBC — tylko dla naborów do jesieni 2026. Kredyt do 80%, ~2%, 30 lat; grant do 35%; pułap 5% wart. odtworzeniowej.",
    },
    B_program_2027: {
      nazwa: "B — nowy program 2027+ (domyślny)",
      maxUdzialKredytuPct: 80,
      oprocentowanie: 0.02,
      prowizjaPct: 0.0075,
      okresKredytuLata: 50,
      maxGrantPct: 15,
      maxPartycypacjaNajemcowPct: 30,
      stopaPulapuCzynszu: 0.05,
      flagaNiepewnosci: true,
      opis: "Nowy program (kontury): kredyt ~2% do 50 lat, grant ~15% (do potwierdzenia dla SIM), czynsz celowany 15–30 zł/m². Wydłużenie okresu do 50 lat radykalnie obniża ratę.",
    },
    C_upside_unijny: {
      nazwa: "C — upside unijny „Cztery Ściany”",
      maxUdzialKredytuPct: 80,
      oprocentowanie: 0.02,
      prowizjaPct: 0.0075,
      okresKredytuLata: 50,
      maxGrantPct: 30,
      maxPartycypacjaNajemcowPct: 30,
      stopaPulapuCzynszu: 0.05,
      flagaNiepewnosci: true,
      opis: "Scenariusz korzystny z dodatkowymi grantami/gwarancjami UE (>400 mld € na 2026–2029). Wyższy grant obniża wymaganą dotację.",
    },
  },
  osCzasu: {
    projektDecyzjeMies: 9,
    naborFinansowaniaMies: 5,
    budowaMies: 24,
  },
  rokBazowy: 2026,
  indeksy: {
    kosztBudowyRocznie: 0.05,
    wartoscOdtworzeniowaRocznie: 0.04,
    dochodyRocznie: 0.04,
  },
  zalozenia: {
    pustostanyPct: 5,
    rezerwaRyzykoPct: 5,
    kosztyProjektowePct: 8,
    kosztyOperacyjneM2Mc: 11,
    rezerwaBezpieczenstwaPct: 12.5,
    domyslnaPartycypacjaNajemcowPct: 0,
    domyslnyWkladGminyPct: 0,
    progWkladuOstrzezeniePct: 45,
  },
  scenariusze: {
    konserwatywny: { mnoznikKosztu: 1.08, mnoznikWartOdtw: 0.98, mnoznikStopy: 1.5 },
    oczekiwany: { mnoznikKosztu: 1.0, mnoznikWartOdtw: 1.0, mnoznikStopy: 1.0 },
    korzystny: { mnoznikKosztu: 0.95, mnoznikWartOdtw: 1.03, mnoznikStopy: 0.5 },
  },
  kosztBudowySuwak: { min: 4000, max: 15000, domyslny: 9500, krok: 250 },
};

// ── Poziom 2 (wersja uproszczona): proste pytania do klienta ──────────────────

/** Definicja jednej odległości pieszo pytanej w M2 (pre-wypełniana z OSM). */
export interface OdlegloscM2 {
  klucz: string; // klucz w DaneDzialki.odleglosciM2
  etykieta: string;
  profil: "mlodzi" | "seniorzy" | "oba"; // dla kogo liczy się w mnożniku popytu
}

/** Kanał A — progi dostępności (komfort, dyskwalifikacja) danej usługi dla profilu. */
export interface ProgUslugi {
  komfortM: number; // do tej odległości usługa „pod ręką" (f_usługi = 1,0)
  dyskwalifikacjaM: number; // od tej odległości — profil zdyskwalifikowany (bramka A, weakest-link)
}

export interface KonfiguracjaM2 {
  /** Zestaw odległości pieszo (można rozszerzać). */
  odleglosciPieszo: OdlegloscM2[];
  /** Próg „w zasięgu pieszym" [m] — poniżej traktujemy usługę jako dostępną (flagi M1). */
  progPieszoM: number;
  /**
   * Kanał A — progi (komfort, dyskwalifikacja) PER USŁUGA i profil (spec §4).
   * Brak wpisu profilu przy usłudze = usługa nie liczy się dla tego profilu.
   * Seniorzy wyraźnie wrażliwsi (niższe progi) — walkability i transport krytyczne.
   */
  progiUslug: Record<string, Partial<Record<"mlodzi" | "seniorzy", ProgUslugi>>>;
  /** Kanał A — dolna wartość gradientu f_usługi na granicy dyskwalifikacji (spec §4: 1,0 → 0,3). */
  minFaktorUslugi: number;
  /**
   * Transport zbiorowy — ŁAGODNY modyfikator jakości per profil (wytyczne panel_transport §3).
   * NIE bramka: „nie ma"/pominięte → neutralny (+flaga), „jest" → bonus wg walkability (najbliższy
   * przystanek) i jakości obsługi (najlepszy: linie × kursy/dzień). Nigdy nie dyskwalifikuje.
   */
  transport: {
    maxBonus: number; // maks. bonus modyfikatora (np. 0.10 → do ×1,10)
    walkKomfortM: Record<"mlodzi" | "seniorzy", number>; // ≤ → pełna walkability
    walkZerM: Record<"mlodzi" | "seniorzy", number>; // ≥ → walkability 0
    liniiPelna: number; // ≥ linii → pełna jakość
    kursyDzienPelna: number; // ≥ kursów/dzień → pełna jakość
    wagi: Record<"mlodzi" | "seniorzy", { walk: number; jakosc: number; noc: number }>; // suma ≈ 1
  };
  /**
   * Otoczenie / jakość życia (OSM) — ŁAGODNY modyfikator + pozytywne sygnały, NIE bramka.
   * Zieleń/plac zabaw ważą młodzi (rodziny), poczta/bank — seniorzy (codzienne sprawy).
   * Bonus wg walkability (najbliższy obiekt każdej kategorii). Brak → neutralny, nigdy kara.
   */
  otoczenie: {
    maxBonus: number; // maks. bonus (np. 0.06 → do ×1,06)
    komfortM: number; // ≤ → pełna walkability kategorii
    zerM: number; // ≥ → walkability 0
    kategorie: readonly string[]; // klucze w odleglosciM2 (zielen, plac_zabaw, poczta, bank)
    wagi: Record<"mlodzi" | "seniorzy", Record<string, number>>; // waga per kategoria (suma ≈ 1)
    etykiety: Record<string, string>; // do sygnałów w raporcie
  };
  /**
   * 7.1 Uciążliwości otoczenia (OSM) — ŁAGODNA KARA w kanale O, symetrycznie do
   * bonusów; NIE bramka. Brak danych → neutralnie (bez kary). Próg per typ [m]:
   * bliżej progu → większa kara (do `maxKara`).
   */
  uciazliwosci: {
    maxKara: number; // maks. kara (np. 0.10 → do ×0,90)
    progiM: Record<string, number>; // klucz typu (uc_*) → próg [m]
    etykiety: Record<string, string>;
  };
  /** Kanał B — koszt uzbrojenia (odległość do sieci → przydatność ekonomiczna). */
  kosztUzbrojenia: { odlegloscKomfortM: number; odlegloscDrogaM: number; karaSpadekPct: number };
  /** Kanał C — modyfikatory popytu (aglomeracja, potencjał, pustostany). */
  modyfikatorPopytu: {
    dojazdKomfortMin: number;
    dojazdMaxMin: number;
    wagaAglomeracji: Record<"mlodzi" | "seniorzy", number>; // ile dojazd waży per profil
  };
}

export const KONFIG_M2: KonfiguracjaM2 = {
  odleglosciPieszo: [
    { klucz: "sklep", etykieta: "Sklep spożywczy", profil: "oba" },
    { klucz: "apteka", etykieta: "Apteka", profil: "seniorzy" },
    { klucz: "poz", etykieta: "Przychodnia (POZ)", profil: "seniorzy" },
    { klucz: "szkola", etykieta: "Szkoła", profil: "mlodzi" },
    { klucz: "przedszkole", etykieta: "Przedszkole / żłobek", profil: "mlodzi" },
  ],
  progPieszoM: 800,
  // Progi startowe wg spec §4 [m]: komfort / dyskwalifikacja.
  progiUslug: {
    poz: { seniorzy: { komfortM: 500, dyskwalifikacjaM: 5000 } },
    apteka: { seniorzy: { komfortM: 400, dyskwalifikacjaM: 3500 } },
    sklep: { seniorzy: { komfortM: 400, dyskwalifikacjaM: 3000 }, mlodzi: { komfortM: 600, dyskwalifikacjaM: 4000 } },
    szkola: { mlodzi: { komfortM: 1000, dyskwalifikacjaM: 8000 } },
    przedszkole: { mlodzi: { komfortM: 1000, dyskwalifikacjaM: 8000 } },
  },
  minFaktorUslugi: 0.3,
  // Transport = łagodny bonus (do +10% popytu), nigdy kara. Seniorzy ważą walkability mocniej,
  // młodzi bardziej jakość obsługi i kursy nocne (zmiany). Kursy nocne = mała waga (niuans).
  transport: {
    maxBonus: 0.1,
    walkKomfortM: { seniorzy: 300, mlodzi: 500 },
    walkZerM: { seniorzy: 1500, mlodzi: 2500 },
    liniiPelna: 5,
    kursyDzienPelna: 40,
    wagi: { seniorzy: { walk: 0.65, jakosc: 0.33, noc: 0.02 }, mlodzi: { walk: 0.4, jakosc: 0.5, noc: 0.1 } },
  },
  // Otoczenie = łagodny bonus (do +6% popytu), nigdy kara. Zieleń/plac zabaw → młodzi;
  // poczta/bank → seniorzy. Zieleń ważna dla obu (spacer).
  otoczenie: {
    maxBonus: 0.06,
    komfortM: 500,
    zerM: 2000,
    kategorie: ["zielen", "plac_zabaw", "poczta", "bank"],
    wagi: {
      mlodzi: { zielen: 0.45, plac_zabaw: 0.4, poczta: 0.05, bank: 0.1 },
      seniorzy: { zielen: 0.35, plac_zabaw: 0.0, poczta: 0.35, bank: 0.3 },
    },
    etykiety: { zielen: "Tereny zielone / park", plac_zabaw: "Plac zabaw", poczta: "Poczta", bank: "Bank / bankomat" },
  },
  uciazliwosci: {
    maxKara: 0.1,
    progiM: { uc_przemysl: 300, uc_kolej: 150, uc_droga: 200, uc_wysypisko: 500, uc_lotnisko: 1500 },
    etykiety: {
      uc_przemysl: "Przemysł / zakład",
      uc_kolej: "Linia kolejowa",
      uc_droga: "Droga szybkiego ruchu",
      uc_wysypisko: "Wysypisko / oczyszczalnia",
      uc_lotnisko: "Lotnisko",
    },
  },
  kosztUzbrojenia: { odlegloscKomfortM: 50, odlegloscDrogaM: 500, karaSpadekPct: 8 },
  modyfikatorPopytu: {
    dojazdKomfortMin: 30,
    dojazdMaxMin: 90,
    wagaAglomeracji: { mlodzi: 0.35, seniorzy: 0.12 },
  },
};

/** Kanał C — model bliskości aglomeracji (pierścienie skalowane klasą miasta). */
export interface PierscienKlasy {
  rdzenKm: number; // ≤ rdzeń → pełna siła bazowa (pierścień 0)
  zasiegKm: number; // > zasięg → brak oddziaływania
  silaBazowa: number; // siła w rdzeniu (0–100)
  krokKm: number; // szerokość pierścienia (do wyświetlenia)
}
export interface KonfiguracjaAglomeracji {
  pierscienie: Record<"A" | "B" | "C" | "D", PierscienKlasy>;
  bonusDrugiOsrodek: number; // udział siły drugiego ośrodka w sygnale
  amplitudaProfil: { mlodzi: number; seniorzy: number }; // rozpiętość modyfikatora wokół 1,0
}

export const KONFIG_AGLOMERACJA: KonfiguracjaAglomeracji = {
  // Wartości startowe wg wytycznych „bliskość aglomeracji" §3 — kalibrowalne.
  pierscienie: {
    A: { rdzenKm: 20, zasiegKm: 60, silaBazowa: 100, krokKm: 10 },
    B: { rdzenKm: 10, zasiegKm: 35, silaBazowa: 70, krokKm: 10 },
    C: { rdzenKm: 8, zasiegKm: 20, silaBazowa: 45, krokKm: 8 },
    D: { rdzenKm: 4, zasiegKm: 10, silaBazowa: 25, krokKm: 5 },
  },
  bonusDrugiOsrodek: 0.1,
  amplitudaProfil: { mlodzi: 0.4, seniorzy: 0.15 },
};

/** Migawka całej konfiguracji (do API / edytora). */
export interface Konfiguracja {
  scoring: KonfiguracjaScoring;
  zabudowa: KonfiguracjaZabudowy;
  finanse: KonfiguracjaFinanse;
}

export function domyslnaKonfiguracja(): Konfiguracja {
  // Głęboka kopia, by edytor nie mutował stałych modułu.
  return JSON.parse(
    JSON.stringify({ scoring: KONFIG_SCORING, zabudowa: KONFIG_ZABUDOWA, finanse: KONFIG_FINANSE })
  );
}
