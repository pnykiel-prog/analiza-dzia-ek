/**
 * Konektor dojazdu do aglomeracji (M2, kanał C) — czasDojazdAglomeracjaMin.
 *
 * Proxy OFFLINE (deterministyczny, bez egresu): odległość po linii prostej do
 * najbliższego dużego ośrodka + średnia prędkość → czas [min]. Modyfikator popytu
 * (aglomeracja) tłumi popyt młodych silniej niż seniorów (kanał C). Wzbogacenie
 * realnym routingiem samochodowym (ORS driving) możliwe później — tu proxy zawsze
 * „ok", bo nie zależy od sieci.
 *
 * Funkcje czyste (testowane offline).
 */

import type { DaneDzialki } from "../../types";
import type { Konektor, Teren, WynikKonektora, MetaPola } from "./types";
import { brakWyniku } from "./types";
import { KONFIG_KONEKTORY } from "../connectorsConfig";
import { haversineM } from "./odleglosci";

/** Duże ośrodki (rdzenie aglomeracji) [nazwa, lat, lon] — dojazd do rynku pracy/usług wyższego rzędu. */
export const AGLOMERACJE: { nazwa: string; lat: number; lon: number }[] = [
  { nazwa: "Warszawa", lat: 52.2297, lon: 21.0122 },
  { nazwa: "Kraków", lat: 50.0647, lon: 19.945 },
  { nazwa: "Łódź", lat: 51.7592, lon: 19.4559 },
  { nazwa: "Wrocław", lat: 51.1079, lon: 17.0385 },
  { nazwa: "Poznań", lat: 52.4064, lon: 16.9252 },
  { nazwa: "Gdańsk", lat: 54.352, lon: 18.6466 },
  { nazwa: "Szczecin", lat: 53.4285, lon: 14.5528 },
  { nazwa: "Bydgoszcz", lat: 53.1235, lon: 18.0084 },
  { nazwa: "Lublin", lat: 51.2465, lon: 22.5684 },
  { nazwa: "Katowice", lat: 50.2649, lon: 19.0238 },
  { nazwa: "Białystok", lat: 53.1325, lon: 23.1688 },
  { nazwa: "Rzeszów", lat: 50.0413, lon: 21.999 },
  { nazwa: "Olsztyn", lat: 53.7784, lon: 20.4801 },
  { nazwa: "Kielce", lat: 50.8661, lon: 20.6286 },
  { nazwa: "Toruń", lat: 53.0138, lon: 18.5984 },
  { nazwa: "Opole", lat: 50.6751, lon: 17.9213 },
  { nazwa: "Zielona Góra", lat: 51.9356, lon: 15.5062 },
  { nazwa: "Gorzów Wielkopolski", lat: 52.7368, lon: 15.2288 },
];

/** Najbliższa aglomeracja i odległość po linii prostej [km]. */
export function najblizszaAglomeracja(lat: number, lon: number): { nazwa: string; distKm: number } {
  let best = { nazwa: AGLOMERACJE[0].nazwa, distKm: Infinity };
  for (const a of AGLOMERACJE) {
    const d = haversineM(lat, lon, a.lat, a.lon) / 1000;
    if (d < best.distKm) best = { nazwa: a.nazwa, distKm: d };
  }
  return best;
}

/**
 * Szacowany czas dojazdu [min] z odległości drogowej. Mnożnik krętości drogi
 * (linia prosta → droga) + średnia prędkość. Zaokrąglony do 5 min.
 */
export function czasDojazdMin(distKm: number, sredniaPredkoscKmh: number, wspKretosci: number): number {
  const droga = distKm * wspKretosci;
  const min = (droga / sredniaPredkoscKmh) * 60;
  return Math.max(5, Math.round(min / 5) * 5);
}

const cfg = KONFIG_KONEKTORY.aglomeracja;

export const konektorAglomeracja: Konektor = {
  klucz: "AGLOMERACJA",
  zrodlo: "Bliskość aglomeracji (proxy geometryczne)",
  poziom: "P2",
  aktywny: cfg.aktywny,
  async pobierz(teren: Teren): Promise<WynikKonektora> {
    const czas = new Date().toISOString();
    if (!teren.centroid4326) return brakWyniku(this.klucz, this.zrodlo, czas, "Brak centroidu WGS84 (brak geometrii).");
    const [lon, lat] = teren.centroid4326;
    const { nazwa, distKm } = najblizszaAglomeracja(lat, lon);
    const minuty = czasDojazdMin(distKm, cfg.sredniaPredkoscKmh, cfg.wspKretosci);
    const dane: Partial<DaneDzialki> = { czasDojazdAglomeracjaMin: minuty };
    const meta: MetaPola[] = [
      { pole: "czasDojazdAglomeracjaMin", zrodlo: `${this.zrodlo} — ${nazwa} ~${Math.round(distKm)} km`, czas, pewnosc: 55, status: "ok", tryb: "A" },
    ];
    return { klucz: this.klucz, zrodlo: this.zrodlo, status: "ok", czas, dane, meta };
  },
};
