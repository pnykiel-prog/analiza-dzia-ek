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

export type KlasaMiasta = "A" | "B" | "C" | "D";

/** Ośrodek w zasięgu oddziaływania (kanał C, model pierścieni). */
export interface MiastoWPoblizu {
  nazwa: string;
  klasa: KlasaMiasta;
  odlegloscKm: number;
  pierscien: number; // 0 = rdzeń
  sila: number; // 0–100
}

/** Bliskość aglomeracji (kanał C) — sygnał + lista ośrodków + modyfikator per profil. */
export interface BliskoscAglomeracji {
  sygnal: number; // 0–100
  miastaWPoblizu: MiastoWPoblizu[];
  modyfikator: { mlodzi: number; seniorzy: number };
}

/** Ręczny wpis pojedynczego przystanka (panel transportu). Liczby przypisane do TEGO przystanka. */
export interface PrzystanekReczny {
  odlegloscM: Maybe<number>; // odległość do przystanku [m] — walkability
  liczbaLinii: Maybe<number>; // linie przez ten przystanek — jakość obsługi
  kursyDzien: Maybe<number>; // kursów w dzień — jakość obsługi (główna)
  kursyNoc: Maybe<number>; // kursów w nocy — niuans (mała waga, głównie młodzi)
}

/** Ręczny panel transportu (wytyczne panel_transport): deklaracja + przystanki. */
export interface DaneTransportu {
  jest: boolean; // „Jest" / „Nie ma" komunikacji publicznej (deklaracja klienta)
  przystanki: PrzystanekReczny[]; // wypełniane tylko gdy jest === true
}

/** Prowenancja stawki wartości odtworzeniowej (warstwa WO) — do jawnych założeń M3. */
export interface WartoscOdtworzeniowaMeta {
  jednostka: string;
  typ: "miasto_wydzielone" | "wojewodztwo_reszta" | "benchmark";
  okresOd: string | null;
  okresDo: string | null;
  obwieszczenie: string | null;
  benchmark: boolean;
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
  /** Zwartość kształtu (Polsby-Popper 0..1) z geometrii ULDK — prognoza potencjału. */
  zwartoscKsztaltu?: Maybe<number>;
  /** Krótszy bok minimalnego prostokąta otaczającego [m] — szerokość zabudowalna. */
  minSzerokoscM?: Maybe<number>;
  /** Deklaracja obecności MPZP (adnotacja „do potwierdzenia w planie" w prognozie). */
  mpzpObecnosc?: "jest" | "brak" | "nieznane";
  budynkiIstniejace: Maybe<boolean>;

  // A/B. Użytki i klasa gruntu (EGiB)
  klasaUzytku: Maybe<string>; // np. "B", "RIVa", "Ls"
  gruntLesny: Maybe<boolean>;
  gruntRolnyKlasaIdoIII: Maybe<boolean>;

  // B. Status planistyczny i prawny
  statusPlanistyczny: StatusPlanistyczny;
  /** Czy pytanie o MPZP zostało rozstrzygnięte przez wypełniającego (ręczna deklaracja). */
  mpzpZadeklarowany?: Maybe<boolean>;
  /** Ręcznie wprowadzona podstawa planistyczna (P1, S3): typ + symbol/funkcja. */
  podstawa?: PodstawaPlanistyczna;
  /** M2: surowe wskaźniki wpisane ręcznie (kaskada P2 — wchodzą tylko gdy potwierdzone). */
  wskaznikiReczne?: Maybe<WskaznikiReczne>;
  /** M2: klient potwierdził, że wskaźniki ręczne to realne dane z MPZP/dokumentu urzędowego. */
  wskaznikiPotwierdzone?: Maybe<boolean>;
  /** Metryka planu z KIMPZP (gmina wektorowa): symbol, przeznaczenie, uchwała, data. */
  mpzpMeta?: MetrykaPlanu | null;
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
  /** M2 kanał C: bliskość aglomeracji z pierścieni klas miast (sygnał + modyfikator per profil). */
  bliskoscAglomeracji?: Maybe<BliskoscAglomeracji>;
  /**
   * Transport zbiorowy — RĘCZNY panel (wytyczne panel_transport). Zastępuje automatyzację
   * GTFS/OSM. Modyfikator jakości + flaga (NIE bramka). `null` = pominięte/nieznane.
   */
  transport?: Maybe<DaneTransportu>;

