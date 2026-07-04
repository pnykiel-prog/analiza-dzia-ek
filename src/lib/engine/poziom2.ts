/**
 * Poziom 2 — rekomendacja modelu zabudowy.
 * Zgodny z `rekomendacja_modelu_zabudowy.md`.
 *
 * Zasada: model jest WYPROWADZANY, nie wymyślany. Najpierw twarda obwiednia
 * (ile wolno i co się zmieści), potem dopasowanie do profilu. Bez MPZP →
 * obwiednia z analizy sąsiedztwa (fallback) z obniżoną pewnością.
 *
 * Granica z Poziomem 3: spięcie ekonomiczne NIE liczy się tutaj.
 */

import type {
  DaneDzialki,
  MixMetrazy,
  Obwiednia,
  Profil,
  RozstrzygnieteWskazniki,
  Typologia,
  WariantZabudowy,
  WynikPoziom1,
  WynikPoziom2,
} from "../types";
import type { KonfiguracjaZabudowy } from "../config";
import { KONFIG_ZABUDOWA, KONFIG_SCORING } from "../config";
import { liczBramki, liczBraki, liczKluczoweLiczby, liczSygnaly } from "./uwarunkowania";
import { kaskadaWskaznikow } from "./kaskadaWskaznikow";
import { ocenM2 } from "./kanalyM2";

interface WskaznikiUzyte {
  intensywnosc: number;
  maxKondygnacje: number;
  maxPowZabudowyPct: number;
  minPbcPct: number;
  normatywParkingowy: number;
  zrodlo: Obwiednia["zrodloWskaznikow"];
  pewnosc: number;
  prowenancja: RozstrzygnieteWskazniki; // per-pole źródło + pewność + flagi (kaskada)
}

/**
 * Wskaźniki obwiedni z KASKADY źródeł (auto > ręczne potwierdzone > prognoza),
 * rozstrzyganej per pole. Zastępuje dawne „wszystko z planu albo wszystko z fallbacku".
 */
function wyznaczWskazniki(d: DaneDzialki, cfg: KonfiguracjaZabudowy): WskaznikiUzyte {
  const r = kaskadaWskaznikow(d, cfg);
  const pola = [r.kZabPct, r.far, r.kondygnacje, r.pbcPct];
  const wszystkoAuto = pola.every((p) => p.zrodlo === "auto");
  const jakiesAuto = pola.some((p) => p.zrodlo === "auto");
  const zrodlo: Obwiednia["zrodloWskaznikow"] =
    wszystkoAuto && d.statusPlanistyczny === "mpzp_mieszkaniowy" ? "mpzp" : jakiesAuto ? "plan_ogolny" : "sasiedztwo_fallback";
  return {
    intensywnosc: r.far.wartosc,
    maxKondygnacje: r.kondygnacje.wartosc,
    maxPowZabudowyPct: r.kZabPct.wartosc,
    minPbcPct: r.pbcPct.wartosc,
    normatywParkingowy: d.wskaznikiPlanistyczne?.normatywParkingowy ?? cfg.normatywParkingowy.mlodzi,
    zrodlo,
    pewnosc: r.pewnosc,
    prowenancja: r,
  };
}

