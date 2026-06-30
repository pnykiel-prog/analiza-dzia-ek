/**
 * Resolver działek: kompozycja identyfikatorów z TERYT, pobranie danych
 * automatycznych, walidacja (istnienie, przyleganie) i scalenie geometrii w
 * jeden „teren inwestycji".
 *
 * Provider przykładowy: dane „automatyczne" pochodzą z datasetu; realna wersja
 * odpytywałaby ULDK/EGiB/GUS/OSM. Brak danych = biała plama (null), nie błąd.
 */

import type { DaneDzialki } from "../types";
import { DZIALKI_PRZYKLADOWE } from "./sample";
import { skomponujId, type PozycjaDzialki } from "../teryt";
import { statusRynkowy } from "../fieldModes";

/** Orientacyjne mediany regionalne (fallback rynkowy, zł/m²). */
const MEDIANA_REGIONALNA: Record<string, { czynsz: number; cenaNowych: number; wartoscOdtworzeniowa: number }> = {
  mazowieckie: { czynsz: 55, cenaNowych: 11000, wartoscOdtworzeniowa: 7766 },
  wielkopolskie: { czynsz: 47, cenaNowych: 9200, wartoscOdtworzeniowa: 6900 },
  lubelskie: { czynsz: 38, cenaNowych: 7600, wartoscOdtworzeniowa: 6200 },
  malopolskie: { czynsz: 52, cenaNowych: 12500, wartoscOdtworzeniowa: 7400 },
  pomorskie: { czynsz: 54, cenaNowych: 12000, wartoscOdtworzeniowa: 7300 },
  dolnoslaskie: { czynsz: 50, cenaNowych: 11000, wartoscOdtworzeniowa: 7100 },
};
const MEDIANA_DOMYSLNA = { czynsz: 42, cenaNowych: 8500, wartoscOdtworzeniowa: 6500 };

export function medianaRegionalna(woj: string) {
  return MEDIANA_REGIONALNA[woj] ?? MEDIANA_DOMYSLNA;
}

export interface WynikPozycji {
  pozycja: PozycjaDzialki;
  id: string;
  znaleziona: boolean;
  znanyTeryt: boolean;
}

export interface MetaRozwiazania {
  pozycje: WynikPozycji[];
  przylegajace: boolean;
  bledy: string[];
  /** Pola wypełnione automatycznie (niepuste w scalonych danych). */
  poleAutomatyczne: string[];
  /** Symulowana liczba ofert N dla pól rynkowych (z drabiny przestrzennej). */
  rynek: { czynszN: number; cenaNowychN: number };
}

export interface RozwiazanieDzialek {
  dane: DaneDzialki | null;
  meta: MetaRozwiazania;
}

function scalDane(zrodla: DaneDzialki[], pozycje: PozycjaDzialki[], idy: string[]): DaneDzialki {
  // Scalony „teren inwestycji": suma powierzchni, front = największy, reszta z
  // pierwszej znalezionej działki (reprezentatywnej).
  const baza = zrodla[0];
  const powierzchnia = zrodla.reduce((s, d) => s + d.powierzchniaM2, 0);
  const front = Math.max(...zrodla.map((d) => d.frontM ?? 0)) || null;
  const pierwsza = pozycje[0];
  return {
    ...baza,
    id: idy.join(" + "),
    gmina: baza.gmina || pierwsza.gmina,
    powiat: baza.powiat || pierwsza.powiat,
    wojewodztwo: baza.wojewodztwo || pierwsza.wojewodztwo,
    powierzchniaM2: powierzchnia,
    frontM: front,
  };
}

/** Pola, których obecność liczymy jako „dana automatyczna dostępna". */
const POLA_AUTO: (keyof DaneDzialki)[] = [
  "statusPlanistyczny",
  "wskaznikiPlanistyczne",
  "sredniSpadekPct",
  "odlegloscDoSieciM",
  "czasDojazdAglomeracjaMin",
  "udzial2039Pct",
  "udzial65PlusPct",
  "natura2000",
  "wartoscOdtworzeniowaM2",
  "czynszRynkowyM2",
  "cenaNowychM2",
  "pustostanyPct",
];