  // G. Infrastruktura społeczna (różne dla profili)
  uslugiPodstawowePieszo: Maybe<boolean>; // tkanka z usługami w zasięgu spaceru (seniorzy)
  pozWZasiegu: Maybe<boolean>; // bliskość POZ (seniorzy)
  zlobkiSzkolyWZasiegu: Maybe<boolean>; // (młodzi)
  /** M2: odległości pieszo [m] (auto z OSM lub wpisane przez klienta) — klucze wg KONFIG_M2. */
  odleglosciM2?: Maybe<Record<string, number>>;
  /** M2: typowa wysokość zabudowy w okolicy [piętra] (auto z BDOT lub wpisane). */
  wysokoscOkolicyPieter?: Maybe<number>;

  // F. Demografia i rynek pracy (GUS BDL)
  udzialAktywniPct: Maybe<number>;
  medianaAktywniWoj: Maybe<number>;
  saldoMigracjiMlodzi: Maybe<number>; // dodatnie/zero/ujemne
  udzial65PlusPct: Maybe<number>;
  /** NSP 2021: udział gospodarstw BEZ tytułu własności [%] (najem/lokatorskie/użyczenie) —
   *  per gmina, kalibracja „bez własnego lokalu" (definicja profili). Null → estymata z config. */
  udzialGospodarstwBezWlasnosciPct?: Maybe<number>;
  // F2. Liczby bezwzględne i dochód (popyt P1 — trójdzielny podział, benchmarki per mieszkaniec)
  liczbaMieszkancowGminy?: Maybe<number>; // ludność ogółem gminy
  liczbaAktywni?: Maybe<number>; // liczebność 20–64 aktywni, poniżej wieku emerytalnego (nie %)
  liczba65Plus?: Maybe<number>; // liczebność 65+ (nie %)
  dochodPrzecietnyGmina?: Maybe<number>; // proxy dochodu gosp. (wynagrodzenie/dochód gminy), miesięcznie
  naplywZameldowanNa1000?: Maybe<number>; // napływ zameldowań (śr. 3–5 lat) na 1000 mieszk. — A1
  odplywMlodychNa1000?: Maybe<number>; // odpływ (wymeldowania) młodych na 1000 mieszk. — A3
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
  /** Prowenancja wartości odtworzeniowej (warstwa WO): jednostka, okres obwieszczenia, źródło. */
  woMeta?: WartoscOdtworzeniowaMeta | null;
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

// ── Ocena popytu P1 (wersja pełna): 4 werdykty, 2 natury ─────────────────────

export type NaturaWerdyktu = "spoleczny" | "komunalny";
export type KluczWerdyktu = "spolecznyMlodzi" | "spolecznySeniorzy" | "komunalnyMlodzi" | "komunalnySeniorzy";

/** Trójdzielny podział dochodowy grupy docelowej (K/S/R) → liczby bezwzględne. */
export interface KwalifikacjeProfil {
  nGrupa: number | null; // liczebność 20–39 / 65+ (GUS BDL)
  qK: number | null; // udział segmentu komunalnego (dochód < próg dolny)
  qS: number | null; // udział segmentu społecznego (próg dolny ≤ dochód < górny)
  nKomunalny: number | null; // nGrupa × qK
  nSpoleczny: number | null; // nGrupa × qS
  estymacja: boolean; // czy udziały q estymowane (rozkład regionalny) → niższa pewność
}

/** Pojedynczy werdykt (jedno z czterech pól siatki). */
export interface WerdyktP1 {
  klucz: KluczWerdyktu;
  natura: NaturaWerdyktu;
  profil: Profil;
  score: number; // 0–100
  werdykt: Werdykt; // zielony / zolty / czerwony
  liczbaKwalifikujacych: number | null; // segment S (społeczne) lub K (komunalne)
  pewnosc: number; // 0–100
  flagi: string[];
  komentarz: string;
  /** Proporcja kohortowa [%]: kwalifikujący w segmencie ÷ liczebność WŁASNEJ kohorty (nie gmina). */
  proporcjaKohortowaPct?: number | null;
  /** Poziom słowny popytu z proporcji kohortowej: „niski" | „umiarkowany" | „wysoki". */
  poziom?: string;
  /** true = brak podstawy ludnościowej → werdykt „nieoznaczony" (szary, niska pewność, nie zero/„nie nadaje się"). */
  nieoznaczony?: boolean;
}

/** Pełna ocena popytu P1 — siatka 4 werdyktów + kwalifikacje (popyt CZYSTO niekorygowany). */
export interface OcenaPopytuP1 {
  kwalifikacje: { mlodzi: KwalifikacjeProfil; seniorzy: KwalifikacjeProfil };
  werdykty: Record<KluczWerdyktu, WerdyktP1>;
  rekomendowanyKierunek: KluczWerdyktu;
  pewnoscOgolna: number;
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

// ── Poziom 1 (rewizja): działka → podstawa planistyczna → pojemność × popyt ──

export type PodstawaTyp = "PROGNOZA" | "MPZP" | "WZ" | "PnB" | "BRAK";

/** Podstawa oceny pojemności na P1. Domyślnie „PROGNOZA" (z kształtu + lokalizacji). */
export interface PodstawaPlanistyczna {
  typ: PodstawaTyp;
  symbol?: string; // symbol MPZP (np. MW, MN) — opcjonalna adnotacja
  funkcja?: string; // opis funkcji dla WZ/PnB
  zrodlo: "ręczne" | "prognoza" | "kimpzp";
}

/** Surowe wskaźniki wpisane ręcznie w P2 (przed rozstrzygnięciem kaskady). */
export interface WskaznikiReczne {
  intensywnosc?: number | null; // FAR
  maxWysokoscM?: number | null; // wysokość legalna z wypisu
  maxPowZabudowyPct?: number | null; // % zabudowy
  minPbcPct?: number | null; // PBC
}

/** Źródło wartości wskaźnika (kaskada priorytetów). */
export type ZrodloWskaznika = "auto" | "deklarowane" | "prognoza";

/** Pojedynczy wskaźnik po rozstrzygnięciu kaskady — wartość + prowenancja + pewność. */
export interface PoleWskaznika {
  wartosc: number;
  zrodlo: ZrodloWskaznika;
  pewnosc: number; // 0–100 (auto wysoka, deklarowane średnia, prognoza niska)
}

/** Zestaw wskaźników rozstrzygnięty per pole (auto > ręczne potwierdzone > prognoza). */
export interface RozstrzygnieteWskazniki {
  kZabPct: PoleWskaznika; // % zabudowy (k_zab)
  far: PoleWskaznika; // intensywność (FAR)
  kondygnacje: PoleWskaznika; // maks. kondygnacje (limit — legalne > fizyczne)
  pbcPct: PoleWskaznika; // PBC
  pewnosc: number; // pewność kompletu = najsłabsze użyte źródło
  flagi: string[]; // walidacja warstwy ręcznej + rozbieżności
}

/** Metryka planu miejscowego z KIMPZP (gmina wektorowa udostępnia atrybuty). */
export interface MetrykaPlanu {
  symbol?: string; // symbol z planu, np. „11MWs"
  standard?: string; // standard przeznaczenia, np. „MW", „MN"
  opis?: string; // opis przeznaczenia
  nazwaPlanu?: string; // nazwa MPZP
  uchwala?: string; // nr uchwały
  dataWejscia?: string; // data wejścia w życie
  stawkaPct?: number | null; // renta planistyczna [%]
  // Parametry zabudowy z planu (gdy serwis je udostępnia, np. schemat warszawski).
  intensywnoscZabudowy?: string; // INTEN_ZAB — dozwolona intensywność zabudowy
  maxWysokoscM?: string; // MAX_WYS — maksymalna wysokość zabudowy
  jednostka?: string; // dzielnica / jednostka administracyjna w planie
  www?: string; // odnośnik do karty/rysunku planu
}

/** Sygnał z sąsiedztwa do prognozy potencjału (docelowo BDOT + NMT; teraz deterministyczny). */
export interface SasiedztwoDane {
  pokrycieUdzial: number; // pokrycie zabudową w buforze (0..~0.6)
  typoweKondygnacje: number; // mediana liczby kondygnacji w otoczeniu
  liczbaProbki: number; // liczba budynków w próbie (do pewności)
  wysokosciDostepne: boolean; // czy kondygnacje realne, czy fallback
  spadekPct: number; // średni spadek terenu [%]
  zrodlo: "deterministyczne" | "bdot_nmt"; // pochodzenie sygnału
}

/** Prognoza orientacyjnego potencjału zabudowy (zastępuje ręczne wskaźniki na P1). */
export interface PrognozaPotencjalu {
  etykieta: string; // „orientacyjny potencjał zabudowy"
  powierzchniaDzialkiM2: number;
  szacowanePokrycie: number; // udział zabudowy 0..1
  szacowaneKondygnacje: number;
  powierzchniaZabudowyM2: number;
  pumM2: number;
  mieszkania: { mlodzi: number; seniorzy: number };
  pewnosc: number; // 0–100
  flagi: string[];
  flagaMpzp: "jest" | "brak" | "nieznane";
  sasiedztwo: SasiedztwoDane;
}

/** Pojemność zabudowy wyliczona z powierzchni działki i ręcznych wskaźników. */
export interface PojemnoscP1 {
  maxPowZabudowyM2: number | null;
  powCalkowitaM2: number | null;
  pumM2: number | null;
  szacLiczbaMieszkanMlodzi: number | null;
  szacLiczbaMieszkanSeniorzy: number | null;
}

/** Forma zabudowy — dwie kategorie skali (bez wskazywania typologii). */
export type FormaZabudowy = "niska" | "wysoka";

/**
 * Pojemność jednej formy zabudowy (niska ≤2 kond. / wysoka >2 kond.) — wspólny
 * łańcuch `Pz → GFA → PU → PUM → mieszkania`. Mieszkania liczone ZAWSZE z PUM
 * (po odjęciu powierzchni wspólnych i usług) — bez zawyżania z PU.
 */
export interface PojemnoscForma {
  forma: FormaZabudowy;
  kondygnacje: number;
  powZabudowyM2: number; // Pz (footprint)
  powCalkowitaM2: number; // GFA = Pz × kondygnacje
  puM2: number; // powierzchnia użytkowa = GFA × η_PU
  pumM2: number; // powierzchnia użytkowa MIESZKALNA = PU × (1 − wspólne − usługi)
  mieszkania: { mlodzi: number; seniorzy: number };
  lokali: number; // reprezentatywna skala (liczba lokali dla metrażu młodych)
}

/** Rozstrzygnięcie bramki wielkości/kształtu (M1). */
export type RozstrzygniecieBramki = "ok" | "nieprzydatna" | "scalenie" | "nizsza_oplacalnosc" | "konflikt";

/**
 * Bramka wielkości/kształtu (M1, po geometrii ULDK, PRZED popytem/pojemnością).
 * Dwie natury: fizyczna wykonalność (twarda, odrzuca bez pytania) + próg
 * opłacalności (miękki punkt decyzyjny — obserwacja z zaproszeniem, nie wyrok).
 */
export interface BramkaWielkosci {
  wynik: RozstrzygniecieBramki;
  komunikat: string;
  fizycznieWykonalna: boolean;
  formaRekomendowana: FormaZabudowy; // najefektywniejsza (najwięcej lokali)
  niska: PojemnoscForma;
  wysoka: PojemnoscForma;
  lokali: { niska: number; wysoka: number };
  ponizejProguOplacalnosci: boolean;
  progOplacalnosci: number; // próg rekomendowanej formy (niska 20 / wysoka 40)
  konfliktProgow: boolean; // wysoka poniżej progu, niska w progu → decyzja klienta
  notaSkali?: string; // dyskretna nota o skali (po zgodzie klienta)
}

/** Dopasowanie pojemność↔popyt per profil → werdykt. */
export interface DopasowanieProfil {
  profil: Profil;
  popyt: number; // 0–100 (popyt realizowalny bez usług)
  pojemnoscMieszkan: number | null;
  score: number; // 0–100 (dopasowanie)
  werdykt: Werdykt;
  komentarz: string;
}

export interface WynikPoziom1 {
  dzialkaId: string;
  powierzchniaM2: number;
  podstawa: PodstawaPlanistyczna;
  funkcjaMieszkaniowaDozwolona: boolean;
  /** Bramka wielkości/kształtu: fizyczna wykonalność + forma zabudowy + próg opłacalności. */
  bramkaWielkosci: BramkaWielkosci;
  /** Prognoza potencjału zabudowy (z kształtu + sąsiedztwa) — źródło pojemności na P1. */
  prognoza: PrognozaPotencjalu;
  /** Ocena popytu P1 (pełna): siatka 4 werdyktów, kwalifikacje, atrakcyjność migracyjna. */
  ocenaPopytu: OcenaPopytuP1;
  pojemnosc: PojemnoscP1;
  /** Popyt per profil (na P1 bez mnożnika usług). */
  popyt: { mlodzi: WynikPopytu; seniorzy: WynikPopytu };
  dopasowanie: { mlodzi: DopasowanieProfil; seniorzy: DopasowanieProfil };
  scoreMlodzi: number; // = dopasowanie.mlodzi.score
  scoreSeniorzy: number;
  profilRekomendowany: ProfilRekomendowany;
  werdyktMlodzi: Werdykt;
  werdyktSeniorzy: Werdykt;
  werdykt: Werdykt;
  pewnosc: number; // 0–100
  tryb: "pelny" | "ograniczony"; // ograniczony = brak podstawy planistycznej
  flagi: string[];
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
  /** Prowenancja per wskaźnik (kaskada auto/deklarowane/prognoza) — do UI i pewności. */
  prowenancja?: RozstrzygnieteWskazniki;
}

// ── Ocena M2 per profil (sześć kanałów A–F, wg mapa_wejscia_wyjscia_M2.md) ──────

/** Werdykt M2 dla jednego profilu — domknięcie popytu warunkami M2. */
export interface WerdyktProfiluM2 {
  profil: Profil;
  popytM1: number; // wejściowy popyt z M1 (0–100)
  dostepnoscA: number; // mnożnik kanału A (0..1)
  modyfikatorC: number; // mnożnik kanału C (0..~1.2)
  popytRealizowalny: number; // popytM1 × A × C (0–100)
  przydatnoscEkonomiczna: number; // kanał B (0–100)
  score: number; // syntetyczny wynik profilu (0–100)
  werdykt: Werdykt; // pasmo score
  obsluzalny: boolean; // kanał A — czy profil nieprzekroczył progu (false = zdyskwalifikowany)
  dopuszczalny: boolean; // kanał E — bramki bezwzględne (false = odrzucony)
  powody: string[]; // dyskwalifikacje/odrzucenia i istotne modyfikatory
}

/**
 * Pozycja dostępności (panel tekstowy M2) — WSZYSTKIE kategorie równorzędnie:
 * `typ: "bramka"` (usługa pieszo, kanał A — może dyskwalifikować) lub
 * `typ: "modyfikator"` (otoczenie/jakość życia — tylko bonus, nigdy dyskwalifikacja).
 */
export interface DostepnoscPozycja {
  klucz: string;
  etykieta: string;
  m: number | null; // odległość [m]; null = nieustalona (pytana ręcznie / niższa pewność)
  typ: "bramka" | "modyfikator";
  profile: Profil[]; // dla których profili istotna
  progi: { komfortM: number; dyskwalifikacjaM: number } | null; // reprezentatywne progi (do etykiety)
  status: "komfort" | "gradient" | "bramka" | "daleko" | "brak";
  /**
   * 7.3 — skala dostępu (prezentacja, NIE zmienia funkcji bramki): „pieszo" gdy
   * próg dyskwalifikacji mieści się w zasięgu spaceru, „dojazd" gdy tolerancja
   * sięga kilku km (np. 5 km do POZ to dojazd, nie spacer). Tylko dla usług (kanał A).
   */
  skalaDostepu?: "pieszo" | "dojazd";
}

/** Dostępność do panelu M2 — jedna lista pozycji (usługi + otoczenie równorzędnie). */
export interface Dostepnosc {
  pozycje: DostepnoscPozycja[];
}

/** Synteza M2: werdykt per profil + rekomendacja + dopuszczalność. */
export interface OcenaM2 {
  werdykty: Record<Profil, WerdyktProfiluM2>;
  dopuszczalnosc: StatusBramki; // kanał E zbiorczo
  rekomendacja: Profil | "brak"; // najlepszy z dopuszczalnych/obsługiwalnych; „brak" gdy żaden
  powodBrak?: string; // uzasadnienie „BRAK — lokalizacja nieodpowiednia"
  flagi: string[]; // informacyjne (np. „teren bez komunikacji zbiorowej") — BEZ wpływu na punktację
  pewnoscM2: number; // 0–100 — obniżana przez pozycje „do weryfikacji" (nie zmienia werdyktu)
}

export interface WynikPoziom2 {
  dzialkaId: string;
  obwiednia: Obwiednia;
  warianty: WariantZabudowy[];
  flagiRyzyka: string[];
  /** Uwarunkowania przeniesione z P1: bramki środowiskowe/formalne, sygnały, braki, kluczowe liczby. */
  bramki: { status: StatusBramki; flagi: string[]; szczegoly: WynikBramki[] };
  sygnaly: Sygnal[];
  braki: BrakDanych[];
  kluczoweLiczby: KluczoweLiczby;
  /** Odległości do usług pieszo + otoczenia (panel tekstowy dostępności). */
  dostepnosc: Dostepnosc;
  /** Domknięcie systemowe: werdykt M2 per profil (kanały A–F) + rekomendacja. */
  ocenaM2: OcenaM2;
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