function liczObwiednie(d: DaneDzialki, w: WskaznikiUzyte, cfg: KonfiguracjaZabudowy): Obwiednia {
  const maxPowZabudowyM2 = (d.powierzchniaM2 * w.maxPowZabudowyPct) / 100; // limit footprintu (% zabudowy)
  // Liczba kondygnacji = LIMIT z wysokości/planu/sąsiedztwa („ile wolno") — NIE redukowana
  // przez intensywność. Niska intensywność ogranicza PUM (footprint), a nie wysokość budynku.
  const maxKondygnacje = Math.max(1, Math.floor(w.maxKondygnacje));
  // GFA nadziemna: z intensywności (FAR) gdy podana, ograniczona obwiednią footprint × kondygnacje.
  const gfaObwiedni = maxPowZabudowyM2 * maxKondygnacje;
  const gfaZIntensywnosci = w.intensywnosc > 0 ? d.powierzchniaM2 * w.intensywnosc : gfaObwiedni;
  const powCalkowitaNadziemnaM2 = Math.min(gfaZIntensywnosci, gfaObwiedni);
  const pumM2 = powCalkowitaNadziemnaM2 * cfg.wspolczynnikEfektywnosci;
  return {
    maxPowZabudowyM2: Math.round(maxPowZabudowyM2),
    powCalkowitaNadziemnaM2: Math.round(powCalkowitaNadziemnaM2),
    pumM2: Math.round(pumM2),
    maxKondygnacje,
    zrodloWskaznikow: w.zrodlo,
    pewnoscObwiedni: w.pewnosc,
    prowenancja: w.prowenancja,
  };
}

function dobierzTypologie(profil: Profil, maxKond: number): Typologia {
  if (profil === "seniorzy") return "senioralna_wspomagana";
  if (maxKond >= 5) return "sredniowysoka_wielorodzinna";
  if (maxKond >= 4) return "pierzejowa_mixed_use";
  return "niska_wielorodzinna";
}

function etykietaTypologii(t: Typologia): string {
  switch (t) {
    case "niska_wielorodzinna":
      return "Niska wielorodzinna (3–4 kond.)";
    case "sredniowysoka_wielorodzinna":
      return "Średniowysoka wielorodzinna (5–8 kond., winda)";
    case "pierzejowa_mixed_use":
      return "Pierzejowa/kwartałowa z parterem usługowym (mixed-use)";
    case "senioralna_wspomagana":
      return "Senioralna / wspomagana (pełna dostępność, winda)";
  }
}

function mixMetrazy(profil: Profil, cfg: KonfiguracjaZabudowy): MixMetrazy[] {
  return cfg.mixMetrazy[profil].map((m) => ({ ...m }));
}

function sredniMetraz(mix: MixMetrazy[]): number {
  const suma = mix.reduce((s, m) => s + m.udzialPct, 0);
  if (suma === 0) return 45;
  return mix.reduce((s, m) => s + m.metrazSredniM2 * m.udzialPct, 0) / suma;
}

function budujWariant(
  nazwa: string,
  profil: Profil,
  d: DaneDzialki,
  obw: Obwiednia,
  w: WskaznikiUzyte,
  cfg: KonfiguracjaZabudowy,
  opcje: { typologia?: Typologia; kondygnacje?: number; udzialUslugPct?: number }
): WariantZabudowy {
  const typologia = opcje.typologia ?? dobierzTypologie(profil, obw.maxKondygnacje);
  const liczbaKondygnacji = Math.min(opcje.kondygnacje ?? obw.maxKondygnacje, obw.maxKondygnacje);

  // pow. zabudowy realna ~ pow. całkowita / kondygnacje, ograniczona obwiednią
  const powZabudowyM2 = Math.min(obw.maxPowZabudowyM2, Math.round(obw.powCalkowitaNadziemnaM2 / liczbaKondygnacji));
  const powCalkowitaM2 = powZabudowyM2 * liczbaKondygnacji;
  const pumBrutto = powCalkowitaM2 * cfg.wspolczynnikEfektywnosci;

  const udzialWspolne = cfg.udzialPowWspolnejPct[profil] / 100;
  const udzialUslug = (opcje.udzialUslugPct ?? 0) / 100;
  const powWspolneUslugoweM2 = Math.round(pumBrutto * (udzialWspolne + udzialUslug));
  const pumMieszkania = Math.max(0, pumBrutto - powWspolneUslugoweM2);

  const mix = mixMetrazy(profil, cfg);
  const sredni = sredniMetraz(mix);
  const liczbaMieszkan = Math.floor(pumMieszkania / sredni);

  const normatyw = w.normatywParkingowy || cfg.normatywParkingowy[profil];
  const transportDobry = d.przystanekZCzestotliwoscia === true || (d.czasDojazdAglomeracjaMin ?? 99) <= 30;
  const normatywEf = transportDobry ? Math.min(normatyw, cfg.normatywParkingowy[profil]) : normatyw;
  const miejscaParkingowe = Math.ceil(liczbaMieszkan * normatywEf);

  // PBC wysokie → parking pod ziemię
  const parkingPodziemny = w.minPbcPct >= cfg.progPbcParkingPodziemnyPct && miejscaParkingowe > 0;
  const windaWymagana = profil === "seniorzy" || liczbaKondygnacji >= 4;

  const uzasadnienie =
    profil === "mlodzi"
      ? `Profil „dla młodych”: wyższa intensywność, większy udział małych mieszkań, parking obniżony przy dobrym transporcie (${normatywEf.toFixed(1)}/lok.), parter ${udzialUslug > 0 ? "usługowy" : "mieszkalny"}.`
      : `Profil senioralny: umiarkowana intensywność, większe mieszkania bez kawalerek, winda zawsze, pełna dostępność bez barier, blisko POZ i usług.`;

  return {
    nazwa,
    profil,
    typologia,
    liczbaKondygnacji,
    powZabudowyM2,
    powCalkowitaM2: Math.round(powCalkowitaM2),
    pumM2: Math.round(pumMieszkania),
    powWspolneUslugoweM2,
    liczbaMieszkan,
    mixMetrazy: mix,
    miejscaParkingowe,
    parkingPodziemny,
    windaWymagana,
    uzasadnienie: `${etykietaTypologii(typologia)}. ${uzasadnienie}`,
  };
}

