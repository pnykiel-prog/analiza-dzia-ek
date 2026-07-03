/**
 * Konektor KIMPZP — status planistyczny (M1).
 *
 * WMS GetFeatureInfo w centroidzie terenu. Pułapka z wytycznych: ~75% gmin to
 * rastry (brak atrybutów) → wtedy „brak" (silnik potraktuje jako „do weryfikacji",
 * nigdy „wykluczone"). Atrybuty wyciągniemy tylko z gmin wektorowych.
 *
 * Implementacja best-effort i defensywna: przy niepewnym formacie/osi współrzędnych
 * zwraca „brak", nie błąd. Pełne dostrojenie po weryfikacji na żywych danych.
 */

import type { DaneDzialki, MetrykaPlanu, StatusPlanistyczny } from "../../types";
import type { Konektor, Teren, WynikKonektora, MetaPola } from "./types";
import { brakWyniku } from "./types";
import { fetchTekst } from "./net";
import { KONFIG_KONEKTORY } from "../connectorsConfig";

const cfg = KONFIG_KONEKTORY.kimpzp;

/** Heurystyka przeznaczenia z tekstu odpowiedzi WMS (JSON/HTML/XML). */
export function rozpoznajPrzeznaczenie(tekst: string): StatusPlanistyczny | null {
  const t = tekst.toLowerCase();
  if (!t.trim()) return null;
  // Sprzeczne z mieszkaniową (przemysł, las, drogi, tereny zamknięte).
  if (/\b(przemys|produkcyj|tereny zamkn|las|leśn|cmentar|górnicz)/.test(t)) return "sprzeczny";
  // Mieszkaniowe: symbole (MN/MW/MU/MWn) oraz opisy wielowyrazowe
  // („zabudowa … mieszkaniowa/wielofunkcyjna", „funkcja mieszkaniowa").
  // „mieszkanio” łapie deklinacje (mieszkaniowa/-ej/-ych); „mieszkalni” — budynki mieszkalne.
  if (/mieszkanio|mieszkaln|funkcja mieszkan|zabudow[ay][^.]{0,40}mieszkan|\bm[nwu]\b|\bmwn\b/.test(t))
    return "mpzp_mieszkaniowy";
  return null;
}

/** Czy odpowiedź WMS jest PUSTA (brak planu w punkcie) — inaczej niż „raster bez atrybutów". */
export function czyPustyWynik(tekst: string): boolean {
  const t = tekst.trim();
  if (!t) return true;
  if (/"features"\s*:\s*\[\s*\]/.test(t)) return true; // GeoJSON: pusta lista cech
  // XML GetFeatureInfo_Result z pustymi ROWSET i bez pól/wierszy.
  if (/GetFeatureInfo_Result/i.test(t) && !/<FIELDS|<gml:|<wfs:|"properties"/i.test(t)) return true;
  return false;
}

/** Wyciąga metrykę planu z odpowiedzi GeoJSON KIMPZP (gmina wektorowa). */
export function parsujMpzpJson(tekst: string): { status: StatusPlanistyczny | null; meta: MetrykaPlanu } | null {
  let obj: unknown;
  try { obj = JSON.parse(tekst); } catch { return null; }
  const feats = (obj as { features?: { properties?: Record<string, unknown> }[] })?.features;
  if (!Array.isArray(feats) || feats.length === 0) return null;
  const props = feats.map((f) => f?.properties ?? {});
  const s = (v: unknown) => (v == null || v === "" ? undefined : String(v));
  const przez = props.find((p) => p.SYMBOL || p.S_STANDARD || p.KOLOR); // warstwa przeznaczenia
  const gran = props.find((p) => p.NAZWA || p.NAZWA2 || p.DZIENNIK || p.D_WEJSCIA); // warstwa granic planu
  if (!przez && !gran) return null;
  const meta: MetrykaPlanu = {
    symbol: s(przez?.SYMBOL),
    standard: s(przez?.S_STANDARD ?? przez?.KOLOR),
    opis: s(przez?.OPIS),
    stawkaPct: przez?.STAWKA != null && przez.STAWKA !== "" ? Number(przez.STAWKA) : null,
    nazwaPlanu: s(gran?.NAZWA2 ?? gran?.NAZWA),
    uchwala: s(przez?.UCHWALA ?? gran?.UCHWALA),
    dataWejscia: s(gran?.D_WEJSCIA),
  };
  // Status z symbolu/standardu + opisu (ta sama heurystyka co dla tekstu).
  const status = rozpoznajPrzeznaczenie(`${meta.standard ?? ""} ${meta.symbol ?? ""} ${meta.opis ?? ""}`);
  return { status, meta };
}

