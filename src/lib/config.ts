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

import type { Profil, Rezim } from "./types";

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
    kosztyOperacyjneM2Mc: number; // eksploatacja + remonty + zarząd
    domyslnaPartycypacjaNajemcowPct: number;
    domyslnyWkladGminyPct: number;
  };
  /** Mnożniki scenariuszy (na koszt budowy i stopę wzrostu wartości). */
  scenariusze: {
    konserwatywny: { mnoznikKosztu: number; mnoznikWartOdtw: number; mnoznikStopy: number };
    oczekiwany: { mnoznikKosztu: number; mnoznikWartOdtw: number; mnoznikStopy: number };
    korzystny: { mnoznikKosztu: number; mnoznikWartOdtw: number; mnoznikStopy: number };
  };
}

export const KONFIG_FINANSE: KonfiguracjaFinanse = {
  rezimDomyslny: "B_program_2027",
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
    domyslnaPartycypacjaNajemcowPct: 0,
    domyslnyWkladGminyPct: 0,
  },
  scenariusze: {
    konserwatywny: { mnoznikKosztu: 1.08, mnoznikWartOdtw: 0.98, mnoznikStopy: 1.5 },
    oczekiwany: { mnoznikKosztu: 1.0, mnoznikWartOdtw: 1.0, mnoznikStopy: 1.0 },
    korzystny: { mnoznikKosztu: 0.95, mnoznikWartOdtw: 1.03, mnoznikStopy: 0.5 },
  },
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