function flagiRyzyka(d: DaneDzialki, obw: Obwiednia, w: WskaznikiUzyte, cfg: KonfiguracjaZabudowy, p1: WynikPoziom1): string[] {
  const flagi: string[] = [];
  if (w.minPbcPct >= cfg.progPbcParkingPodziemnyPct)
    flagi.push(`Wysoki wymagany PBC (${w.minPbcPct}%) — parking schodzi pod ziemię (koszt).`);
  if (d.powierzchniaM2 < cfg.minPowierzchniaEfektywnaM2)
    flagi.push("Działka mała na efektywny budynek wielorodzinny z windą.");
  if ((d.sredniSpadekPct ?? 0) > cfg.progSpadkuTarasowaniePct)
    flagi.push(`Spadek ${d.sredniSpadekPct}% — wymusza tarasowanie/podpiwniczenie (koszt).`);
  if (d.proporcjaBokow !== null && d.proporcjaBokow > 2.5)
    flagi.push("Wąska/skośna działka — obniżona efektywność rzutu.");
  if (w.intensywnosc > 1.5)
    flagi.push(`Wysoka intensywność zabudowy (FAR ${w.intensywnosc.toFixed(2)} > 1,5) — gęsty model, zweryfikuj z planem.`);
  if (obw.zrodloWskaznikow === "sasiedztwo_fallback")
    flagi.push("Brak MPZP — obwiednia oszacowana z sąsiedztwa, niska pewność.");
  // Flagi z kaskady wskaźników (walidacja warstwy ręcznej, rozbieżności, legalne>fizyczne).
  for (const f of w.prowenancja.flagi) if (!flagi.includes(f)) flagi.push(f);
  return flagi;
}

/**
 * Trzy warianty zabudowy dla jednego profilu (rozstrzygnięta obwiednia):
 *  1. Optymalny (rekomendowany) — sensowny program pod profil,
 *  2. Maksymalny — pełna obwiednia (najwięcej mieszkań),
 *  3. Kameralny — niższa intensywność (mniej kondygnacji, więcej zieleni).
 * Optymalny jako pierwszy → oznaczany „rekomendowany" w widoku.
 */
