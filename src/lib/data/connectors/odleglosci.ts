/**
 * Konektor odległości do usług (M2, kanał A) — OSM/Overpass → numeryczne odległości.
 *
 * Wypełnia `odleglosciM2` (metry, najbliższy obiekt każdego typu w buforze) — wejście
 * bramki obsługiwalności kanału A (spec §4). Dodatkowo wyprowadza proxy dostępności
 * (przystanek/usługi/POZ/szkoły) dla flag M1 z progu pieszego — dzięki temu stary
 * konektor `overpass` pozostaje uśpiony (jedno zapytanie zamiast dwóch).
 *
 * Ograniczenie: odległość liczona po linii prostej (haversine), nie realną trasą pieszą —
 * stąd obniżona pewność. Trasa pieszą (OSRM/ORS) dołożymy jako wzbogacenie.
 *
 * Anty-pętla: WYŚCIG mirrorów (Promise.any) z jednym krótkim limitem — worst-case ~timeoutMs,
 * a nie suma po wszystkich instancjach. Brak odpowiedzi → „brak" (nie dyskwalifikuje).
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

export interface ElementGeo {
  tags?: Record<string, string>;
  lat?: number;
  lon?: number;
  center?: { lat: number; lon: number };
}

const cfg = KONFIG_KONEKTORY.odleglosci;

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

/** Odległość po elipsoidzie (haversine) w metrach. */
export function haversineM(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371000;
  const rad = Math.PI / 180;
  const dLat = (lat2 - lat1) * rad;
  const dLon = (lon2 - lon1) * rad;
  const s = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * rad) * Math.cos(lat2 * rad) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(s)));
}

/** Najbliższa odległość [m, zaokr. do 10] każdego typu usługi wśród elementów. */
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

function zapytanie(lat: number, lon: number, r: number): string {
  return `[out:json][timeout:25];
(
  nwr(around:${r},${lat},${lon})[shop~"^(supermarket|convenience|grocery|general)$"];
  nwr(around:${r},${lat},${lon})[highway=bus_stop];
  nwr(around:${r},${lat},${lon})[public_transport];
  nwr(around:${r},${lat},${lon})[railway~"^(station|halt|tram_stop)$"];
  nwr(around:${r},${lat},${lon})[amenity~"^(pharmacy|clinic|doctors|school|kindergarten|childcare)$"];
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
  logDebug(`Odległości ← ${endpoint} ${skrot(txt, 200)}`);
  const j = JSON.parse(txt) as { elements?: ElementGeo[] };
  return Array.isArray(j.elements) ? j.elements : [];
}

/** Wyścig mirrorów — pierwsza udana odpowiedź wygrywa; wszystkie pod jednym limitem. */
async function pobierzOverpass(lat: number, lon: number): Promise<ElementGeo[] | null> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), cfg.timeoutMs);
  try {
    logDebug(`Odległości → wyścig ${cfg.endpointy.length} instancji (r=${cfg.promienM}, ${lat.toFixed(4)},${lon.toFixed(4)})`);
    return await Promise.any(cfg.endpointy.map((e) => pobierzZInstancji(e, lat, lon, ctrl.signal)));
  } catch (e) {
    logDebug(`Odległości — brak odpowiedzi (${String(e)})`);
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
  const przyst = wZasiegu("przystanek");
  const uslugi = wZasiegu("sklep", "apteka");
  const poz = wZasiegu("poz");
  const eduk = wZasiegu("szkola", "przedszkole");
  if (przyst !== undefined) p.przystanekZCzestotliwoscia = przyst;
  if (uslugi !== undefined) p.uslugiPodstawowePieszo = uslugi;
  if (poz !== undefined) p.pozWZasiegu = poz;
  if (eduk !== undefined) p.zlobkiSzkolyWZasiegu = eduk;
  return p;
}

export const konektorOdleglosci: Konektor = {
  klucz: "OSM_ODLEGLOSCI",
  zrodlo: "OSM / Overpass (odległości)",
  poziom: "P2",
  aktywny: cfg.aktywny,
  async pobierz(teren: Teren): Promise<WynikKonektora> {
    const czas = new Date().toISOString();
    if (!teren.centroid4326) return brakWyniku(this.klucz, this.zrodlo, czas, "Brak centroidu WGS84 (brak geometrii).");
    const [lon, lat] = teren.centroid4326;
    const elementy = await pobierzOverpass(lat, lon);
    if (elementy === null) return brakWyniku(this.klucz, this.zrodlo, czas, "Brak odpowiedzi Overpass (wszystkie instancje).");

    const odleglosciM2 = zbierzOdleglosci(elementy, lat, lon);
    if (Object.keys(odleglosciM2).length === 0) {
      return brakWyniku(this.klucz, this.zrodlo, czas, "Brak usług w buforze (odległości nieoznaczone — nie dyskwalifikuje).");
    }
    const dane: Partial<DaneDzialki> = { odleglosciM2, ...proxyZOdleglosci(odleglosciM2) };
    const meta: MetaPola[] = (Object.keys(dane) as (keyof DaneDzialki)[]).map((pole) => ({
      pole,
      zrodlo: this.zrodlo,
      czas,
      // Linia prosta (nie trasa pieszą) → umiarkowana pewność.
      pewnosc: pole === "odleglosciM2" ? 60 : 55,
      status: "ok",
      tryb: "A",
    }));
    return { klucz: this.klucz, zrodlo: this.zrodlo, status: "ok", czas, dane, meta };
  },
};
