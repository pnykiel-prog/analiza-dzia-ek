/**
 * Parsowanie geometrii WKT (z ULDK) i wyliczenia: powierzchnia, bounding box,
 * front, proporcja boków. Współrzędne ULDK są w EPSG:2180 (metry), więc pole
 * z formuły Gaussa (shoelace) wychodzi bezpośrednio w m².
 *
 * Funkcje są czyste (bez sieci) — testowalne offline.
 */

export type Punkt = [number, number];

/** Usuwa prefiks `SRID=...;` i normalizuje typ geometrii. */
function oczyscWkt(wkt: string): string {
  return wkt.replace(/^\s*SRID=\d+\s*;\s*/i, "").trim();
}

/** Parsuje ciąg "x y, x y, ..." na listę punktów. */
function parsujPierscien(s: string): Punkt[] {
  return s
    .trim()
    .split(",")
    .map((para) => {
      const [x, y] = para.trim().split(/\s+/).map(Number);
      return [x, y] as Punkt;
    })
    .filter((p) => Number.isFinite(p[0]) && Number.isFinite(p[1]));
}

/**
 * Wyciąga pierścienie (ringi) z WKT POLYGON / MULTIPOLYGON.
 * Zwraca listę wielokątów; każdy wielokąt to lista pierścieni (pierwszy = zewnętrzny).
 */
export function parsujWielokaty(wkt: string): Punkt[][][] {
  const g = oczyscWkt(wkt);
  const pierscienie: Punkt[][] = [];
  const re = /\(([^()]+)\)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(g)) !== null) {
    const pkt = parsujPierscien(m[1]);
    if (pkt.length >= 3) pierscienie.push(pkt);
  }
  // Dla uproszczenia traktujemy każdy znaleziony pierścień jako osobny wielokąt
  // zewnętrzny (dziury są rzadkie w działkach katastralnych i pomijalne w szacunku).
  return pierscienie.map((p) => [p]);
}

/** Pole pojedynczego pierścienia (shoelace), wartość bezwzględna. */
export function poleP(ring: Punkt[]): number {
  let s = 0;
  for (let i = 0; i < ring.length; i++) {
    const [x1, y1] = ring[i];
    const [x2, y2] = ring[(i + 1) % ring.length];
    s += x1 * y2 - x2 * y1;
  }
  return Math.abs(s) / 2;
}

/** Powierzchnia [m²] z WKT (suma wielokątów). */
export function powierzchniaZWkt(wkt: string): number {
  const wiel = parsujWielokaty(wkt);
  return wiel.reduce((suma, w) => suma + poleP(w[0]), 0);
}

export interface BBox {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
  szerokosc: number;
  wysokosc: number;
}

export function bbox(wkt: string): BBox | null {
  const pkt = parsujWielokaty(wkt).flatMap((w) => w[0]);
  if (pkt.length === 0) return null;
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const [x, y] of pkt) {
    if (x < minX) minX = x;
    if (y < minY) minY = y;
    if (x > maxX) maxX = x;
    if (y > maxY) maxY = y;
  }
  return { minX, minY, maxX, maxY, szerokosc: maxX - minX, wysokosc: maxY - minY };
}

export interface MetryGeometrii {
  powierzchniaM2: number;
  frontM: number | null; // krótszy bok obwiedni (proxy frontu)
  proporcjaBokow: number | null; // dłuższy / krótszy bok obwiedni
}

/** Metryki działki z WKT: powierzchnia + przybliżony front i proporcja z bbox. */
export function metrykiZWkt(wkt: string): MetryGeometrii {
  const powierzchniaM2 = Math.round(powierzchniaZWkt(wkt));
  const b = bbox(wkt);
  if (!b || b.szerokosc <= 0 || b.wysokosc <= 0) {
    return { powierzchniaM2, frontM: null, proporcjaBokow: null };
  }
  const krotszy = Math.min(b.szerokosc, b.wysokosc);
  const dluzszy = Math.max(b.szerokosc, b.wysokosc);
  return {
    powierzchniaM2,
    frontM: Math.round(krotszy),
    proporcjaBokow: Math.round((dluzszy / krotszy) * 10) / 10,
  };
}

/** Czy dwie obwiednie się stykają/zachodzą w granicach tolerancji [m] (proxy przylegania). */
export function bboxStykaja(a: BBox, b: BBox, tol = 2): boolean {
  return a.minX - tol <= b.maxX && b.minX - tol <= a.maxX && a.minY - tol <= b.maxY && b.minY - tol <= a.maxY;
}