function triadaWariantow(
  profil: Profil,
  d: DaneDzialki,
  obwiednia: Obwiednia,
  w: WskaznikiUzyte,
  cfg: KonfiguracjaZabudowy,
  udzialUslug: number
): WariantZabudowy[] {
  const maks = obwiednia.maxKondygnacje;
  const kameralne = Math.max(1, maks <= 2 ? maks - 1 || 1 : maks - 2);
  if (profil === "seniorzy") {
    return [
      budujWariant("Optymalny — senioralny w pełni dostępny", "seniorzy", d, obwiednia, w, cfg, {
        typologia: "senioralna_wspomagana",
        kondygnacje: Math.min(4, maks),
        udzialUslugPct: 8,
      }),
      budujWariant("Maksymalny — pełna obwiednia", "seniorzy", d, obwiednia, w, cfg, {
        typologia: "senioralna_wspomagana",
        kondygnacje: maks,
        udzialUslugPct: 0,
      }),
      budujWariant("Kameralny — niższa intensywność", "seniorzy", d, obwiednia, w, cfg, {
        typologia: "senioralna_wspomagana",
        kondygnacje: kameralne,
        udzialUslugPct: 8,
      }),
    ];
  }
  return [
    budujWariant("Optymalny — zrównoważony z parterem usługowym", "mlodzi", d, obwiednia, w, cfg, {
      typologia: "pierzejowa_mixed_use",
      kondygnacje: Math.max(3, maks - 1),
      udzialUslugPct: Math.min(udzialUslug, 20),
    }),
    budujWariant("Maksymalny — najwięcej mieszkań", "mlodzi", d, obwiednia, w, cfg, {
      kondygnacje: maks,
    }),
    budujWariant("Kameralny — niższa intensywność", "mlodzi", d, obwiednia, w, cfg, {
      typologia: "niska_wielorodzinna",
      kondygnacje: kameralne,
    }),
  ];
}

export function uruchomPoziom2(
  d: DaneDzialki,
  p1: WynikPoziom1,
  cfg: KonfiguracjaZabudowy = KONFIG_ZABUDOWA
): WynikPoziom2 {
  const w = wyznaczWskazniki(d, cfg);
  const obwiednia = liczObwiednie(d, w, cfg);
  const udzialUslug = d.wskaznikiPlanistyczne?.udzialUslugPct ?? 15;

  // Uwarunkowania przeniesione z P1: bramki (kanał E), sygnały, braki, kluczowe liczby.
  const bramki = liczBramki(d);
  const sygnaly = liczSygnaly(d, bramki.szczegoly, KONFIG_SCORING);
  const braki = liczBraki(d, bramki.szczegoly);
  const kluczoweLiczby = liczKluczoweLiczby(d, KONFIG_SCORING);

  // DOMKNIĘCIE M2 (kanały A–F): popyt realizowalny + przydatność ekonomiczna + bramki
  // → werdykt per profil + rekomendacja. To TU wpisane dane (odległości) zmieniają wynik.
  const ocenaM2 = ocenM2(d, p1, bramki.status);

  // Trzy warianty (optymalny/maksymalny/kameralny) dla OBU profili. Profil wiodący =
  // rekomendacja M2 (nie tylko z M1); „brak" → wyższy score M2 jako informacyjny wiodący.
  const wiodacy: Profil =
    ocenaM2.rekomendacja !== "brak"
      ? ocenaM2.rekomendacja
      : ocenaM2.werdykty.seniorzy.score >= ocenaM2.werdykty.mlodzi.score
        ? "seniorzy"
        : "mlodzi";
  const drugi: Profil = wiodacy === "seniorzy" ? "mlodzi" : "seniorzy";
  const warianty = [
    ...triadaWariantow(wiodacy, d, obwiednia, w, cfg, udzialUslug),
    ...triadaWariantow(drugi, d, obwiednia, w, cfg, udzialUslug),
  ];

  return {
    dzialkaId: d.id,
    obwiednia,
    warianty,
    flagiRyzyka: flagiRyzyka(d, obwiednia, w, cfg, p1),
    bramki,
    sygnaly,
    braki,
    kluczoweLiczby,
    ocenaM2,
  };
}
