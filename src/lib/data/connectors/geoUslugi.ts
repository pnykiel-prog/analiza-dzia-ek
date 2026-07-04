/**
 * Wspólne prymitywy odległości usług (kanał A) — używane przez warstwę statyczną
 * (szkoły/przedszkola/POZ/apteki z rejestrów) i konektor OSM (przystanek/sklep).
 * Wydzielone, by uniknąć cykli importu. Funkcje czyste.
 */

export interface Kandydat {
  usluga: string;
  lat: number;
  lon: number;
  dLinia: number; // odległość po linii prostej [m] — do wyboru k-najbliższych i fallbacku
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

/** Redukcja: min odległość per usługa z dystansów trasy (fallback do linii, gdy null). */
export function minZDystansow(kand: Kandydat[], dystanse: (number | null)[]): Record<string, number> {
  const min: Record<string, number> = {};
  kand.forEach((c, i) => {
    const d = dystanse[i] ?? c.dLinia;
    if (min[c.usluga] == null || d < min[c.usluga]) min[c.usluga] = d;
  });
  const out: Record<string, number> = {};
  for (const [k, v] of Object.entries(min)) out[k] = Math.round(v / 10) * 10;
  return out;
}
