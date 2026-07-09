/**
 * Uwarunkowania działki (bramki środowiskowe/formalne, sygnały, białe plamy,
 * kluczowe liczby) — przeniesione z Poziomu 1 do Poziomu 2 zgodnie z rewizją
 * zakresu P1 (środowisko/uzbrojenie/dostępność/rynek cenowy = Poziom 2).
 *
 * Funkcje czyste; MPZP z przeznaczeniem budowlanym przesądza bramki formalne.
 */

import type {
  BrakDanych,
  DaneDzialki,
  KluczoweLiczby,
  StatusBramki,
  Sygnal,
  WynikBramki,
} from "../types";
import type { KonfiguracjaScoring } from "../config";
import { warstwaZaladowana } from "../data/srodowisko";

// ── Bramki (Warstwa 0) ──────────────────────────────────────────────────────

/**
 * Jedna bramka środowiskowa E sterowana danymi lokalnej warstwy (naprawa CAP,
 * warstwy środowiskowe 2 §4):
 *  - zassana + WYKRYTO przecięcie → „warunkowo" (realne zagrożenie → CAP na żółty),
 *  - zassana + brak przecięcia → „pass" (czysto, odblokowuje zielony),
 *  - niezassana / brak danej → „do weryfikacji" (NIE blokuje; trafia na listę
 *    braków i obniża pewność — brak weryfikacji ≠ warunkowa).
 */
function bramkaSrodowiskowa(
  szczegoly: WynikBramki[],
  flagi: string[],
  o: { nazwa: string; zrodlo: string; zassana: boolean; wykryto: boolean; flagaWykryto: string; uzasWykryto: string; uzasPass: string }
): void {
  if (!o.zassana) {
    szczegoly.push({ nazwa: o.nazwa, zrodlo: o.zrodlo, status: "do_weryfikacji", uzasadnienie: "Niezweryfikowane automatycznie — brak podłączonej warstwy; sprawdź źródło (nie blokuje wyniku)." });
    return;
  }
  if (o.wykryto) {
    szczegoly.push({ nazwa: o.nazwa, zrodlo: o.zrodlo, status: "warunkowo", uzasadnienie: o.uzasWykryto });
    flagi.push(o.flagaWykryto);
  } else {
    szczegoly.push({ nazwa: o.nazwa, zrodlo: o.zrodlo, status: "pass", uzasadnienie: o.uzasPass });
  }
}

export function liczBramki(d: DaneDzialki): { status: StatusBramki; flagi: string[]; szczegoly: WynikBramki[] } {
  const szczegoly: WynikBramki[] = [];
  const flagi: string[] = [];
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
        szczegoly.push({ nazwa, zrodlo, status: "pass", uzasadnienie: "Przesądzone w MPZP (plan budowlany)." });
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

  // Bramki E środowiskowe (powódź/ochrona przyrody/osuwiska) — STEROWANE DANYMI
  // z lokalnych warstw (przecięcie geometrii, ustawione w resolverze). Reguła per
  // warstwa (naprawa CAP): zassana + przecięcie → „warunkowo" (realne zagrożenie,
  // CAP na żółty); zassana + brak przecięcia → „pass" (odblokowuje zielony);
  // NIEzassana → „do weryfikacji" (NIE blokuje, trafia na listę braków). Dla działki
  // objętej MPZP mieszkaniowym środowisko jest przesądzone w planie → pomijamy.
  if (!objetePlanem) {
    const powodzZassana = warstwaZaladowana("powodz_q10") || warstwaZaladowana("powodz_q1") || warstwaZaladowana("powodz_q02");
    bramkaSrodowiskowa(szczegoly, flagi, {
      nazwa: "Obszar zagrożenia powodzią",
      zrodlo: "ISOK / Wody Polskie (WFS)",
      zassana: powodzZassana,
      wykryto: d.ryzykoPowodzioweSzczegolne === true,
      flagaWykryto: "Zagrożenie powodziowe (ISOK) — wynik warunkowy do usunięcia bariery",
      uzasWykryto: "Działka przecina strefę zagrożenia powodzią (ISOK) — wykryte zagrożenie, wynik warunkowy.",
      uzasPass: "Poza strefą zagrożenia powodzią (dane ISOK).",
    });
    bramkaSrodowiskowa(szczegoly, flagi, {
      nazwa: "Ochrona przyrody (Natura 2000 / park / rezerwat)",
      zrodlo: "GDOŚ Geoserwis (WFS) / OSM",
      zassana: warstwaZaladowana("ochrona_przyrody"),
      wykryto: d.natura2000 === true,
      flagaWykryto: "Forma ochrony przyrody — wynik warunkowy do weryfikacji ograniczeń",
      uzasWykryto: "Działka przecina formę ochrony przyrody — ograniczenia zabudowy, wynik warunkowy.",
      uzasPass: "Poza formami ochrony przyrody (dane GDOŚ/OSM).",
    });
    bramkaSrodowiskowa(szczegoly, flagi, {
      nazwa: "Osuwiska / tereny zagrożone ruchami masowymi",
      zrodlo: "PIG-PIB / SOPO (WFS)",
      zassana: warstwaZaladowana("osuwiska"),
      wykryto: d.osuwisko === true,
      flagaWykryto: "Osuwisko / teren zagrożony — wynik warunkowy do weryfikacji posadowienia",
      uzasWykryto: "Działka przecina osuwisko lub teren zagrożony — ograniczenia posadowienia, wynik warunkowy.",
      uzasPass: "Poza osuwiskami (dane SOPO).",
    });
  }

  return { status: agregujBramki(szczegoly), flagi, szczegoly };
}

