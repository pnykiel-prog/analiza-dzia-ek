/**
 * Konektor odległości do usług (M2, kanał A) — DWA źródła połączone:
 *  - szkoły/przedszkola/POZ/apteki → STATYCZNA warstwa z rejestrów (RSPO/RPWDL/RA),
 *    lokalna, deterministyczna, bez egresu (spec „statyczne warstwy usług");
 *  - przystanek/sklep → OSM/Overpass na żywo (brak rejestru / szybka rotacja).
 *
 * Kandydaci z obu źródeł → k-najbliższych → realna trasa pieszą (ORS Matrix) albo
 * linia prosta (haversine) → `odleglosciM2` (wejście bramki kanału A). Warstwa
 * statyczna działa NAWET gdy Overpass jest niedostępny — kluczowe dla produkcji.
 *
 * Anty-pętla: wyścig mirrorów Overpass pod jednym limitem. Brak punktu/odpowiedzi
 * → „brak" dla danej usługi (nie dyskwalifikuje; reguła kolizji „równorzędna").
 *
 * Funkcje klasyfikujące/liczące są czyste (testowane offline).
 */

import type { DaneDzialki } from "../../types";
import type { Konektor, Teren, WynikKonektora, MetaPola } from "./types";
import { brakWyniku } from "./types";
import { KONFIG_KONEKTORY } from "../connectorsConfig";
import { KONFIG_M2 } from "../../config";
import { logDebug, skrot } from "../debug";
import { USER_AGENT } from "./net";
import type { Kandydat } from "./geoUslugi";
import { haversineM, minZDystansow } from "./geoUslugi";
import { kandydaciStale } from "../uslugiStale";

export type { Kandydat } from "./geoUslugi";
export { haversineM, minZDystansow } from "./geoUslugi";

export interface ElementGeo {
  tags?: Record<string, string>;
  lat?: number;
  lon?: number;
  center?: { lat: number; lon: number };
}

const cfg = KONFIG_KONEKTORY.odleglosci;
const cfgR = KONFIG_KONEKTORY.routingPieszy;

/** Kategorie brane z OSM na żywo (reszta ze statycznej warstwy). */
const KATEGORIE_OSM = ["przystanek", "sklep"];

/** Klasyfikuje element OSM do klucza usługi z KONFIG_M2 (lub null, gdy nieistotny). */
export function klasyfikujUsluge(tags: Record<string, string>): string | null {
  const a = tags.amenity;
  if (tags.highway === "bus_stop" || tags.public_transport || ["station", "halt", "tram_stop"].includes(tags.railway ?? "")) return "przystanek";
  if (a === "pharmacy") return "apteka";
  if (a === "clinic" || a === "doctors") return "poz";
  if (a === "school") return "szkola";
  if (a === "kindergarten" || a === "childcare") return "przedszkole";
  if (["supermarket", "convenience", "grocery", "general"].includes(tags.shop ?? "")) return "sklep";
  return null;
}

/** Najbliższa odległość [m, zaokr. do 10] każdego typu usługi po linii prostej (fallback). */
export function zbierzOdleglosci(elementy: ElementGeo[], lat: number, lon: number): Record<string, number> {
  const min: Record<string, number> = {};
  for (const el of elementy) {
    const key = klasyfikujUsluge(el.tags ?? {});
    if (!key) continue;
    const elat = el.lat ?? el.center?.lat;
    const elon = el.lon ?? el.center?.lon;
    if (elat == null || elon == null) continue;
    const d = haversineM(lat, lon, elat, elon);
    if (min[key] == null || d < min[key]) min[key] = d;
  }
  const out: Record<string, number> = {};
  for (const [k, v] of Object.entries(min)) out[k] = Math.round(v / 10) * 10;
  return out;
}

