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
import { logDebug, skrot } from "../debug";
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

/**
 * Znajduje nazwę warstwy w odpowiedzi GetCapabilities po słowie kluczowym
 * (w nazwie lub tytule warstwy). Pozwala samoczynnie skorygować nazwę warstwy,
 * gdy ta z konfiguracji się nie zgadza. Zwraca null, gdy nic nie pasuje.
 */
export function znajdzWarstwe(xml: string, slowo: string): string | null {
  const s = slowo.toLowerCase();
  const bloki = xml.split(/<Layer\b/i).slice(1);
  for (const blok of bloki) {
    const name = /<Name>\s*([^<]+?)\s*<\/Name>/i.exec(blok)?.[1];
    const title = /<Title>\s*([^<]+?)\s*<\/Title>/i.exec(blok)?.[1];
    if (!name) continue;
    if (name.toLowerCase().includes(s) || (title ?? "").toLowerCase().includes(s)) return name;
  }
  return null;
}

// Cache odkrytych warstw per źródło (w obrębie instancji serwera).
const cacheWarstw = new Map<string, string>();

async function ustalWarstwe(cfg: KonfiguracjaWms): Promise<string> {
  // Skonfigurowana nazwa warstwy jest nadrzędna (potwierdzona z GetCapabilities).
  if (cfg.warstwy) return cfg.warstwy;
  if (cacheWarstw.has(cfg.klucz)) return cacheWarstw.get(cfg.klucz)!;
  // Fallback: auto-odkrycie warstwy z GetCapabilities po słowie kluczowym.
  let warstwa = cfg.warstwy;
  const caps = await fetchTekst(
    `${cfg.endpoint}?SERVICE=WMS&VERSION=${cfg.wersjaWms}&REQUEST=GetCapabilities`,
    { timeoutMs: 5000, proby: 1 }
  );
  if (caps) {
    const odkryta = znajdzWarstwe(caps, cfg.slowoKluczowe);
    if (odkryta) warstwa = odkryta;
  }
  cacheWarstw.set(cfg.klucz, warstwa);
  return warstwa;
}

function urlGetFeatureInfo(cfg: KonfiguracjaWms, warstwa: string, c: [number, number]): string {
  const [x, y] = c;
  const d = 20;
  const p = new URLSearchParams({
    SERVICE: "WMS",
    VERSION: cfg.wersjaWms,
    REQUEST: "GetFeatureInfo",
    SRS: "EPSG:2180",
    LAYERS: warstwa,
    QUERY_LAYERS: warstwa,
    STYLES: "",
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
      const warstwa = await ustalWarstwe(cfg); // auto-odkrycie nazwy warstwy (GetCapabilities)
      const url = urlGetFeatureInfo(cfg, warstwa, c);
      logDebug(`WMS ${cfg.klucz} → ${url}`);
      const tekst = await fetchTekst(url, { timeoutMs: 7000, proby: 1 });
      if (tekst === null) return brakWyniku(this.klucz, this.zrodlo, czas, "Brak odpowiedzi WMS (timeout/HTTP).");
      logDebug(`WMS ${cfg.klucz} ← ${skrot(tekst, 400)}`);
      const ocena = ocenOdpowiedzWms(tekst);
      if (ocena === "blad") return brakWyniku(this.klucz, this.zrodlo, czas, `Wyjątek WMS: ${skrot(tekst, 200)}`);
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
