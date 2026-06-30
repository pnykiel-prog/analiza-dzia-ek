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
  Typologia,
  WariantZabudowy,
  WynikPoziom1,
  WynikPoziom2,
} from "../types";
import type { KonfiguracjaZabudowy } from "../config";
import { KONFIG_ZABUDOWA } from "../config";

interface WskaznikiUzyte {
  intensywnosc: number;
  maxKondygnacje: number;
  maxPowZabudowyPct: number;
  minPbcPct: number;
  normatywParkingowy: number;
  zrodlo: Obwiednia["zrodloWskaznikow"];
  pewnosc: number;
}

function wyznaczWskazniki(d: DaneDzialki, cfg: KonfiguracjaZabudowy): WskaznikiUzyte {
  if (d.wskaznikiPlanistyczne) {
    const w = d.wskaznikiPlanistyczne;
    return {
      intensywnosc: w.intensywnosc,
      maxKondygnacje: w.maxKondygnacje,
      maxPowZabudowyPct: w.maxPowZabudowyPct,
      minPbcPct: w.minPbcPct,
      normatywParkingowy: w.normatywParkingowy,
      zrodlo: d.statusPlanistyczny === "mpzp_mieszkaniowy" ? "mpzp" : "plan_ogolny",
      pewnosc: d.statusPlanistyczny === "mpzp_mieszkaniowy" ? 95 : 80,
    };
  }
  // Fallback "dobrego sąsiedztwa": wskaźniki z otoczenia.
  const f = cfg.fallbackSasiedztwo;
  return {
    intensywnosc: f.intensywnosc,
    maxKondygnacje: f.maxKondygnacje,
    maxPowZabudowyPct: f.maxPowZabudowyPct,
    minPbcPct: f.minPbcPct,
    normatywParkingowy: cfg.normatywParkingowy.mlodzi,
    zrodlo: "sasiedztwo_fallback",
    pewnosc: 45,
  };
}

function liczObwiednie(d: DaneDzialki, w: WskaznikiUzyte, cfg: KonfiguracjaZabudowy): Obwiednia {
  const maxPowZabudowyM2 = (d.powierzchniaM2 * w.maxPowZabudowyPct) / 100;
  const powCalkowitaNadziemnaM2 = d.powierzchniaM2 * w.intensywnosc;
  const pumM2 = powCalkowitaNadziemnaM2 * cfg.wspolczynnikEfektywnosci;
  // max liczba kondygnacji = min( z wysokości , z intensywności / pow. zabudowy )
  const kondZIntensywnosci = maxPowZabudowyM2 > 0 ? powCalkowitaNadziemnaM2 / maxPowZabudowyM2 : w.maxKondygnacje;
  const maxKondygnacje = Math.max(1, Math.floor(Math.min(w.maxKondygnacje, kondZIntensywnosci)));
  return {
    maxPowZabudowyM2: Math.round(maxPowZabudowyM2),
    powCalkowitaNadziemnaM2: Math.round(powCalkowitaNadziemnaM2),
    pumM2: Math.round(pumM2),
    maxKondygnacje,
    zrodloWskaznikow: w.zrodlo,
    pewnoscObwiedni: w.pewnosc,
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
  if (obw.zrodloWskaznikow === "sasiedztwo_fallback")
    flagi.push("Brak MPZP — obwiednia oszacowana z sąsiedztwa, niska pewność.");
  if (p1.flagi.includes("Wysoka dotacja / ryzyko rentowności"))
    flagi.push("Wysoka wymagana dotacja (sygnał z modułu cenowego W5).");
  return flagi;
}

export function uruchomPoziom2(
  d: DaneDzialki,
  p1: WynikPoziom1,
  cfg: KonfiguracjaZabudowy = KONFIG_ZABUDOWA
): WynikPoziom2 {
  const w = wyznaczWskazniki(d, cfg);
  const obwiednia = liczObwiednie(d, w, cfg);
  const udzialUslug = d.wskaznikiPlanistyczne?.udzialUslugPct ?? 15;

  const warianty: WariantZabudowy[] = [];
  const profile: Profil[] =
    p1.profilRekomendowany === "oba"
      ? ["mlodzi", "seniorzy"]
      : p1.profilRekomendowany === "seniorzy"
        ? ["seniorzy"]
        : p1.profilRekomendowany === "mlodzi"
          ? ["mlodzi"]
          : // "zaden" — pokazujemy oba warianty informacyjnie
            ["mlodzi", "seniorzy"];

  for (const profil of profile) {
    if (profil === "mlodzi") {
      // Wariant 1: maksymalna liczba mieszkań
      warianty.push(
        budujWariant("Maks. liczba mieszkań (dla młodych)", "mlodzi", d, obwiednia, w, cfg, {
          kondygnacje: obwiednia.maxKondygnacje,
        })
      );
      // Wariant 2: zrównoważony z parterem usługowym
      warianty.push(
        budujWariant("Zrównoważony z parterem usługowym", "mlodzi", d, obwiednia, w, cfg, {
          typologia: "pierzejowa_mixed_use",
          kondygnacje: Math.max(3, obwiednia.maxKondygnacje - 1),
          udzialUslugPct: Math.min(udzialUslug, 20),
        })
      );
    } else {
      warianty.push(
        budujWariant("Senioralny w pełni dostępny", "seniorzy", d, obwiednia, w, cfg, {
          typologia: "senioralna_wspomagana",
          kondygnacje: Math.min(4, obwiednia.maxKondygnacje),
          udzialUslugPct: 8,
        })
      );
    }
  }

  return {
    dzialkaId: d.id,
    obwiednia,
    warianty,
    flagiRyzyka: flagiRyzyka(d, obwiednia, w, cfg, p1),
  };
}
