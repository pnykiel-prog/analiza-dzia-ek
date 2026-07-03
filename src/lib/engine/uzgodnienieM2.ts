/**
 * M2a — silnik uzgodnienia danych (rdzeń „rozpoznania braków").
 * ============================================================
 * Wg docs/dane-m2.md §2–§4. Jedno przejście: dla każdego pola z KATALOGU M2
 * sprawdzamy, czy dana jest obecna w `DaneDzialki` (auto-pozyskana w tle przez
 * konektory M1/M2), czy jej brak — i klasyfikujemy na trzy sekcje ekranu E3.
 *
 * Zasady:
 *  - „brak danych ≠ nie": pominięcie/brak obniża pewność, NIGDY nie blokuje.
 *  - `off`  → dane statystyczne: brak pola ręcznego (sekcja C), tylko niższa pewność.
 *  - `on`   → klient może zdobyć → pole ręczne + Pomiń (sekcja B).
 *  - `gate` → bramka: pole ręczne z ostrożnością (można dodać ograniczenie,
 *             nie znieść bez dokumentu) — sekcja B (wariant ostrzegawczy).
 *
 * Funkcje czyste (testowalne offline). Konektory live dochodzą w M2b — tu
 * czytamy to, co już jest w DaneDzialki (część pól wypełnia M1/próbki).
 */

import type { DaneDzialki, DefinicjaPolaM2, PoleM2, WynikUzgodnienia } from "../types";
import { clamp } from "./utils";

/**
 * KATALOG DANYCH M2 (docs/dane-m2.md §4). Każde pole: klucz w DaneDzialki, blok
 * tematyczny, źródło auto, tryb ręcznego uzupełnienia, rola, podpowiedź „skąd wziąć".
 * Uwzględnia tylko pola mające odpowiednik w DaneDzialki (dane twarde bez pola
 * w modelu — własność/KW, warunki przyłączenia — dojdą osobno).
 */