/** Buduje URL GetFeatureInfo KIMPZP dla punktu (EPSG:2180). Współdzielony z diagnostyką. */
export function urlGetFeatureInfo(x: number, y: number, infoFormat: string = cfg.infoFormat): string {
  const d = 25; // półbok okna zapytania [m]
  // WMS 1.1.1: BBOX = minx,miny,maxx,maxy w naturalnej kolejności SRS.
  const params = new URLSearchParams({
    SERVICE: "WMS",
    VERSION: "1.1.1",
    REQUEST: "GetFeatureInfo",
    SRS: "EPSG:2180",
    LAYERS: cfg.warstwy,
    QUERY_LAYERS: cfg.warstwy,
    BBOX: `${x - d},${y - d},${x + d},${y + d}`,
    WIDTH: "101",
    HEIGHT: "101",
    X: "50",
    Y: "50",
    INFO_FORMAT: infoFormat,
    FEATURE_COUNT: "5",
  });
  return `${cfg.endpoint}?${params.toString()}`;
}

/**
 * Diagnostyka KIMPZP: dla centroidu (EPSG:2180) zwraca URL zapytania, surową
 * odpowiedź WMS i rozpoznane przeznaczenie. Próbuje kolejno formatów odpowiedzi
 * (JSON → tekst → HTML → GML), bo różne gminy udostępniają różne INFO_FORMAT.
 */
export async function diagKimpzp(
  x: number,
  y: number
): Promise<{
  formatUzyty: string | null;
  url: string;
  dlugosc: number;
  przeznaczenie: StatusPlanistyczny | null;
  metryka: MetrykaPlanu | null;
  pusty: boolean;
  surowa: string | null;
}> {
  const formaty = [cfg.infoFormat, "text/plain", "text/html", "application/vnd.ogc.gml"];
  let ostatniUrl = urlGetFeatureInfo(x, y);
  for (const fmt of formaty) {
    const url = urlGetFeatureInfo(x, y, fmt);
    ostatniUrl = url;
    const tekst = await fetchTekst(url, { timeoutMs: 6000, proby: 1 });
    if (tekst && tekst.trim().length > 0) {
      const strukt = parsujMpzpJson(tekst);
      return {
        formatUzyty: fmt,
        url,
        dlugosc: tekst.length,
        przeznaczenie: strukt?.status ?? rozpoznajPrzeznaczenie(tekst),
        metryka: strukt?.meta ?? null,
        pusty: czyPustyWynik(tekst),
        surowa: tekst.slice(0, 2500),
      };
    }
  }
  return { formatUzyty: null, url: ostatniUrl, dlugosc: 0, przeznaczenie: null, metryka: null, pusty: true, surowa: null };
}

/** Sygnał pokrycia KIMPZP w punkcie — rozróżnia brak serwisu (dziura) od braku planu (pokryte). */
export type SygnalKimpzp =
  | "plan" // jest plan (metryka/przeznaczenie)
  | "serwis_bez_planu" // serwis gminy odpowiada, w tym punkcie brak planu → POKRYTE
  | "brak_serwisu" // „brak serwisu dla wskazanego obszaru" → DZIURA (brak integracji)
  | "blad_serwisu" // ServiceException / nie da się wyrenderować → DZIURA (integracja zepsuta)
  | "pusto" // pusty wynik strukturalny (ROWSET/features) → niejednoznaczne
  | "niejasne" // treść nierozpoznana
  | "blad"; // brak odpowiedzi (sieć)