export function agregujBramki(szczegoly: WynikBramki[]): StatusBramki {
  if (szczegoly.some((s) => s.status === "fail")) return "fail";
  if (szczegoly.some((s) => s.status === "warunkowo")) return "warunkowo";
  if (szczegoly.some((s) => s.status === "do_weryfikacji")) return "do_weryfikacji";
  return "pass";
}

// ── Kluczowe liczby (ekonomia/teren) ─────────────────────────────────────────

function pulapCzynszu(d: DaneDzialki, cfg: KonfiguracjaScoring): number | null {
  if (d.wartoscOdtworzeniowaM2 === null) return null;
  return (d.wartoscOdtworzeniowaM2 * cfg.stopaPulapuCzynszu) / 12;
}
export function lukaPctZDanych(d: DaneDzialki, cfg: KonfiguracjaScoring): number | null {
  const pulap = pulapCzynszu(d, cfg);
  if (pulap === null || d.czynszRynkowyM2 === null || d.czynszRynkowyM2 <= 0) return null;
  return ((d.czynszRynkowyM2 - pulap) / d.czynszRynkowyM2) * 100;
}

export function liczKluczoweLiczby(d: DaneDzialki, cfg: KonfiguracjaScoring): KluczoweLiczby {
  const pulap = pulapCzynszu(d, cfg);
  const luka = lukaPctZDanych(d, cfg);
  const kosztM2 = d.kosztBudowyM2 ?? (d.cenaNowychM2 !== null ? d.cenaNowychM2 - 2000 + 1800 : null);
  const relacja =
    kosztM2 !== null && d.wartoscOdtworzeniowaM2 !== null && d.wartoscOdtworzeniowaM2 > 0
      ? (kosztM2 / d.wartoscOdtworzeniowaM2) * 100
      : null;
  return {
    pulapCzynszuSimM2: pulap === null ? null : Math.round(pulap * 10) / 10,
    czynszRynkowyM2: d.czynszRynkowyM2,
    lukaNajemcyPct: luka === null ? null : Math.round(luka),
    relacjaKosztDoWartOdtworzeniowejPct: relacja === null ? null : Math.round(relacja),
    czasDojazdAglomeracjaMin: d.czasDojazdAglomeracjaMin,
    sredniSpadekPct: d.sredniSpadekPct,
  };
}

// ── Sygnały (flagi/atuty) ────────────────────────────────────────────────────

