/**
 * Dane przykładowe (realistyczne) dla kilku działek.
 *
 * Zgodnie z decyzją projektową: na start warstwa danych zwraca dane przykładowe,
 * a realne adaptery (ULDK/GUS/OSM) podpina się później bez zmiany silników.
 * Wartości `null` celowo modelują "białe plamy" (brak danych ≠ "nie").
 */

import type { DaneDzialki } from "../types";

export const DZIALKI_PRZYKLADOWE: DaneDzialki[] = [
  {
    // Działka pod miastem wojewódzkim, w OUZ — wzorcowy przypadek z poziom1_scoring.md
    id: "146509_8.0012.123/4",
    teryt: "146509_8",
    gmina: "Lesznowola",
    powiat: "piaseczyński",
    wojewodztwo: "mazowieckie",
    powierzchniaM2: 4200,
    frontM: 55,
    proporcjaBokow: 1.4,
    budynkiIstniejace: false,

    klasaUzytku: "B",
    gruntLesny: false,
    gruntRolnyKlasaIdoIII: false,

    statusPlanistyczny: "ouz",
    wskaznikiPlanistyczne: {
      intensywnosc: 1.2,
      maxWysokoscM: 16,
      maxKondygnacje: 5,
      maxPowZabudowyPct: 40,
      minPbcPct: 30,
      normatywParkingowy: 0.8,
      udzialUslugPct: 20,
    },
    zabudowaMieszkaniowaWSasiedztwie: true,
    przeznaczenieSprzeczneZMieszkaniowa: false,
    dostepDrogaPubliczna: true,

    sredniSpadekPct: 4,
    ryzykoPowodzioweSzczegolne: false,
    osuwisko: false,
    terenGorniczy: false,

    odlegloscDoSieciM: 60,
    odlegloscDoZabudowyM: 40,

    czasDojazdAglomeracjaMin: 35,
    przystanekZCzestotliwoscia: true,

    uslugiPodstawowePieszo: true,
    pozWZasiegu: true,
    zlobkiSzkolyWZasiegu: true,

    udzial2039Pct: 31,
    mediana2039Woj: 27,
    saldoMigracjiMlodzi: 8,
    udzial65PlusPct: 16,
    trend65Plus: "rosnacy",
    populacjaStabilna: true,
    trendLudnosc: "rosnaca",
    bezrobociePct: 3.2,
    liczbaPodmiotowGosp: 210,

    natura2000: false,
    ochronaWykluczajaca: false,
    strefaKonserwatorska: false,

    wartoscOdtworzeniowaM2: 7766,
    czynszRynkowyM2: 60,
    cenaNowychM2: 11500,
    kosztBudowyM2: 9500,
    cenaGruntu: 1_900_000,
    pustostanyPct: 3,
    dochodyGospDomowe: 7800,
  },

  {
    // Małe miasto, starzejąca się ale stabilna populacja — profil senioralny
    id: "300108_4.0005.88/2",
    teryt: "300108_4",
    gmina: "Kórnik",
    powiat: "poznański",
    wojewodztwo: "wielkopolskie",
    powierzchniaM2: 2600,
    frontM: 42,
    proporcjaBokow: 1.6,
    budynkiIstniejace: false,

    klasaUzytku: "Bp",
    gruntLesny: false,
    gruntRolnyKlasaIdoIII: false,

    statusPlanistyczny: "mpzp_mieszkaniowy",
    wskaznikiPlanistyczne: {
      intensywnosc: 0.8,
      maxWysokoscM: 12,
      maxKondygnacje: 4,
      maxPowZabudowyPct: 30,
      minPbcPct: 40,
      normatywParkingowy: 1.0,
      udzialUslugPct: 15,
    },
    zabudowaMieszkaniowaWSasiedztwie: true,
    przeznaczenieSprzeczneZMieszkaniowa: false,
    dostepDrogaPubliczna: true,

    sredniSpadekPct: 2,
    ryzykoPowodzioweSzczegolne: false,
    osuwisko: false,
    terenGorniczy: false,

    odlegloscDoSieciM: 25,
    odlegloscDoZabudowyM: 15,

    czasDojazdAglomeracjaMin: 40,
    przystanekZCzestotliwoscia: false,

    uslugiPodstawowePieszo: true,
    pozWZasiegu: true,
    zlobkiSzkolyWZasiegu: true,

    udzial2039Pct: 24,
    mediana2039Woj: 26,
    saldoMigracjiMlodzi: 1,
    udzial65PlusPct: 24,
    trend65Plus: "rosnacy",
    populacjaStabilna: true,
    trendLudnosc: "stabilna",
    bezrobociePct: 4.1,
    liczbaPodmiotowGosp: 160,

    natura2000: false,
    ochronaWykluczajaca: false,
    strefaKonserwatorska: false,

    wartoscOdtworzeniowaM2: 6900,
    czynszRynkowyM2: 48,
    cenaNowychM2: 9200,
    kosztBudowyM2: 8800,
    cenaGruntu: 980_000,
    pustostanyPct: 4,
    dochodyGospDomowe: 6400,
  },

  {
    // Trudny przypadek z białymi plamami: brak MPZP, grunt rolny, Natura 2000,
    // część danych nieznana — test obsługi braków i bramek warunkowych.
    id: "061702_2.0011.45",
    teryt: "061702_2",
    gmina: "Janów Podlaski",
    powiat: "bialski",
    wojewodztwo: "lubelskie",
    powierzchniaM2: 5100,
    frontM: null,
    proporcjaBokow: null,
    budynkiIstniejace: false,

    klasaUzytku: "RIVb",
    gruntLesny: false,
    gruntRolnyKlasaIdoIII: false,

    statusPlanistyczny: "brak_danych",
    wskaznikiPlanistyczne: null,
    zabudowaMieszkaniowaWSasiedztwie: true,
    przeznaczenieSprzeczneZMieszkaniowa: null,
    dostepDrogaPubliczna: true,

    sredniSpadekPct: 6,
    ryzykoPowodzioweSzczegolne: false,
    osuwisko: false,
    terenGorniczy: false,

    odlegloscDoSieciM: 220,
    odlegloscDoZabudowyM: 180,

    czasDojazdAglomeracjaMin: 75,
    przystanekZCzestotliwoscia: false,

    uslugiPodstawowePieszo: false,
    pozWZasiegu: null,
    zlobkiSzkolyWZasiegu: null,

    udzial2039Pct: 21,
    mediana2039Woj: 25,
    saldoMigracjiMlodzi: -6,
    udzial65PlusPct: 26,
    trend65Plus: "rosnacy",
    populacjaStabilna: false,
    trendLudnosc: "malejaca",
    bezrobociePct: 7.8,
    liczbaPodmiotowGosp: 95,

    natura2000: true,
    ochronaWykluczajaca: false,
    strefaKonserwatorska: false,

    wartoscOdtworzeniowaM2: 6200,
    czynszRynkowyM2: null, // biała plama: brak danych o czynszu w małej miejscowości
    cenaNowychM2: 7600,
    kosztBudowyM2: null,
    cenaGruntu: 760_000,
    pustostanyPct: 9,
    dochodyGospDomowe: 5100,
  },
];

export function listaDzialek(): { id: string; gmina: string; wojewodztwo: string; opis: string }[] {
  const opisy: Record<string, string> = {
    "146509_8.0012.123/4": "Pod miastem wojewódzkim, OUZ — wzorcowy „dla młodych”",
    "300108_4.0005.88/2": "Małe miasto, MPZP, populacja 60+ — profil senioralny",
    "061702_2.0011.45": "Białe plamy: brak MPZP, Natura 2000, brak czynszu rynkowego",
  };
  return DZIALKI_PRZYKLADOWE.map((d) => ({
    id: d.id,
    gmina: d.gmina,
    wojewodztwo: d.wojewodztwo,
    opis: opisy[d.id] ?? "",
  }));
}