/** Klasyfikuje odpowiedź KIMPZP na sygnał pokrycia (czyta komunikaty serwisu). */
export function sygnalZTekstu(tekst: string | null): { sygnal: SygnalKimpzp; przeznaczenie: StatusPlanistyczny | null; symbol?: string } {
  if (tekst == null) return { sygnal: "blad", przeznaczenie: null };
  const strukt = parsujMpzpJson(tekst);
  if (strukt && (strukt.status || strukt.meta.symbol || strukt.meta.standard)) {
    return { sygnal: "plan", przeznaczenie: strukt.status, symbol: strukt.meta.symbol ?? strukt.meta.standard };
  }
  const przez = rozpoznajPrzeznaczenie(tekst);
  if (przez) return { sygnal: "plan", przeznaczenie: przez };
  const t = tekst.toLowerCase();
  if (/brak serwisu/.test(t)) return { sygnal: "brak_serwisu", przeznaczenie: null };
  if (/serviceexception|invalidxsltemplate|can'?t template|nie mo[żz]na/.test(t)) return { sygnal: "blad_serwisu", przeznaczenie: null };
  if (/brak wyniku dla wskazanego obszaru|brak wyniku/.test(t)) return { sygnal: "serwis_bez_planu", przeznaczenie: null };
  if (czyPustyWynik(tekst)) return { sygnal: "pusto", przeznaczenie: null };
  return { sygnal: "niejasne", przeznaczenie: null };
}

/** Lekka sonda KIMPZP (jedno zapytanie z retry): sygnał pokrycia w punkcie. */
export async function sondaKimpzp(
  x: number,
  y: number,
  opcje?: { timeoutMs?: number; proby?: number; raw?: boolean }
): Promise<{ sygnal: SygnalKimpzp; przeznaczenie: StatusPlanistyczny | null; symbol?: string; raw?: string | null }> {
  const tekst = await fetchTekst(urlGetFeatureInfo(x, y), { timeoutMs: opcje?.timeoutMs ?? 8000, proby: opcje?.proby ?? 2 });
  const raw = opcje?.raw ? (tekst == null ? null : tekst.slice(0, 600)) : undefined;
  return { ...sygnalZTekstu(tekst), raw };
}

export const konektorKIMPZP: Konektor = {
  klucz: "KIMPZP",
  zrodlo: "KIMPZP (Krajowa Integracja MPZP)",
  poziom: "P1",
  aktywny: cfg.aktywny,
  async pobierz(teren: Teren): Promise<WynikKonektora> {
    const czas = new Date().toISOString();
    const c = teren.centroid2180;
    if (!c) return brakWyniku(this.klucz, this.zrodlo, czas, "Brak centroidu terenu (brak geometrii).");

    const [x, y] = c;
    const tekst = await fetchTekst(urlGetFeatureInfo(x, y), { timeoutMs: 4500, proby: 1 });
    if (tekst === null) return brakWyniku(this.klucz, this.zrodlo, czas, "Brak odpowiedzi WMS.");

    // 1) Ścieżka strukturalna (GeoJSON, gmina wektorowa) — metryka planu + status.
    const strukt = parsujMpzpJson(tekst);
    if (strukt && (strukt.status || strukt.meta.symbol || strukt.meta.standard)) {
      const dane: Partial<DaneDzialki> = { mpzpMeta: strukt.meta };
      const meta: MetaPola[] = [{ pole: "mpzpMeta", zrodlo: this.zrodlo, czas, pewnosc: 80, status: "ok", tryb: "A" }];
      if (strukt.status) {
        dane.statusPlanistyczny = strukt.status;
        meta.push({ pole: "statusPlanistyczny", zrodlo: this.zrodlo, czas, pewnosc: 80, status: "ok", tryb: "A" });
      }
      return { klucz: this.klucz, zrodlo: this.zrodlo, status: "ok", czas, dane, meta };
    }

    // 2) Ścieżka tekstowa (HTML/plain) — sam status z heurystyki.
    const przeznaczenie = rozpoznajPrzeznaczenie(tekst);
    if (przeznaczenie) {
      return {
        klucz: this.klucz,
        zrodlo: this.zrodlo,
        status: "ok",
        czas,
        dane: { statusPlanistyczny: przeznaczenie },
        meta: [{ pole: "statusPlanistyczny", zrodlo: this.zrodlo, czas, pewnosc: 60, status: "ok", tryb: "A" }],
      };
    }

    // 3) Rozróżnienie: pusty wynik (brak planu w punkcie) vs raster (brak atrybutów).
    return brakWyniku(
      this.klucz,
      this.zrodlo,
      czas,
      czyPustyWynik(tekst)
        ? "Brak planu w tym punkcie w KIMPZP (pusty wynik) — do weryfikacji (możliwa luka pokrycia, np. Warszawa)."
        : "Odpowiedź bez rozpoznanych atrybutów (prawdopodobnie raster) — do weryfikacji."
    );
  },
};