export const KATALOG_M2: DefinicjaPolaM2[] = [
  // Wskaźniki planistyczne
  {
    klucz: "wskaznikiPlanistyczne",
    blok: "Wskaźniki planistyczne",
    etykieta: "Wskaźniki z planu (intensywność, wys./kond., % zabudowy, PBC, parking, usługi)",
    zrodloAuto: "KIMPZP wektor / plan ogólny",
    manualFallback: "on",
    rola: "wskaznik",
    podpowiedz: "z wypisu i wyrysu z MPZP lub z planu ogólnego",
    typWartosci: "zlozone",
  },
  // Fizyka terenu
  { klucz: "sredniSpadekPct", blok: "Fizyka terenu", etykieta: "Średni spadek terenu", zrodloAuto: "NMT (GUGiK)", manualFallback: "on", rola: "koszt", podpowiedz: "z NMT/operatu geodezyjnego", jednostka: "%", typWartosci: "liczba" },
  { klucz: "ryzykoPowodzioweSzczegolne", blok: "Fizyka terenu", etykieta: "Zagrożenie powodziowe (obszary szczególnego zagrożenia)", zrodloAuto: "ISOK / Wody Polskie", manualFallback: "gate", rola: "bramka", podpowiedz: "z map zagrożenia powodziowego (ISOK)", typWartosci: "flaga" },
  { klucz: "osuwisko", blok: "Fizyka terenu", etykieta: "Osuwisko / teren zagrożony ruchami masowymi", zrodloAuto: "PIG SOPO", manualFallback: "gate", rola: "bramka", podpowiedz: "z rejestru osuwisk (SOPO)", typWartosci: "flaga" },
  { klucz: "terenGorniczy", blok: "Fizyka terenu", etykieta: "Teren górniczy", zrodloAuto: "PIG MIDAS", manualFallback: "gate", rola: "bramka", podpowiedz: "z rejestru obszarów górniczych (MIDAS)", typWartosci: "flaga" },
  // Uzbrojenie
  { klucz: "odlegloscDoSieciM", blok: "Uzbrojenie", etykieta: "Odległość do najbliższej sieci (proxy kosztu przyłączenia)", zrodloAuto: "GESUT / BDOT", manualFallback: "on", rola: "koszt", podpowiedz: "z mapy zasadniczej / warunków od gestora", jednostka: "m", typWartosci: "liczba" },
  { klucz: "odlegloscDoZabudowyM", blok: "Uzbrojenie", etykieta: "Odległość do istniejącej zabudowy (w tkance)", zrodloAuto: "BDOT", manualFallback: "on", rola: "wskaznik", podpowiedz: "z mapy / ortofotomapy", jednostka: "m", typWartosci: "liczba" },
  // Dostęp i dostępność
  { klucz: "dostepDrogaPubliczna", blok: "Dostęp komunikacyjny", etykieta: "Dostęp do drogi publicznej", zrodloAuto: "BDOT / EGiB / OSM", manualFallback: "gate", rola: "bramka", podpowiedz: "z MPZP/EGiB lub decyzji o zjeździe", typWartosci: "flaga" },
  { klucz: "czasDojazdAglomeracjaMin", blok: "Dostęp komunikacyjny", etykieta: "Czas dojazdu do aglomeracji", zrodloAuto: "OSM / routing", manualFallback: "off", rola: "wskaznik", jednostka: "min", typWartosci: "liczba" },
  { klucz: "przystanekZCzestotliwoscia", blok: "Dostęp komunikacyjny", etykieta: "Przystanek z częstotliwością (≤800 m)", zrodloAuto: "OSM / GTFS", manualFallback: "on", rola: "wskaznik", podpowiedz: "z rozkładu jazdy przewoźnika", typWartosci: "flaga" },
  // Infrastruktura społeczna
  { klucz: "pozWZasiegu", blok: "Infrastruktura społeczna", etykieta: "POZ / apteka w zasięgu (seniorzy)", zrodloAuto: "RPWDL / Overpass", manualFallback: "on", rola: "wskaznik", podpowiedz: "z rejestru RPWDL lub mapy", typWartosci: "flaga" },
  { klucz: "uslugiPodstawowePieszo", blok: "Infrastruktura społeczna", etykieta: "Usługi podstawowe w zasięgu pieszym (seniorzy)", zrodloAuto: "Overpass", manualFallback: "on", rola: "wskaznik", podpowiedz: "z mapy usług w promieniu spaceru", typWartosci: "flaga" },
  { klucz: "zlobkiSzkolyWZasiegu", blok: "Infrastruktura społeczna", etykieta: "Żłobki / szkoły w zasięgu (młodzi)", zrodloAuto: "RSPO / Overpass", manualFallback: "on", rola: "wskaznik", podpowiedz: "z rejestru RSPO lub mapy", typWartosci: "flaga" },
  // Środowisko i ochrona
  { klucz: "natura2000", blok: "Środowisko i ochrona", etykieta: "Natura 2000", zrodloAuto: "GDOŚ", manualFallback: "gate", rola: "bramka", podpowiedz: "z geoportalu GDOŚ", typWartosci: "flaga" },
  { klucz: "ochronaWykluczajaca", blok: "Środowisko i ochrona", etykieta: "Ochrona wykluczająca (rezerwat / park narodowy)", zrodloAuto: "GDOŚ", manualFallback: "gate", rola: "bramka", podpowiedz: "z geoportalu GDOŚ", typWartosci: "flaga" },
  { klucz: "strefaKonserwatorska", blok: "Środowisko i ochrona", etykieta: "Strefa konserwatorska / zabytki", zrodloAuto: "NID", manualFallback: "gate", rola: "wskaznik", podpowiedz: "z rejestru zabytków (NID)", typWartosci: "flaga" },
  // Grunt i prawo
  { klucz: "klasaUzytku", blok: "Grunt", etykieta: "Klasa użytku gruntowego", zrodloAuto: "EGiB", manualFallback: "gate", rola: "bramka", podpowiedz: "z wypisu z rejestru gruntów", typWartosci: "tekst" },
  { klucz: "gruntLesny", blok: "Grunt", etykieta: "Grunt leśny (Ls)", zrodloAuto: "EGiB", manualFallback: "gate", rola: "bramka", podpowiedz: "z wypisu z rejestru gruntów", typWartosci: "flaga" },
  { klucz: "gruntRolnyKlasaIdoIII", blok: "Grunt", etykieta: "Grunt rolny klasy I–III (ochrona)", zrodloAuto: "EGiB", manualFallback: "gate", rola: "bramka", podpowiedz: "z wypisu z rejestru gruntów", typWartosci: "flaga" },
  // Potencjał rozwoju
  { klucz: "pustostanyPct", blok: "Potencjał rozwoju", etykieta: "Pustostany w gminie", zrodloAuto: "GUS BDL", manualFallback: "off", rola: "wskaznik", jednostka: "%", typWartosci: "liczba" },
];

