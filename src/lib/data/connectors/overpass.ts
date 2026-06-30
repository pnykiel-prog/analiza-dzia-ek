/**
 * Konektor OSM/Overpass — POI i transport (M2, Poziom 1, wymiar W3).
 *
 * Zapytanie `around` w promieniu od centroidu (WGS84). Wypełnia proxy dostępności:
 * przystanek, usługi pieszo, POZ, szkoły/żłobki. Uwaga: częstotliwość kursów nie
 * wynika z OSM — „przystanek z częstotliwością" traktujemy jako proxy (obecność
 * przystanku w zasięgu), z obniżoną pewnością.
 *
 * Funkcja klasyfikująca jest czysta (testowana offline).
 */

import type { DaneDzialki } from "../../types";
import type { Konektor, Teren, WynikKonektora, MetaPola } from "./types";
import { brakWyniku } from "./types";
import { KONFIG_KONEKTORY } from "../connectorsConfig";
import { logDebug, skrot } from "../debug";
import { USER_AGENT } from "./net";

export interface ElementOSM {
  tags?: Record<string, string>;
}

export interface KlasyfikacjaPoi {
  przystanek: boolean;
  uslugi: boolean;
  poz: boolean;
  szkola: boolean;
}

/** Klasyfikuje elementy OSM do proxy dostępności W3. */
export function klasyfikujPoi(elementy: ElementOSM[]): KlasyfikacjaPoi {
  const k: KlasyfikacjaPoi = { przystanek: false, uslugi: false, poz: false, szkola: false };
  for (const el of elementy) {
    const t = el.tags ?? {};
    if (t.highway === "bus_stop" || t.public_transport || t.railway === "station" || t.railway === "halt") k.przystanek = true;
    if (t.shop) k.uslugi = true;
    if (["clinic", "doctors", "hospital", "pharmacy"].includes(t.amenity ?? "")) k.poz = true;
    if (["kindergarten", "school"].includes(t.amenity ?? "")) k.szkola = true;
  }
  return k;
}

const cfg = KONFIG_KONEKTORY.overpass;

function zapytanie(lat: number, lon: number, r: number): string {
  return `[out:json][timeout:25];
(
  nwr(around:${r},${lat},${lon})[shop];
  nwr(around:${r},${lat},${lon})[highway=bus_stop];
  nwr(around:${r},${lat},${lon})[public_transport];
  nwr(around:${r},${lat},${lon})[railway~"^(station|halt)$"];
  nwr(around:${r},${lat},${lon})[amenity~"^(clinic|doctors|hospital|pharmacy|kindergarten|school)$"];
);
out tags 300;`;
}

async function pobierzZInstancji(endpoint: string, lat: number, lon: number): Promise<ElementOSM[] | null> {
  const ctrl = new AbortController();
  // Overpass bywa wolny (zapytanie ma [timeout:25]) — dłuższy limit niż domyślny.
  const t = setTimeout(() => ctrl.abort(), 28000);
  try {
    const body = `data=${encodeURIComponent(zapytanie(lat, lon, cfg.promienM))}`;
    logDebug(`Overpass → ${endpoint} (${lat.toFixed(5)},${lon.toFixed(5)} r=${cfg.promienM})`);
    const r = await fetch(endpoint, {
      method: "POST",
      signal: ctrl.signal,
      headers: { "Content-Type": "application/x-www-form-urlencoded", "User-Agent": USER_AGENT, Accept: "application/json" },
      body,
    });
    if (!r.ok) {
      logDebug(`Overpass HTTP ${r.status} (${endpoint})`);
      return null;
    }
    const txt = await r.text();
    logDebug(`Overpass ← ${skrot(txt, 300)}`);
    const j = JSON.parse(txt) as { elements?: ElementOSM[] };
    return Array.isArray(j.elements) ? j.elements : [];
  } catch (e) {
    logDebug(`Overpass błąd (${endpoint}): ${String(e)}`);
    return null;
  } finally {
    clearTimeout(t);
  }
}

/** Próbuje kolejnych instancji Overpass aż któraś odpowie. */
async function pobierzOverpass(lat: number, lon: number): Promise<ElementOSM[] | null> {
  for (const endpoint of cfg.endpointy) {
    const wynik = await pobierzZInstancji(endpoint, lat, lon);
    if (wynik !== null) return wynik;
  }
  return null;
}

export const konektorOverpass: Konektor = {
  klucz: "OSM_OVERPASS",
  zrodlo: "OSM / Overpass",
  poziom: "P1",
  aktywny: cfg.aktywny,
  async pobierz(teren: Teren): Promise<WynikKonektora> {
    const czas = new Date().toISOString();
    if (!teren.centroid4326) return brakWyniku(this.klucz, this.zrodlo, czas, "Brak centroidu WGS84 (brak geometrii).");
    const [lon, lat] = teren.centroid4326;
    const elementy = await pobierzOverpass(lat, lon);
    if (elementy === null) return brakWyniku(this.klucz, this.zrodlo, czas, "Brak odpowiedzi Overpass.");

    const k = klasyfikujPoi(elementy);
    const dane: Partial<DaneDzialki> = {
      przystanekZCzestotliwoscia: k.przystanek, // proxy: obecność przystanku (bez częstotliwości)
      uslugiPodstawowePieszo: k.uslugi,
      pozWZasiegu: k.poz,
      zlobkiSzkolyWZasiegu: k.szkola,
    };
    const meta: MetaPola[] = (Object.keys(dane) as (keyof DaneDzialki)[]).map((pole) => ({
      pole,
      zrodlo: this.zrodlo,
      czas,
      pewnosc: pole === "przystanekZCzestotliwoscia" ? 55 : 75,
      status: "ok",
      tryb: "A",
    }));
    return { klucz: this.klucz, zrodlo: this.zrodlo, status: "ok", czas, dane, meta };
  },
};
