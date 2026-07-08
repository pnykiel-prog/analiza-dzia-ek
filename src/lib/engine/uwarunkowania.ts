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
 * Jedna bramka środowiskowa E sterowana danymi lokalnej warstwy:
 *  - niezassana → „do weryfikacji" (brak danych krytycznych, CAP na warunkową),
 *  - zassana + wykryto przecięcie → „do weryfikacji" (flaga przesiewowa),
 *  - zassana + brak przecięcia → „pass" (odblokowuje zielony).
 */
function bramkaSrodowiskowa(
  szczegoly: WynikBramki[],
  flagi: string[],
  o: { nazwa: string; zrodlo: string; zassana: boolean; wykryto: boolean; flagaWykryto: string; uzasWykryto: string; uzasPass: string }
): void {
  if (!o.zassana) {
    szczegoly.push({ nazwa: o.nazwa, zrodlo: o.zrodlo, status: "do_weryfikacji", uzasadnienie: "Warstwa niezaładowana — brak danych, wymaga weryfikacji." });
    return;
  }
  if (o.wykryto) {
    szczegoly.push({ nazwa: o.nazwa, zrodlo: o.zrodlo, status: "do_weryfikacji", uzasadnienie: o.uzasWykryto });
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
  // warstwa: zassana + przecięcie → „do weryfikacji" (flaga przesiewowa, CAP na
  // warunkową); zassana + brak przecięcia → „pass" (odblokowuje zielony); NIEzassana
  // → „do weryfikacji" (brak danych krytycznych ≠ brak ryzyka). Dla działki objętej
  // MPZP mieszkaniowym środowisko jest przesądzone w planie → pomijamy (nie flagujemy).
  if (!objetePlanem) {
    const powodzZassana = warstwaZaladowana("powodz_q10") || warstwaZaladowana("powodz_q1") || warstwaZaladowana("powodz_q02");
    bramkaSrodowiskowa(szczegoly, flagi, {
      nazwa: "Obszar zagrożenia powodzią",
      zrodlo: "ISOK / Wody Polskie (WFS)",
      zassana: powodzZassana,
      wykryto: d.ryzykoPowodzioweSzczegolne === true,
      flagaWykryto: "Zagrożenie powodziowe (ISOK) — flaga przesiewowa, wymaga weryfikacji",
      uzasWykryto: "Działka przecina strefę zagrożenia powodzią — flaga przesiewowa (nie rozstrzygnięcie prawne).",
      uzasPass: "Poza strefą zagrożenia powodzią (dane ISOK).",
    });
    bramkaSrodowiskowa(szczegoly, flagi, {
      nazwa: "Ochrona przyrody (Natura 2000 / park / rezerwat)",
      zrodlo: "GDOŚ Geoserwis (WFS)",
      zassana: warstwaZaladowana("ochrona_przyrody"),
      wykryto: d.natura2000 === true,
      flagaWykryto: "Forma ochrony przyrody — flaga przesiewowa, wymaga weryfikacji",
      uzasWykryto: "Działka przecina formę ochrony przyrody — ograniczenia, wymagana weryfikacja.",
      uzasPass: "Poza formami ochrony przyrody (dane GDOŚ).",
    });
    bramkaSrodowiskowa(szczegoly, flagi, {
      nazwa: "Osuwiska / tereny zagrożone ruchami masowymi",
      zrodlo: "PIG-PIB / SOPO (WFS)",
      zassana: warstwaZaladowana("osuwiska"),
      wykryto: d.osuwisko === true,
      flagaWykryto: "Osuwisko / teren zagrożony — flaga przesiewowa, wymaga weryfikacji",
      uzasWykryto: "Działka przecina osuwisko lub teren zagrożony — ograniczenia posadowienia.",
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

export function liczBraki(d: DaneDzialki, szczegoly: WynikBramki[]): BrakDanych[] {
  const braki: BrakDanych[] = [];
  for (const b of szczegoly)
    if (b.status === "do_weryfikacji")
      braki.push({ tytul: b.nazwa, opis: `${b.zrodlo} — źródło niepodłączone lub brak danych`, wplyw: "bramka: do weryfikacji (nie wyklucza)" });

  if (d.czynszRynkowyM2 === null)
    braki.push({ tytul: "Rynek najmu (czynsze długoterminowe)", opis: "Brak ofert w zasięgu drabiny przestrzennej", wplyw: "luka cenowa szacunkowa" });
  if (d.wartoscOdtworzeniowaM2 === null)
    braki.push({ tytul: "Wartość odtworzeniowa", opis: "Brak wskaźnika wojewody/BGK", wplyw: "pułap czynszu nieoznaczony" });
  if (d.odlegloscDoSieciM === null && d.odlegloscDoZabudowyM === null)
    braki.push({ tytul: "Uzbrojenie / odległość do sieci", opis: "GESUT/BDOT — źródło niepodłączone", wplyw: "koszt przyłączy szacunkowy" });
  if (d.czasDojazdAglomeracjaMin === null)
    braki.push({ tytul: "Dostępność komunikacyjna", opis: "Routing/izochrony — źródło niepodłączone", wplyw: "obniża pewność P2" });
  return braki;
}
