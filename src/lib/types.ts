/**
 * Model domenowy aplikacji do oceny działek pod budownictwo społeczne.
 *
 * Zgodny z `architektura_aplikacji.md` (źródło prawdy). Trzy poziomy:
 *  - Poziom 1: szybki przesiew (bramki + scoring 5 wymiarów × 2 profile)
 *  - Poziom 2: ocena działki + rekomendacja modelu zabudowy
 *  - Poziom 3: model finansowy SIM (montaż, oś czasu, reżim as-of, domknięcie)
 *
 * Zasada przekrojowa: "brak danych ≠ nie". Dlatego wartości wejściowe mogą być
 * `null` (biała plama) — silnik traktuje je neutralnie i obniża wskaźnik pewności,
 * nigdy nie zamienia braku na werdykt negatywny.
 */

import type { AnalizaFinansowa } from "./finanse/typy";
export type { AnalizaFinansowa };

export type Profil = "mlodzi" | "seniorzy";
export type ProfilRekomendowany = Profil | "oba" | "zaden";
export type Werdykt = "zielony" | "zolty" | "czerwony";
export type StatusBramki = "pass" | "warunkowo" | "fail" | "do_weryfikacji";

/** `null` oznacza brak danej (biała plama) — patrz zasada "brak danych ≠ nie". */
export type Maybe<T> = T | null;

// ────────────────────────────────────────────────────────────────────────────
// DANE WEJŚCIOWE DZIAŁKI (zbierane przez warstwę danych — sekcje A–J dokumentu)
// ────────────────────────────────────────────────────────────────────────────

export type StatusPlanistyczny =
  | "mpzp_mieszkaniowy"
  | "plan_ogolny_sprzyjajacy"
  | "ouz"
  | "sprzeczny"
  | "brak_danych";

export interface WskaznikiPlanistyczne {
  intensywnosc: number; // wskaźnik intensywności zabudowy (pow. całkowita / pow. działki)
  maxWysokoscM: number; // max wysokość zabudowy [m]
  maxKondygnacje: number;
  maxPowZabudowyPct: number; // max udział powierzchni zabudowy [%]
  minPbcPct: number; // min powierzchnia biologicznie czynna [%]
  normatywParkingowy: number; // miejsc / lokal
  udzialUslugPct: number; // dopuszczalny udział usług [%]
}

export interface DaneDzialki {
  // A. Identyfikacja i geometria (ULDK / EGiB)
  id: string; // identyfikator ewidencyjny TERYT + obręb + nr
  teryt: string;
  gmina: string;
  powiat: string;
  wojewodztwo: string;
  powierzchniaM2: number;
  frontM: Maybe<number>; // szerokość frontu działki
  proporcjaBokow: Maybe<number>; // dłuższy/krótszy bok (kształt)
  budynkiIstniejace: Maybe<boolean>;

  // A/B. Użytki i klasa gruntu (EGiB)
  klasaUzytku: Maybe<string>; // np. "B", "RIVa", "Ls"
  gruntLesny: Maybe<boolean>;
  gruntRolnyKlasaIdoIII: Maybe<boolean>;

  // B. Status planistyczny i prawny
  statusPlanistyczny: StatusPlanistyczny;
  wskaznikiPlanistyczne: Maybe<WskaznikiPlanistyczne>;
  zabudowaMieszkaniowaWSasiedztwie: Maybe<boolean>;
  przeznaczenieSprzeczneZMieszkaniowa: Maybe<boolean>;
  dostepDrogaPubliczna: Maybe<boolean>;

  // C. Uwarunkowania fizyczne terenu (NMT / ISOK / SOPO)
  sredniSpadekPct: Maybe<number>;
  ryzykoPowodzioweSzczegolne: Maybe<boolean>;
  osuwisko: Maybe<boolean>;
  terenGorniczy: Maybe<boolean>;

  // D. Uzbrojenie (GESUT / BDOT)
  odlegloscDoSieciM: Maybe<number>; // proxy kosztu przyłączenia
  odlegloscDoZabudowyM: Maybe<number>; // proxy "w tkance"

  // E. Dostępność komunikacyjna (OSM / routing / GTFS)
  czasDojazdAglomeracjaMin: Maybe<number>;
  przystanekZCzestotliwoscia: Maybe<boolean>; // ≥X kursów/dobę, ≤800 m

  // G. Infrastruktura społeczna (różne dla profili)
  uslugiPodstawowePieszo: Maybe<boolean>; // tkanka z usługami w zasięgu spaceru (seniorzy)
  pozWZasiegu: Maybe<boolean>; // bliskość POZ (seniorzy)
  zlobkiSzkolyWZasiegu: Maybe<boolean>; // (młodzi)

  // F. Demografia i rynek pracy (GUS BDL)
  udzial2039Pct: Maybe<number>;
  mediana2039Woj: Maybe<number>;
  saldoMigracjiMlodzi: Maybe<number>; // dodatnie/zero/ujemne
  udzial65PlusPct: Maybe<number>;
  trend65Plus: Maybe<"rosnacy" | "stabilny" | "malejacy">;
  populacjaStabilna: Maybe<boolean>; // czy gmina nie wymiera
  trendLudnosc: Maybe<"rosnaca" | "stabilna" | "malejaca">;
  bezrobociePct: Maybe<number>;
  liczbaPodmiotowGosp: Maybe<number>; // na 1000 mieszk.

