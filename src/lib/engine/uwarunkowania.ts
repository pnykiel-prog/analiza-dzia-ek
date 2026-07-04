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
import { BRAMKI_SRODOWISKOWE_AKTYWNE } from "../config";

// ── Bramki (Warstwa 0) ──────────────────────────────────────────────────────

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

  // Bramki środowiskowe (powódź, ochrona, Natura 2000, osuwiska/teren górniczy) — ZAPARKOWANE.
  // Źródła WMS (GDOŚ/ISOK/PIG/NID) niedostępne, więc te dane nie wchodzą do analizy M1/M2.
  if (BRAMKI_SRODOWISKOWE_AKTYWNE) {
    trojstan(
      "Obszar szczególnego zagrożenia powodzią",
      "ISOK / Hydroportal",
      d.ryzykoPowodzioweSzczegolne,
      "fail",
      "Działka w obszarze szczególnego zagrożenia powodzią — wykluczenie.",
      "Brak przeciwwskazań.",
      objetePlanem
    );
  }

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

  if (BRAMKI_SRODOWISKOWE_AKTYWNE) {
    trojstan(
      "Rezerwat / park narodowy / wykluczająca forma ochrony",
      "GDOŚ Geoserwis",
      d.ochronaWykluczajaca,
      "fail",
      "Wykluczająca forma ochrony przyrody.",
      "Brak przeciwwskazań.",
      objetePlanem
    );

    trojstan(
      "Natura 2000",
      "GDOŚ Geoserwis",
      d.natura2000,
      "warunkowo",
      "Obszar Natura 2000 — ograniczenia, wymagana ocena (flaga).",
      "Brak przeciwwskazań.",
      objetePlanem
    );
    if (d.natura2000 === true) flagi.push("Natura 2000");

    const gorniczeOsuwisko =
      d.terenGorniczy === null && d.osuwisko === null ? null : d.terenGorniczy === true || d.osuwisko === true;
    trojstan(
      "Teren górniczy / osuwisko (SOPO)",
      "MIDAS / SOPO",
      gorniczeOsuwisko,
      "warunkowo",
      "Teren górniczy lub osuwiskowy — ograniczenia posadowienia (flaga).",
      "Brak przeciwwskazań.",
      objetePlanem
    );
    if (gorniczeOsuwisko) flagi.push("Teren górniczy / osuwisko");
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
  poz(d.przystanekZCzestotliwoscia, "Przystanek z sensowną częstotliwością (≤800 m)");
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