/** k-najbliższych POI (po linii prostej) każdego typu — kandydaci do routingu (spec §5). */
export function kNajblizsze(elementy: ElementGeo[], lat: number, lon: number, k: number): Kandydat[] {
  const wg: Record<string, Kandydat[]> = {};
  for (const el of elementy) {
    const usluga = klasyfikujUsluge(el.tags ?? {});
    if (!usluga) continue;
    const elat = el.lat ?? el.center?.lat;
    const elon = el.lon ?? el.center?.lon;
    if (elat == null || elon == null) continue;
    (wg[usluga] ??= []).push({ usluga, lat: elat, lon: elon, dLinia: haversineM(lat, lon, elat, elon) });
  }
  const out: Kandydat[] = [];
  for (const arr of Object.values(wg)) {
    arr.sort((a, b) => a.dLinia - b.dLinia);
    out.push(...arr.slice(0, Math.max(1, k)));
  }
  return out;
}

// Overpass pyta TYLKO o przystanek/sklep — reszta ze statycznej warstwy.
function zapytanie(lat: number, lon: number, r: number): string {
  return `[out:json][timeout:25];
(
  nwr(around:${r},${lat},${lon})[shop~"^(supermarket|convenience|grocery|general)$"];
  nwr(around:${r},${lat},${lon})[highway=bus_stop];
  nwr(around:${r},${lat},${lon})[public_transport];
  nwr(around:${r},${lat},${lon})[railway~"^(station|halt|tram_stop)$"];
);
out tags center 500;`;
}

async function pobierzZInstancji(endpoint: string, lat: number, lon: number, sygnal: AbortSignal): Promise<ElementGeo[]> {
  const body = `data=${encodeURIComponent(zapytanie(lat, lon, cfg.promienM))}`;
  const r = await fetch(endpoint, {
    method: "POST",
    signal: sygnal,
    headers: { "Content-Type": "application/x-www-form-urlencoded", "User-Agent": USER_AGENT, Accept: "application/json" },
    body,
  });
  if (!r.ok) throw new Error(`HTTP ${r.status} (${endpoint})`);
  const txt = await r.text();
  logDebug(`Odległości OSM ← ${endpoint} ${skrot(txt, 200)}`);
  const j = JSON.parse(txt) as { elements?: ElementGeo[] };
  return Array.isArray(j.elements) ? j.elements : [];
}

/** Wyścig mirrorów — pierwsza udana odpowiedź wygrywa; wszystkie pod jednym limitem. */
async function pobierzOverpass(lat: number, lon: number): Promise<ElementGeo[] | null> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), cfg.timeoutMs);
  try {
    logDebug(`Odległości OSM → wyścig ${cfg.endpointy.length} instancji (r=${cfg.promienM}, ${lat.toFixed(4)},${lon.toFixed(4)})`);
    return await Promise.any(cfg.endpointy.map((e) => pobierzZInstancji(e, lat, lon, ctrl.signal)));
  } catch (e) {
    logDebug(`Odległości OSM — brak odpowiedzi (${String(e)})`);
    return null;
  } finally {
    clearTimeout(t);
    ctrl.abort();
  }
}

/**
 * Realna trasa pieszą do kandydatów (ORS Matrix, jedno zapytanie). Zwraca dystanse [m]
 * w kolejności `kand` (null gdy nieosiągalny) albo null, gdy brak klucza/awaria/wyłączony.
 */
async function routujMatrix(originLon: number, originLat: number, kand: Kandydat[]): Promise<(number | null)[] | null> {
  const klucz = process.env.ORS_API_KEY;
  if (!cfgR.aktywny || !klucz || kand.length === 0) return null;
  const locations = [[originLon, originLat], ...kand.map((c) => [c.lon, c.lat])];
  const destinations = kand.map((_, i) => i + 1);
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), cfgR.timeoutMs);
  try {
    const r = await fetch(cfgR.endpointMatrix, {
      method: "POST",
      signal: ctrl.signal,
      headers: { Authorization: klucz, "Content-Type": "application/json", Accept: "application/json", "User-Agent": USER_AGENT },
      body: JSON.stringify({ locations, sources: [0], destinations, metrics: ["distance"] }),
    });
    if (!r.ok) {
      logDebug(`Routing ORS HTTP ${r.status}`);
      return null;
    }
    const j = (await r.json()) as { distances?: (number | null)[][] };
    const row = j.distances?.[0];
    return Array.isArray(row) ? row.map((v) => (typeof v === "number" ? v : null)) : null;
  } catch (e) {
    logDebug(`Routing ORS błąd: ${String(e)}`);
    return null;
  } finally {
    clearTimeout(t);
    ctrl.abort();
  }
}