  // H. Środowisko i ograniczenia (GDOŚ / NID)
  natura2000: Maybe<boolean>;
  ochronaWykluczajaca: Maybe<boolean>; // rezerwat / park narodowy
  strefaKonserwatorska: Maybe<boolean>;

  // I/J. Rynek i ekonomia
  wartoscOdtworzeniowaM2: Maybe<number>; // podstawa pułapu czynszu
  czynszRynkowyM2: Maybe<number>; // miesięczny
  cenaNowychM2: Maybe<number>; // stan deweloperski
  kosztBudowyM2: Maybe<number>; // pod klucz (jeśli znany)
  cenaGruntu: Maybe<number>; // łączna cena nabycia działki
  pustostanyPct: Maybe<number>;
  dochodyGospDomowe: Maybe<number>; // miesięcznie, do zdolności czynszowej
}

// ────────────────────────────────────────────────────────────────────────────
// WYNIK POZIOMU 1
// ────────────────────────────────────────────────────────────────────────────

export interface WynikBramki {
  nazwa: string;
  status: StatusBramki;
  zrodlo: string;
  uzasadnienie: string;
}

export interface WynikMetryki {
  nazwa: string;
  wartosc: string; // sformatowana wartość wejściowa (lub "brak danych")
  punkty: number; // 0–100
  waga: number; // waga w obrębie wymiaru
  fallback: boolean; // czy użyto mediany (brak danych)
  profil?: Profil; // jeśli metryka dotyczy konkretnego profilu
}

export interface WynikWymiaru {
  kod: "W1" | "W2" | "W3" | "W4" | "W5";
  nazwa: string;
  punktyMlodzi: number; // 0–100 (agregat wymiaru dla profilu „młodzi”)
  punktySeniorzy: number; // 0–100 (agregat wymiaru dla profilu „seniorzy”)
  wagaMlodzi: number;
  wagaSeniorzy: number;
  metryki: WynikMetryki[];
}

export interface KluczoweLiczby {
  pulapCzynszuSimM2: Maybe<number>;
  czynszRynkowyM2: Maybe<number>;
  lukaNajemcyPct: Maybe<number>;
  relacjaKosztDoWartOdtworzeniowejPct: Maybe<number>;
  czasDojazdAglomeracjaMin: Maybe<number>;
  sredniSpadekPct: Maybe<number>;
}

// Pod-model oceny popytu (W2) — rozdział wewnętrzny/zewnętrzny + mnożniki.
export interface SkladnikPopytu {
  nazwa: string;
  wartosc: string;
  udzial: number; // 0–100 (wkład składnika, do prezentacji)
  fallback: boolean;
}

export interface WynikPopytu {
  profil: Profil;
  wewnetrzny: number; // 0–100 (lokalni kwalifikujący się pod presją)
  zewnetrzny: number; // 0–100 (napływ migracyjny × luka)
  potencjalny: number; // 0–100 (ważona suma wg profilu)
  realizowalny: number; // 0–100 (= wynik wymiaru W2)
  mnoznikLuka: number; // mnożnik luki cenowej
  mnoznikUslugi: number; // mnożnik usług/dostępności (profil)
  udzialKwalifikujacyPct: number | null; // % kwalifikujący się dochodowo (luka czynszowa)
  napiecie: number; // 0–100 (napięcie mieszkaniowe)
  interpretacja: string; // wniosek z kombinacji (sekcja 7)
  flagi: string[];
  pewnosc: number; // 0–100
  skladniki: SkladnikPopytu[];
}

/** Flaga/sygnał do panelu „Flagi i sygnały" (kolor wg tonu). */
export interface Sygnal {
  tekst: string;
  ton: "ostrzezenie" | "pozytyw" | "info";
}

/** Realna biała plama danych — czego aplikacja faktycznie nie pobrała/nie ma podpiętego. */
export interface BrakDanych {
  tytul: string; // np. „MPZP / Studium uwarunkowań"
  opis: string; // dlaczego brak / które źródło
  wplyw: string; // wpływ na wynik/pewność
}

export interface WynikPoziom1 {
  dzialkaId: string;
  bramki: {
    status: StatusBramki; // zagregowany
    flagi: string[];
    szczegoly: WynikBramki[];
  };
  scoreMlodzi: number; // 0–100
  scoreSeniorzy: number; // 0–100
  profilRekomendowany: ProfilRekomendowany;
  werdyktMlodzi: Werdykt;
  werdyktSeniorzy: Werdykt;
  werdykt: Werdykt; // werdykt rekomendowanego profilu, po nałożeniu bramek
  pewnosc: number; // 0–100
  wymiary: WynikWymiaru[];
  kluczoweLiczby: KluczoweLiczby;
  flagi: string[];
  /** Dekompozycja popytu (W2) per profil — wewnętrzny/zewnętrzny + mnożniki. */
  popyt: { mlodzi: WynikPopytu; seniorzy: WynikPopytu };
  /** Flagi i sygnały (ostrzeżenia + pozytywy) do panelu wyników. */
  sygnaly: Sygnal[];
  /** Realne białe plamy — czego aplikacja nie pobrała (z wpływem na pewność). */
  braki: BrakDanych[];
}