export function rozwiazDzialki(pozycje: PozycjaDzialki[]): RozwiazanieDzialek {
  const bledy: string[] = [];
  const wynikiPozycji: WynikPozycji[] = [];
  const znalezione: DaneDzialki[] = [];
  const idy: string[] = [];

  for (const p of pozycje) {
    if (!p.numer.trim()) {
      bledy.push("Pozycja bez numeru działki — pominięta.");
      continue;
    }
    const { id, znanyTeryt } = skomponujId(p);
    const dane = DZIALKI_PRZYKLADOWE.find((d) => d.id === id);
    wynikiPozycji.push({ pozycja: p, id, znaleziona: !!dane, znanyTeryt });
    idy.push(id);
    if (dane) znalezione.push(dane);
    else bledy.push(`Działka ${id} nie znaleziona w ULDK (provider przykładowy).`);
  }

  // Walidacja przylegania (symulowana): wymaga, by wszystkie istniały.
  const przylegajace = wynikiPozycji.length > 0 && wynikiPozycji.every((w) => w.znaleziona);
  if (wynikiPozycji.length > 1 && !przylegajace) {
    bledy.push("Nie można potwierdzić, że działki tworzą spójny, przylegający blok.");
  }

  let dane: DaneDzialki | null = null;
  if (znalezione.length > 0) {
    dane = scalDane(znalezione, pozycje, idy);
  } else if (pozycje.length > 0) {
    // Brak danych automatycznych: budujemy szkielet z samej identyfikacji.
    const p = pozycje[0];
    dane = {
      id: idy.join(" + ") || skomponujId(p).id,
      teryt: "",
      gmina: p.gmina,
      powiat: p.powiat,
      wojewodztwo: p.wojewodztwo,
      powierzchniaM2: 0,
      frontM: null,
      proporcjaBokow: null,
      budynkiIstniejace: null,
      klasaUzytku: null,
      gruntLesny: null,
      gruntRolnyKlasaIdoIII: null,
      statusPlanistyczny: "brak_danych",
      wskaznikiPlanistyczne: null,
      zabudowaMieszkaniowaWSasiedztwie: null,
      przeznaczenieSprzeczneZMieszkaniowa: null,
      dostepDrogaPubliczna: null,
      sredniSpadekPct: null,
      ryzykoPowodzioweSzczegolne: null,
      osuwisko: null,
      terenGorniczy: null,
      odlegloscDoSieciM: null,
      odlegloscDoZabudowyM: null,
      czasDojazdAglomeracjaMin: null,
      przystanekZCzestotliwoscia: null,
      uslugiPodstawowePieszo: null,
      pozWZasiegu: null,
      zlobkiSzkolyWZasiegu: null,
      udzial2039Pct: null,
      mediana2039Woj: null,
      saldoMigracjiMlodzi: null,
      udzial65PlusPct: null,
      trend65Plus: null,
      populacjaStabilna: null,
      trendLudnosc: null,
      bezrobociePct: null,
      liczbaPodmiotowGosp: null,
      natura2000: null,
      ochronaWykluczajaca: null,
      strefaKonserwatorska: null,
      wartoscOdtworzeniowaM2: null,
      czynszRynkowyM2: null,
      cenaNowychM2: null,
      kosztBudowyM2: null,
      cenaGruntu: null,
      pustostanyPct: null,
      dochodyGospDomowe: null,
    };
  }

  const poleAutomatyczne = dane
    ? POLA_AUTO.filter((k) => dane![k] !== null && dane![k] !== undefined).map(String)
    : [];

  // Symulacja drabiny przestrzennej: dostępna dana rynkowa → N wiarygodne,
  // brak → N poniżej progu (uruchamia fallback/override na P2).
  const rynek = {
    czynszN: dane?.czynszRynkowyM2 != null ? 35 : 4,
    cenaNowychN: dane?.cenaNowychM2 != null ? 32 : 6,
  };

  return {
    dane,
    meta: { pozycje: wynikiPozycji, przylegajace: wynikiPozycji.length <= 1 ? true : przylegajace, bledy, poleAutomatyczne, rynek },
  };
}

export { statusRynkowy };
