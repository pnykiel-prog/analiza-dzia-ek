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
import { pobierzDzialkePoId, pobierzCentroid4326 } from "./uldk";
import { centroid, czyPrzylegaja } from "../geo";
import { uruchomKonektory } from "./connectors";
import type { MetaPola, Teren } from "./connectors/types";
import { medianaRynkowa, wartoscOdtworzeniowaDla } from "../config-rynek";

export type ZrodloDanych = "demo" | "uldk" | "brak";

/** Podpowiedzi regionalne (fallback) dla prefillu P2/P3 — z tabel M3. */
export function medianaRegionalna(woj: string, gmina = "") {
  const m = medianaRynkowa(woj);
  const w = wartoscOdtworzeniowaDla(woj, gmina);
  return { czynsz: m.czynsz, cenaNowych: m.cenaNowych, wartoscOdtworzeniowa: w.wartosc };
}

export interface WynikPozycji {
  pozycja: PozycjaDzialki;
  id: string;
  znaleziona: boolean;
  znanyTeryt: boolean;
  zrodlo: ZrodloDanych;
}

export interface MetaRozwiazania {
  pozycje: WynikPozycji[];
  przylegajace: boolean;
  bledy: string[];
  /** Pola wypełnione automatycznie (niepuste w scalonych danych). */
  poleAutomatyczne: string[];
  /** Symulowana liczba ofert N dla pól rynkowych (z drabiny przestrzennej). */
  rynek: { czynszN: number; cenaNowychN: number };
  /** Raport źródeł danych (status per konektor). */
  raportZrodel: { klucz: string; zrodlo: string; status: string; debug?: string }[];
  /** Metadane pól wypełnionych przez konektory. */
  metaPol: MetaPola[];
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

/** Pusty szkielet danych z samej identyfikacji (reszta = białe plamy). */
function szkieletDanych(id: string, p: PozycjaDzialki): DaneDzialki {
  return {
    id,
    teryt: p.gminaTeryt ?? "",
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

export async function rozwiazDzialki(pozycje: PozycjaDzialki[]): Promise<RozwiazanieDzialek> {
  const bledy: string[] = [];
  const wynikiPozycji: WynikPozycji[] = [];
  const znalezione: DaneDzialki[] = [];
  const wktZnalezione: string[] = []; // geometrie z ULDK (do centroidu i przylegania)
  const idy: string[] = [];
  let idUldkPierwszy: string | null = null; // do centroidu WGS84 (Overpass)

  for (const pWej of pozycje) {
    const idWpisany = pWej.idBezposredni?.trim();
    if (!idWpisany && !pWej.numer.trim()) {
      bledy.push("Pozycja bez numeru działki (lub identyfikatora) — pominięta.");
      continue;
    }
    // Kod TERYT gminy: z klienta (kaskada) lub mini-słownika. ULDK nie udostępnia
    // API do listowania jednostek, więc dla działek spoza mini-słownika najpewniejszy
    // jest tryb bezpośredniego identyfikatora (skomponujId go honoruje).
    const p = pWej;
    const { id, znanyTeryt } = skomponujId(p);
    idy.push(id);

    // 1) Provider demonstracyjny (działki przykładowe z bogatymi atrybutami).
    let dane: DaneDzialki | null = DZIALKI_PRZYKLADOWE.find((d) => d.id === id) ?? null;
    let zrodlo: ZrodloDanych = dane ? "demo" : "brak";

    // 2) Realne ULDK — geometria + atrybuty administracyjne (reszta to białe plamy).
    if (!dane) {
      const u = await pobierzDzialkePoId(id);
      if (u) {
        dane = {
          ...szkieletDanych(id, p),
          powierzchniaM2: u.powierzchniaM2,
          frontM: u.frontM,
          proporcjaBokow: u.proporcjaBokow,
          wojewodztwo: u.wojewodztwo || p.wojewodztwo,
          powiat: u.powiat || p.powiat,
          gmina: u.gmina || p.gmina,
        };
        zrodlo = "uldk";
        if (u.geomWkt) wktZnalezione.push(u.geomWkt);
        if (!idUldkPierwszy) idUldkPierwszy = id;
      }
    }

    wynikiPozycji.push({ pozycja: p, id, znaleziona: !!dane, znanyTeryt, zrodlo });
    if (dane) znalezione.push(dane);
    else bledy.push(`Działka ${id} nie znaleziona (ULDK ani provider demonstracyjny).`);
  }

  // Walidacja przylegania: na geometrii (ULDK), z fallbackiem do reguły „wszystkie istnieją".
  let przylegajace: boolean;
  if (wynikiPozycji.length > 1 && wktZnalezione.length === znalezione.length && wktZnalezione.length > 1) {
    przylegajace = czyPrzylegaja(wktZnalezione);
  } else {
    przylegajace = wynikiPozycji.length > 0 && wynikiPozycji.every((w) => w.znaleziona);
  }
  if (wynikiPozycji.length > 1 && !przylegajace) {
    bledy.push("Działki nie tworzą spójnego, przylegającego bloku (test na geometrii).");
  }

  let dane: DaneDzialki | null = null;
  if (znalezione.length > 0) {
    dane = scalDane(znalezione, pozycje, idy);
  } else if (pozycje.length > 0) {
    // Brak danych automatycznych: szkielet z samej identyfikacji (powierzchnia ręczna).
    const p = pozycje[0];
    dane = szkieletDanych(idy.join(" + ") || skomponujId(p).id, p);
  }

  // Uruchom konektory danych (GUS, KIMPZP, …) na scalonym terenie i dopełnij białe plamy.
  let raportZrodel: MetaRozwiazania["raportZrodel"] = [];
  let metaPol: MetaPola[] = [];
  if (dane) {
    const wkt0 = wktZnalezione[0];
    const centroid4326 = idUldkPierwszy ? await pobierzCentroid4326(idUldkPierwszy) : null;
    const teren: Teren = {
      id: dane.id,
      teryt: pozycje[0]?.gminaTeryt ?? dane.teryt ?? "",
      wojewodztwo: dane.wojewodztwo,
      powiat: dane.powiat,
      gmina: dane.gmina,
      centroid2180: wkt0 ? centroid(wkt0) : null,
      centroid4326,
      wktList: wktZnalezione,
      powierzchniaM2: dane.powierzchniaM2,
    };
    const wynikK = await uruchomKonektory(teren, dane);
    dane = { ...dane, ...wynikK.dane };
    raportZrodel = wynikK.raport;
    metaPol = wynikK.meta;
  }

  const poleAutomatyczne = dane
    ? POLA_AUTO.filter((k) => dane![k] !== null && dane![k] !== undefined).map(String)
    : [];

  // Drabina przestrzenna: N zależy od PEWNOŚCI źródła (oferty lokalne vs fallback
  // regionalny), nie od samej obecności wartości — by nie udawać „wiarygodnych".
  const nDla = (pole: keyof DaneDzialki, wiar: number, fallb: number): number => {
    if (dane?.[pole] == null) return 0;
    const m = metaPol.find((x) => x.pole === pole);
    if (!m) return wiar; // dane demo (bez metadanych konektora) traktujemy jak wiarygodne
    return m.pewnosc >= 70 ? wiar : fallb;
  };
  const rynek = {
    czynszN: nDla("czynszRynkowyM2", 35, 4),
    cenaNowychN: nDla("cenaNowychM2", 32, 6),
  };

  return {
    dane,
    meta: {
      pozycje: wynikiPozycji,
      przylegajace: wynikiPozycji.length <= 1 ? true : przylegajace,
      bledy,
      poleAutomatyczne,
      rynek,
      raportZrodel,
      metaPol,
    },
  };
}

export { statusRynkowy };