// Pewność źródeł: auto-pozyskane (średnia wiarygodność), ręczne (user-sourced, „do potwierdzenia").
const PEWNOSC_AUTO = 80;
const PEWNOSC_RECZNE = 75;
// Wkład pewności pól niepozyskanych (nigdy nie blokuje — tylko obniża): gate < on < off.
const WKLAD_BRAK: Record<string, number> = { off: 55, on: 45, gate: 40 };

function pusta(v: unknown): boolean {
  return v == null || v === "";
}

/**
 * Uzgodnienie danych M2: klasyfikuje pola KATALOGU na pozyskane/brak/pominięte,
 * dzieli na sekcje E3 (A/B/C) i liczy pewność kompletu. Wejście to `DaneDzialki`
 * (część pól wypełniona już przez M1/próbki), plus opcjonalne nadpisania ręczne
 * i lista pól pominiętych przez klienta.
 */
export function uzgodnijM2(
  dane: DaneDzialki,
  opcje?: { nadpisania?: Partial<Record<keyof DaneDzialki, string | number | boolean>>; pominiete?: (keyof DaneDzialki)[] }
): WynikUzgodnienia {
  const nadpisania = opcje?.nadpisania ?? {};
  const pominiete = new Set<string>((opcje?.pominiete ?? []).map(String));

  const pola: PoleM2[] = KATALOG_M2.map((def) => {
    const nad = nadpisania[def.klucz];
    if (nad !== undefined && !pusta(nad)) {
      // Wartość ręczna (user-sourced) — pozyskana z prowenancją „ręczne".
      return { ...def, status: "pozyskane", wartosc: nad, zrodlo: "ręczne", pewnosc: PEWNOSC_RECZNE };
    }
    if (pominiete.has(String(def.klucz))) {
      return { ...def, status: "pominiete", wartosc: null, zrodlo: "—", pewnosc: 0 };
    }
    const auto = dane[def.klucz] as unknown;
    if (!pusta(auto)) {
      return { ...def, status: "pozyskane", wartosc: auto as PoleM2["wartosc"], zrodlo: def.zrodloAuto, pewnosc: PEWNOSC_AUTO };
    }
    return { ...def, status: "brak", wartosc: null, zrodlo: "—", pewnosc: 0 };
  });

  const sekcjaA = pola.filter((p) => p.status === "pozyskane");
  const niePozyskane = pola.filter((p) => p.status !== "pozyskane");
  const sekcjaB = niePozyskane.filter((p) => p.manualFallback === "on" || p.manualFallback === "gate");
  const sekcjaC = niePozyskane.filter((p) => p.manualFallback === "off");

  const pozyskanychPct = Math.round((100 * sekcjaA.length) / (pola.length || 1));
  // Pewność = średnia wkładów: pozyskane → pewność pola; brak/pominięte → wkład wg trybu.
  const suma = pola.reduce((s, p) => s + (p.status === "pozyskane" ? p.pewnosc : WKLAD_BRAK[p.manualFallback]), 0);
  const pewnosc = clamp(Math.round(suma / (pola.length || 1)));

  return { pola, sekcjaA, sekcjaB, sekcjaC, pozyskanychPct, pewnosc };
}

/** Sformatowana wartość pola do wyświetlenia (z jednostką / bool → tak/nie / wskaźniki → skrót). */
export function wartoscPolaTekst(p: PoleM2): string {
  if (p.wartosc == null) return "—";
  if (typeof p.wartosc === "boolean") return p.wartosc ? "tak" : "nie";
  if (typeof p.wartosc === "object") {
    // Wskaźniki planistyczne: zwięzły skrót (intensywność · kondygnacje · % zabudowy).
    const o = p.wartosc as { intensywnosc?: number; maxKondygnacje?: number; maxPowZabudowyPct?: number };
    if (o.intensywnosc != null || o.maxKondygnacje != null) {
      const cz = [
        o.intensywnosc != null ? `int. ${o.intensywnosc}` : null,
        o.maxKondygnacje != null ? `${o.maxKondygnacje} kond.` : null,
        o.maxPowZabudowyPct != null ? `${o.maxPowZabudowyPct}% zab.` : null,
      ].filter(Boolean);
      return cz.length ? cz.join(" · ") : "uzupełnione";
    }
    return "uzupełnione";
  }
  const suf = p.jednostka ? ` ${p.jednostka}` : "";
  return `${p.wartosc}${suf}`;
}