export function liczSygnaly(d: DaneDzialki, szczegoly: WynikBramki[], cfg: KonfiguracjaScoring): Sygnal[] {
  const s: Sygnal[] = [];
  for (const b of szczegoly) if (b.status === "fail" || b.status === "warunkowo") s.push({ tekst: b.nazwa, ton: "ostrzezenie" });
  const poz = (w: boolean | null, tekst: string) => {
    if (w === true) s.push({ tekst, ton: "pozytyw" });
  };
  poz(d.transport?.jest === true ? true : null, "Komunikacja publiczna w okolicy (deklaracja)");
  poz(d.zlobkiSzkolyWZasiegu, "Szkoła / żłobek w zasięgu");
  poz(d.pozWZasiegu, "POZ w zasięgu");
  poz(d.uslugiPodstawowePieszo, "Usługi podstawowe pieszo");
  // Luka czynszowa i popyt na najem społeczny to ESTYMACJA — flaga należy do M1 (popytP1),
  // nie do M2 (tu tylko dane pozyskane/mierzone). Patrz werdyktSpoleczny w popytP1.ts.
  return s;
}

// ── Realne białe plamy (czego nie pobrano) ───────────────────────────────────

/**
 * Lista „Do weryfikacji" (warstwy środowiskowe 2 §4a) — JEDNO miejsce ze wszystkimi
 * lukami, których aplikacja nie potwierdziła automatycznie. Każda pozycja mówi CO
 * i GDZIE SPRAWDZIĆ (opis = źródło), a `wplyw` mówi ILE (obniżenie pewności).
 * Obejmuje środowisko (bramki „do weryfikacji"), plan/WZ, dostęp do drogi, wskaźniki
 * zabudowy oraz dane rynkowe — to samo wejście, które skonsumuje moduł dokumentów.
 * NIE zmienia werdyktu — brak weryfikacji ≠ warunkowa (patrz bramkaSrodowiskowa).
 */
export function liczBraki(d: DaneDzialki, szczegoly: WynikBramki[]): BrakDanych[] {
  const braki: BrakDanych[] = [];
  const dodaj = (tytul: string, gdzie: string, wplyw = "obniża pewność (nie zmienia werdyktu)") =>
    braki.push({ tytul, opis: `Niepotwierdzone automatycznie; sprawdź: ${gdzie}`, wplyw });

  // Środowisko/grunt/droga niezweryfikowane automatycznie (status „do weryfikacji").
  for (const b of szczegoly)
    if (b.status === "do_weryfikacji") dodaj(b.nazwa, b.zrodlo);

  // Podstawa planistyczna (plan miejscowy / WZ) — kluczowa, gdy brak MPZP mieszkaniowego.
  if (d.statusPlanistyczny !== "mpzp_mieszkaniowy")
    dodaj(
      "Przeznaczenie w planie (MPZP) lub warunki zabudowy (WZ)",
      "geoportal gminy / wydział architektury (wypis i wyrys z MPZP albo decyzja WZ)"
    );

  // Wskaźniki zabudowy — gdy nie z planu (obwiednia z sąsiedztwa, niższa pewność).
  if (!d.wskaznikiPlanistyczne)
    dodaj(
      "Wskaźniki zabudowy (intensywność, wysokość, PZ, PBC)",
      "MPZP / plan ogólny — bez nich obwiednia oszacowana z sąsiedztwa"
    );

  // Dane rynkowe/kosztowe — wpływ na model finansowy, nie na werdykt przydatności.
  if (d.czynszRynkowyM2 === null)
    dodaj("Rynek najmu (czynsze długoterminowe)", "oferty najmu w okolicy / BaRT", "luka cenowa szacunkowa");
  if (d.wartoscOdtworzeniowaM2 === null)
    dodaj("Wartość odtworzeniowa", "obwieszczenie wojewody / wskaźnik BGK", "pułap czynszu nieoznaczony");
  if (d.odlegloscDoSieciM === null && d.odlegloscDoZabudowyM === null)
    dodaj("Uzbrojenie / odległość do sieci", "GESUT / geoportal / gestorzy mediów", "koszt przyłączy szacunkowy");
  if (d.czasDojazdAglomeracjaMin === null)
    dodaj("Dostępność komunikacyjna (dojazd do aglomeracji)", "mapy tras / rozkłady jazdy", "obniża pewność P2");
  return braki;
}
