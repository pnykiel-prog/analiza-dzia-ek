/**
 * Generyczny konektor „obecność obiektu w punkcie" (WMS GetFeatureInfo) → bramka.
 *
 * Dla warstw poligonowych (Natura 2000, powódź, osuwiska, strefy ochrony) sam
 * fakt zwrócenia obiektu w centroidzie terenu oznacza, że punkt leży w obszarze
 * → ustawiamy pole logiczne. Wyjątek WMS (zła warstwa/usługa) → status „brak"
 * (silnik potraktuje jako „do weryfikacji", nie „wykluczone").
 */

import type { DaneDzialki } from "../../types";
import type { Konektor, Teren, WynikKonektora } from "./types";
import { brakWyniku } from "./types";
import { fetchTekst } from "./net";
import { KONFIG_KONEKTORY } from "../connectorsConfig";

export type WynikWms = "obecny" | "pusty" | "blad";

/** Ocena odpowiedzi WMS GetFeatureInfo (JSON/GML/HTML) — czy w punkcie jest obiekt. */
export function ocenOdpowiedzWms(tekst: string): WynikWms {
  const t = tekst.trim();
  if (!t) return "pusty";
  if (/serviceexception|<ows:exception|exceptionreport/i.test(t)) return "blad";
  if (t.startsWith("{") || t.startsWith("[")) {
    try {
      const j = JSON.parse(t) as { features?: unknown[] };
      if (Array.isArray(j.features)) return j.features.length > 0 ? "obecny" : "pusty";
    } catch {
      /* nie-JSON mimo nawiasu */
    }
  }
  if (/featuremember|<wfs:member|gml:featuremembers?/i.test(t)) return "obecny";
  return "pusty";
}

function urlGetFeatureInfo(cfg: KonfiguracjaWms, c: [number, number]): string {
  const [x, y] = c;
  const d = 20;
  const p = new URLSearchParams({
    SERVICE: "WMS",
    VERSION: cfg.wersjaWms,
    REQUEST: "GetFeatureInfo",
    SRS: "EPSG:2180",
    LAYERS: cfg.warstwy,
    QUERY_LAYERS: cfg.warstwy,
    BBOX: `${x - d},${y - d},${x + d},${y + d}`,
    WIDTH: "101",
    HEIGHT: "101",
    X: "50",
    Y: "50",
    INFO_FORMAT: cfg.infoFormat,
    FEATURE_COUNT: "3",
  });
  return `${cfg.endpoint}?${p.toString()}`;
}

type KonfiguracjaWms = KonfiguracjaKonektorowWms;
type KonfiguracjaKonektorowWms = (typeof KONFIG_KONEKTORY)["wmsObecnosc"][number];

function utworzKonektorWms(cfg: KonfiguracjaWms): Konektor {
  return {
    klucz: cfg.klucz,
    zrodlo: cfg.zrodlo,
    poziom: "P1",
    aktywny: cfg.aktywny,
    async pobierz(teren: Teren): Promise<WynikKonektora> {
      const czas = new Date().toISOString();
      const c = teren.centroid2180;
      if (!c) return brakWyniku(this.klucz, this.zrodlo, czas, "Brak centroidu (brak geometrii).");
      const tekst = await fetchTekst(urlGetFeatureInfo(cfg, c), KONFIG_KONEKTORY.siec);
      if (tekst === null) return brakWyniku(this.klucz, this.zrodlo, czas, "Brak odpowiedzi WMS.");
      const ocena = ocenOdpowiedzWms(tekst);
      if (ocena === "blad") return brakWyniku(this.klucz, this.zrodlo, czas, "Wyjątek WMS (sprawdź warstwę/endpoint).");
      const obecny = ocena === "obecny";
      const dane: Partial<DaneDzialki> = { [cfg.pole]: obecny } as Partial<DaneDzialki>;
      return {
        klucz: this.klucz,
        zrodlo: this.zrodlo,
        status: "ok",
        czas,
        dane,
        meta: [{ pole: cfg.pole, zrodlo: this.zrodlo, czas, pewnosc: obecny ? 85 : 60, status: "ok", tryb: "A" }],
      };
    },
  };
}

/** Konektory obecności WMS z konfiguracji. */
export const konektoryWms: Konektor[] = KONFIG_KONEKTORY.wmsObecnosc.map(utworzKonektorWms);
