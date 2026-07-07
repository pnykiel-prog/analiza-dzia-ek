/**
 * Model domenowy ankiety finansowej (brama Poziomu 3).
 *
 * Ankieta ustala „kto pyta i jak jest finansowany projekt" — bez tego nie da się
 * spiąć montażu. Wynik ankiety to PROFIL FINANSOWY, z którego logika (ankieta.ts)
 * składa montaż finansowy i modyfikatory wchodzące do modelu Poziomu 3.
 *
 * Liczby pochodzą z `parametry_finansowania.json`; ten plik opisuje wyłącznie
 * kształt danych. Parametry przyszłego reżimu bywają `tbc` — reprezentujemy je
 * jako ZAKRESY (min/max) z flagą, nigdy jako pewne pojedyncze wartości.
 */

// ── Reżim prawny ─────────────────────────────────────────────────────────────
export type RezimFinansowy = "current" | "future";

// ── Ankieta (wejście) ────────────────────────────────────────────────────────
export type TypInwestora =
  | "SIM_GMINNY"
  | "SIM_MIESZANY"
  | "SIM_PRYWATNY"
  | "TBS"
  | "SPOLDZIELNIA"
  | "SPOLKA_GMINNA"
  | "GMINA";

export type TypZasobu =
  | "SOCJALNY"
  | "KOMUNALNY"
  | "SPOLECZNY_CZYNSZOWY"
  | "SPOLDZIELCZY_LOKATORSKI";

/** Status dostępu inwestor × zasób (macierz z JSON). */
export type DostepZasobu = "brak" | "ograniczony" | "pełen";

export type UdzialGminy = "wiekszosciowy" | "mniejszosciowy" | "symboliczny";

export type SposobWniesieniaDzialki =
  | "APORT_GMINNY"
  | "ZAKUP_KREDYT"
  | "ZAKUP_KAPITAL_WLASNY"
  | "JUZ_POSIADANA"
  | "LOKAL_ZA_GRUNT";

export type WspolpracaGmina =
  | "UMOWA_PARTNERSKA"
  | "APORT"
  | "UDZIAL_KAPITALOWY"
  | "LOKAL_ZA_GRUNT"
  | "ZPI"
  | "BRAK";

/** Wynik ankiety — obiekt przekazywany do modelu finansowego (P3). */
export interface ProfilFinansowy {
  typInwestora: TypInwestora; // Q1
  udzialGminy?: UdzialGminy; // Q1a (gdy SIM_MIESZANY)
  nowyPodmiot?: boolean; // Q1b → kwalifikacja do gwarancji InvestEU
  typZasobu: TypZasobu; // Q2
  rezim: RezimFinansowy; // Q3
  sposobWniesieniaDzialki: SposobWniesieniaDzialki; // Q4
  wspolpracaGmina: WspolpracaGmina; // Q5
  efektywnoscEnergetyczna: boolean; // Q6 (FEnIKS/OZE)
  mieszkanieNaStart: boolean; // Q7 (dopłata do czynszu — OPEX, nie CAPEX)
  dataWniosku: string; // Q8 (ISO yyyy-mm-dd)
  // ── Pola przekroju M3 (wartość działki + partycypacje) — opcjonalne, dla montażu ──
  /** Wartość/cena działki [R] — rola (źródło/koszt) zależna od sposobu wniesienia. */
  wartoscDzialkiPln?: number;
  /** Partycypacja najemców [% kosztu] — opcjonalna. */
  partycypacjaNajemcowPct?: number;
  /** Wkład gminy [% kosztu] — opcjonalny. */
  wkladGminyPct?: number;
  /** Pozwolenie na budowę — tylko informacja o dojrzałości projektu (bez wpływu na montaż). */
  pozwolenieNaBudowe?: boolean;
}

// ── Analiza (wyjście) ────────────────────────────────────────────────────────

/** Wartość reprezentowana przedziałem — obsługuje `tbc` przyszłego reżimu. */
export interface Zakres {
  min: number;
  max: number;
}

/** Składnik montażu finansowego jako udział w koszcie przedsięwzięcia (CAPEX). */
export interface SkladnikMontazu {
  klucz: "grant" | "kredyt" | "partycypacja" | "kapital_wlasny" | "grunt";
  nazwa: string;
  udzialPct: Zakres; // maksymalny/orientacyjny udział w CAPEX [%]
  tbc: boolean;
  uwaga?: string;
}

export interface ParametryKredytuAnkiety {
  nazwa: string;
  oprocentowanie: Zakres; // ułamkowo (0.02 = 2%)
  typStopy: "zmienne" | "stałe";
  okresLat: number;
  annuityFactor?: Zakres; // dla przyszłego kredytu podany w JSON
  maxUdzialCapexPct: Zakres;
  pokrywaGrunt: boolean;
  prowizjaPct?: number;
  tbc: boolean;
}

export interface InstrumentWsparcia {
  id: string;
  nazwa: string;
  typ: string;
}

/** Porównanie tego samego projektu w obu reżimach (okno przejściowe 2027–2028). */
export interface PorownanieRezimow {
  obslugaDluguNa1MlnPln: { obecny: number; nowy2pct: number; nowy1pct: number; oszczednoscPct: Zakres };
  roznice: {
    liczbaUstaw: { obecny: number; nowy: number };
    liczbaWnioskow: { obecny: number; nowy: number };
    okresKredytuLata: { obecny: number; nowy: number };
    maxPartycypacjaPct: { obecny: number; nowy: number };
    wykupZGrantem: { obecny: boolean; nowy: boolean };
    sciezkaGrantu: { obecny: string; nowy: string };
    typStopy: { obecny: string; nowy: string };
  };
  komentarz: string[];
}

export interface AnalizaFinansowa {
  profil: ProfilFinansowy;
  rezim: RezimFinansowy;
  dostepZasobu: DostepZasobu;
  zablokowana: boolean; // dostęp „brak" → nie wolno budować tego zasobu
  montaz: SkladnikMontazu[];
  instrumenty: InstrumentWsparcia[];
  kredyt: ParametryKredytuAnkiety | null;
  traktowanieGruntu: string;
  wykupDozwolony: boolean;
  weryfikacjaDochodowa: string;
  procedura: string;
  ostrzezenia: string[];
  flagiTbc: string[];
  oknoPrzejsciowe: boolean; // data wniosku w oknie 2027–2028
  porownanieRezimow: PorownanieRezimow | null;
}