// ────────────────────────────────────────────────────────────────────────────
// WYNIK POZIOMU 2 — rekomendacja modelu zabudowy
// ────────────────────────────────────────────────────────────────────────────

export type Typologia =
  | "niska_wielorodzinna"
  | "sredniowysoka_wielorodzinna"
  | "pierzejowa_mixed_use"
  | "senioralna_wspomagana";

export interface MixMetrazy {
  etykieta: string; // np. "kawalerka 25–35 m²"
  metrazSredniM2: number;
  udzialPct: number;
}

export interface WariantZabudowy {
  nazwa: string;
  profil: Profil;
  typologia: Typologia;
  liczbaKondygnacji: number;
  powZabudowyM2: number;
  powCalkowitaM2: number;
  pumM2: number; // powierzchnia użytkowa mieszkalna
  powWspolneUslugoweM2: number;
  liczbaMieszkan: number;
  mixMetrazy: MixMetrazy[];
  miejscaParkingowe: number;
  parkingPodziemny: boolean;
  windaWymagana: boolean;
  uzasadnienie: string;
}

export interface Obwiednia {
  maxPowZabudowyM2: number;
  powCalkowitaNadziemnaM2: number;
  pumM2: number;
  maxKondygnacje: number;
  zrodloWskaznikow: "mpzp" | "plan_ogolny" | "sasiedztwo_fallback";
  pewnoscObwiedni: number; // 0–100 (niższa przy fallbacku)
}

export interface WynikPoziom2 {
  dzialkaId: string;
  obwiednia: Obwiednia;
  warianty: WariantZabudowy[];
  flagiRyzyka: string[];
}

// ────────────────────────────────────────────────────────────────────────────
// WYNIK POZIOMU 3 — model finansowy SIM
// ────────────────────────────────────────────────────────────────────────────

export type Rezim = "A_SBC_2026" | "B_program_2027" | "C_upside_unijny";
export type Scenariusz = "konserwatywny" | "oczekiwany" | "korzystny";

export interface FazaOsiCzasu {
  nazwa: string;
  miesiace: number;
}

export interface OsCzasu {
  fazy: FazaOsiCzasu[];
  miesiacyDoStartuBudowy: number;
  miesiacyDoOddania: number;
  rokStartuBudowy: number;
  rokOddania: number;
}

export interface KosztPrzedsiewziecia {
  grunt: number;
  budowa: number;
  uzbrojenie: number;
  projektPrzygotowanie: number;
  kosztyFinansowe: number;
  rezerwa: number;
  razem: number;
}

export interface MontazFinansowy {
  grant: number;
  kredyt: number;
  partycypacjaNajemcow: number;
  wkladGminy: number;
  srodkiWlasne: number;
  wymaganaDotacja: number; // luka do domknięcia (grant/partycypacja ponad standard)
}

export interface WynikScenariusza {
  scenariusz: Scenariusz;
  rezim: Rezim;
  koszt: KosztPrzedsiewziecia;
  montaz: MontazFinansowy;
  czynszWynikowyM2: number;
  pulapCzynszuM2: number;
  czynszPrzekraczaPulap: boolean;
  dscr: number;
  domyka: boolean;
  wymaganaDotacjaPct: number; // % kosztu przedsięwzięcia
  rataRocznaKredytu: number;
}

export interface WrazliwoscPozycja {
  parametr: string;
  zmiana: string;
  wplywNaDotacjePp: number; // zmiana wymaganej dotacji w punktach procentowych
}

export interface WynikPoziom3 {
  dzialkaId: string;
  wariantNazwa: string;
  rezimDomyslny: Rezim;
  osCzasu: OsCzasu;
  scenariusze: WynikScenariusza[]; // konserwatywny / oczekiwany / korzystny
  petlaZwrotna: boolean; // czy program nie domyka → powrót do P2
  wrazliwosc: WrazliwoscPozycja[];
  flagi: string[];
  /**
   * Analiza z ankiety finansowej (brama P3): dobrany montaż, dostępne instrumenty,
   * traktowanie gruntu, ostrzeżenia, flagi `tbc` i porównanie reżimów. Obecna, gdy
   * przekazano profil finansowy; `null` dla analizy bez ankiety (kompatybilność wstecz).
   */
  analizaFinansowa: AnalizaFinansowa | null;
}

// ────────────────────────────────────────────────────────────────────────────
// WYNIK ZBIORCZY (pipeline end-to-end)
// ────────────────────────────────────────────────────────────────────────────

export interface WynikAnalizy {
  dane: DaneDzialki;
  poziom1: WynikPoziom1;
  poziom2: WynikPoziom2;
  poziom3: WynikPoziom3;
}