/** Proxy dostępności (flagi M1) z odległości: usługa w progu pieszym → true. */
function proxyZOdleglosci(odl: Record<string, number>): Partial<DaneDzialki> {
  const prog = KONFIG_M2.progPieszoM;
  const wZasiegu = (...klucze: string[]): boolean | undefined => {
    const znane = klucze.filter((k) => odl[k] != null);
    return znane.length === 0 ? undefined : znane.some((k) => odl[k] <= prog);
  };
  const p: Partial<DaneDzialki> = {};
  // Uwaga: przystanekZCzestotliwoscia NIE z OSM — martwy słupek bez rozkładu nie daje
  // częstotliwości (wytyczne transport §2). Ustawia je konektor GTFS. OSM daje tylko
  // LOKALIZACJĘ przystanku (odległość w odleglosciM2) — do bramki kanału A w kontekście miejskim.
  const uslugi = wZasiegu("sklep", "apteka");
  const poz = wZasiegu("poz");
  const eduk = wZasiegu("szkola", "przedszkole");
  if (uslugi !== undefined) p.uslugiPodstawowePieszo = uslugi;
  if (poz !== undefined) p.pozWZasiegu = poz;
  if (eduk !== undefined) p.zlobkiSzkolyWZasiegu = eduk;
  return p;
}

export const konektorOdleglosci: Konektor = {
  klucz: "ODLEGLOSCI_USLUG",
  zrodlo: "Odległości usług (warstwa stała RSPO/RPWDL/RA + OSM)",
  poziom: "P2",
  aktywny: cfg.aktywny,
  async pobierz(teren: Teren): Promise<WynikKonektora> {
    const czas = new Date().toISOString();
    if (!teren.centroid4326) return brakWyniku(this.klucz, this.zrodlo, czas, "Brak centroidu WGS84 (brak geometrii).");
    const [lon, lat] = teren.centroid4326;

    // 1) Warstwa statyczna (offline): szkoły/przedszkola/POZ/apteki — tylko w buforze
    //    (punkty poza `promienM` = luka pokrycia, pomijane; kategoria pytana ręcznie).
    const kandStale = kandydaciStale(lat, lon, cfgR.k, undefined, cfg.promienM);
    // 2) OSM na żywo: przystanek/sklep (może być null przy blokadzie — statyka i tak działa).
    const elementy = await pobierzOverpass(lat, lon);
    const kandOsm = elementy ? kNajblizsze(elementy, lat, lon, cfgR.k).filter((k) => KATEGORIE_OSM.includes(k.usluga)) : [];

    const kand = [...kandStale, ...kandOsm];
    if (kand.length === 0) {
      return brakWyniku(this.klucz, this.zrodlo, czas, "Brak usług (statyka + OSM) w zasięgu — nieoznaczone, nie dyskwalifikuje.");
    }

    // Realna trasa pieszą do kandydatów (spec §5); brak klucza/awaria → linia prosta.
    const trasy = await routujMatrix(lon, lat, kand);
    const trasowane = trasy ? minZDystansow(kand, trasy) : null;
    const odleglosciM2 = trasowane ?? minZDystansow(kand, kand.map(() => null));
    const metoda = trasowane ? "trasa pieszą (ORS)" : "linia prosta (haversine)";
    const zrodloOpis = kandOsm.length ? "warstwa stała + OSM" : "warstwa stała";
    logDebug(`Odległości (${zrodloOpis}, ${metoda}) → ${JSON.stringify(odleglosciM2)}`);

    const dane: Partial<DaneDzialki> = { odleglosciM2, ...proxyZOdleglosci(odleglosciM2) };
    const meta: MetaPola[] = (Object.keys(dane) as (keyof DaneDzialki)[]).map((pole) => ({
      pole,
      zrodlo: `${zrodloOpis} · ${metoda}`,
      czas,
      pewnosc: trasowane ? (pole === "odleglosciM2" ? 80 : 70) : pole === "odleglosciM2" ? 60 : 55,
      status: "ok",
      tryb: "A",
    }));
    return { klucz: this.klucz, zrodlo: this.zrodlo, status: "ok", czas, dane, meta };
  },
};
