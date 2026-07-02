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

/**
 * Kontur działki do rysowania na schematycznej mapie: pierwszy (największy) pierścień
 * WKT przeskalowany i wyśrodkowany w zadanym pudełku (układ SVG — oś Y w dół).
 * Zwraca ciąg „x,y x,y …" dla <polygon points>. Null, gdy brak geometrii.
 */
export function konturSvg(
  wkt: string,
  box: { cx: number; cy: number; w: number; h: number } = { cx: 250, cy: 215, w: 150, h: 150 }
): string | null {
  const wielokaty = parsujWielokaty(wkt);
  // wybierz pierścień o największym polu (główna działka, nie ewentualne fragmenty)
  let ring: Punkt[] | null = null;
  let najw = -1;
  for (const w of wielokaty) {
    const r = w[0];
    const p = poleP(r);
    if (p > najw) { najw = p; ring = r; }
  }
  if (!ring || ring.length < 3) return null;
  const xs = ring.map((p) => p[0]);
  const ys = ring.map((p) => p[1]);
  const minX = Math.min(...xs), maxX = Math.max(...xs);
  const minY = Math.min(...ys), maxY = Math.max(...ys);
  const gw = maxX - minX || 1, gh = maxY - minY || 1;
  const skala = Math.min(box.w / gw, box.h / gh);
  const offX = box.cx - (gw * skala) / 2;
  const offY = box.cy - (gh * skala) / 2;
  return ring
    .map((p) => {
      const x = offX + (p[0] - minX) * skala;
      const y = offY + (maxY - p[1]) * skala; // odbicie osi Y (geo ↑ vs SVG ↓)
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
}

/** Największy (o największym polu) pierścień zewnętrzny z WKT — główna działka. */
export function najwiekszyPierscien(wkt: string): Punkt[] | null {
  const wielokaty = parsujWielokaty(wkt);
  let ring: Punkt[] | null = null;
  let najw = -1;
  for (const w of wielokaty) {
    const p = poleP(w[0]);
    if (p > najw) { najw = p; ring = w[0]; }
  }
  return ring && ring.length >= 3 ? ring : null;
}

/**
 * Zwartość kształtu (wskaźnik Polsby-Popper): 4·π·A / P². 1 = koło (idealnie
 * zwarte), niżej = wydłużone/nieregularne. Podstawa oceny efektywności zabudowy
 * w prognozie potencjału. `null`, gdy brak wielokąta.
 */
export function zwartoscKsztaltu(wkt: string): number | null {
  const ring = najwiekszyPierscien(wkt);
  if (!ring) return null;
  const A = poleP(ring);
  let P = 0;
  for (let i = 0; i < ring.length - 1; i++) {
    P += Math.hypot(ring[i + 1][0] - ring[i][0], ring[i + 1][1] - ring[i][1]);
  }
  const first = ring[0], last = ring[ring.length - 1];
  if (first[0] !== last[0] || first[1] !== last[1]) {
    P += Math.hypot(first[0] - last[0], first[1] - last[1]); // domknij obwód
  }
  if (P <= 0) return null;
  return Math.max(0, Math.min(1, (4 * Math.PI * A) / (P * P)));
}

/** Otoczka wypukła (Andrew monotone chain), przeciwnie do ruchu wskazówek zegara. */
function otoczkaWypukla(pts: Punkt[]): Punkt[] {
  const p = pts.slice().sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  if (p.length < 3) return p;
  const cross = (o: Punkt, a: Punkt, b: Punkt) =>
    (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const dol: Punkt[] = [];
  for (const pt of p) {
    while (dol.length >= 2 && cross(dol[dol.length - 2], dol[dol.length - 1], pt) <= 0) dol.pop();
    dol.push(pt);
  }
  const gora: Punkt[] = [];
  for (let i = p.length - 1; i >= 0; i--) {
    const pt = p[i];
    while (gora.length >= 2 && cross(gora[gora.length - 2], gora[gora.length - 1], pt) <= 0) gora.pop();
    gora.push(pt);
  }
  dol.pop(); gora.pop();
  return dol.concat(gora);
}

/**
 * Szerokość działki = krótszy bok minimalnego (co do pola) prostokąta
 * otaczającego. Dla wydłużonych/obróconych działek dużo wierniejsza niż krótszy
 * bok obwiedni osiowej. Metoda: obrót względem każdej krawędzi otoczki wypukłej
 * (min-area rectangle spoczywa na krawędzi otoczki). `null`, gdy brak wielokąta.
 */
export function minSzerokoscKsztaltu(wkt: string): number | null {
  const ring = najwiekszyPierscien(wkt);
  if (!ring) return null;
  const hull = otoczkaWypukla(ring);
  if (hull.length < 3) return null;
  let najlepszePole = Infinity;
  let krotszyBok = Infinity;
  for (let i = 0; i < hull.length; i++) {
    const a = hull[i], b = hull[(i + 1) % hull.length];
    const dx = b[0] - a[0], dy = b[1] - a[1];
    const len = Math.hypot(dx, dy) || 1;
    const ux = dx / len, uy = dy / len; // kierunek krawędzi
    const px = -uy, py = ux; // prostopadły
    let minU = Infinity, maxU = -Infinity, minV = Infinity, maxV = -Infinity;
    for (const [x, y] of hull) {
      const u = x * ux + y * uy;
      const v = x * px + y * py;
      if (u < minU) minU = u; if (u > maxU) maxU = u;
      if (v < minV) minV = v; if (v > maxV) maxV = v;
    }
    const w = maxU - minU, h = maxV - minV;
    const pole = w * h;
    if (pole < najlepszePole) { najlepszePole = pole; krotszyBok = Math.min(w, h); }
  }
  return Number.isFinite(krotszyBok) ? Math.round(krotszyBok * 10) / 10 : null;
}

/**
 * Największy (główny) pierścień działki jako punkty WGS84 [lon, lat] — do
 * narysowania realnego wielokąta na mapie kaflowej (OSM). Współrzędne WKT są
 * w EPSG:2180, więc każdy wierzchołek reprojektujemy przez `pl1992ToWgs84`.
 * Zwraca `null`, gdy geometria nie zawiera wielokąta.
 */
export function konturGeo(wkt: string): [number, number][] | null {
  const ring = najwiekszyPierscien(wkt);
  if (!ring) return null;
  return ring.map((p) => pl1992ToWgs84(p[0], p[1]));
}

/**
 * Reprojekcja EPSG:2180 (PUWG1992 / CS92) → WGS84 [lon, lat].
 * Odwrotna transwersalna Merkatora (GRS80). Wejście: (easting, northing) — taka
 * jest kolejność współrzędnych w WKT z ULDK. Pozwala policzyć centroid WGS84 do
 * Overpass bez dodatkowego zapytania do ULDK.
 */
export function pl1992ToWgs84(easting: number, northing: number): [number, number] {
  const a = 6378137.0;
  const f = 1 / 298.257222101;
  const k0 = 0.9993;
  const lon0 = (19 * Math.PI) / 180;
  const FE = 500000;
  const FN = -5300000;

  const e2 = f * (2 - f);
  const ep2 = e2 / (1 - e2);
  const xp = easting - FE;
  const yp = northing - FN;
  const M = yp / k0;
  const mu = M / (a * (1 - e2 / 4 - (3 * e2 * e2) / 64 - (5 * e2 ** 3) / 256));
  const e1 = (1 - Math.sqrt(1 - e2)) / (1 + Math.sqrt(1 - e2));
  const phi1 =
    mu +
    ((3 * e1) / 2 - (27 * e1 ** 3) / 32) * Math.sin(2 * mu) +
    ((21 * e1 ** 2) / 16 - (55 * e1 ** 4) / 32) * Math.sin(4 * mu) +
    ((151 * e1 ** 3) / 96) * Math.sin(6 * mu) +
    ((1097 * e1 ** 4) / 512) * Math.sin(8 * mu);

  const sin1 = Math.sin(phi1);
  const cos1 = Math.cos(phi1);
  const tan1 = Math.tan(phi1);
  const C1 = ep2 * cos1 * cos1;
  const T1 = tan1 * tan1;
  const N1 = a / Math.sqrt(1 - e2 * sin1 * sin1);
  const R1 = (a * (1 - e2)) / Math.pow(1 - e2 * sin1 * sin1, 1.5);
  const D = xp / (N1 * k0);

  const lat =
    phi1 -
    ((N1 * tan1) / R1) *
      ((D * D) / 2 -
        ((5 + 3 * T1 + 10 * C1 - 4 * C1 * C1 - 9 * ep2) * D ** 4) / 24 +
        ((61 + 90 * T1 + 298 * C1 + 45 * T1 * T1 - 252 * ep2 - 3 * C1 * C1) * D ** 6) / 720);
  const lon =
    lon0 +
    (D -
      ((1 + 2 * T1 + C1) * D ** 3) / 6 +
      ((5 - 2 * C1 + 28 * T1 - 3 * C1 * C1 + 8 * ep2 + 24 * T1 * T1) * D ** 5) / 120) /
      cos1;

  return [(lon * 180) / Math.PI, (lat * 180) / Math.PI];
}

/** Centroid WGS84 [lon, lat] z geometrii WKT w EPSG:2180. */
export function centroid4326ZWkt(wkt2180: string): [number, number] | null {
  const c = centroid(wkt2180);
  if (!c) return null;
  return pl1992ToWgs84(c[0], c[1]);
}

/** Czy dwie obwiednie się stykają/zachodzą w granicach tolerancji [m] (proxy przylegania). */
export function bboxStykaja(a: BBox, b: BBox, tol = 2): boolean {
  return a.minX - tol <= b.maxX && b.minX - tol <= a.maxX && a.minY - tol <= b.maxY && b.minY - tol <= a.maxY;
}

/** Centroid (średnia wierzchołków pierścienia zewnętrznego) — do zapytań WMS GetFeatureInfo. */
export function centroid(wkt: string): Punkt | null {
  const ring = parsujWielokaty(wkt)[0]?.[0];
  if (!ring || ring.length === 0) return null;
  // Pomiń zdublowany wierzchołek zamykający pierścień.
  const pkt =
    ring.length > 1 && ring[0][0] === ring[ring.length - 1][0] && ring[0][1] === ring[ring.length - 1][1]
      ? ring.slice(0, -1)
      : ring;
  const sx = pkt.reduce((s, p) => s + p[0], 0);
  const sy = pkt.reduce((s, p) => s + p[1], 0);
  return [sx / pkt.length, sy / pkt.length];
}

function minOdlegloscWierzcholkow(a: Punkt[], b: Punkt[]): number {
  let min = Infinity;
  for (const [ax, ay] of a) {
    for (const [bx, by] of b) {
      const d = Math.hypot(ax - bx, ay - by);
      if (d < min) min = d;
    }
  }
  return min;
}

/**
 * Czy zbiór działek (WKT) tworzy jeden spójny, przylegający blok.
 * Przyleganie liczone NA GEOMETRII (wymóg wytycznych): dwie działki sąsiadują,
 * gdy ich obwiednie się stykają i mają wspólny (bliski) wierzchołek granicy.
 * Spójność całości sprawdzana grafowo (BFS po relacji sąsiedztwa).
 */
export function czyPrzylegaja(wktList: string[], tol = 1.5): boolean {
  if (wktList.length <= 1) return true;
  const ringi = wktList.map((w) => parsujWielokaty(w).flatMap((m) => m[0]));
  const boxy = wktList.map((w) => bbox(w));
  const n = wktList.length;
  const sasiedzi: number[][] = Array.from({ length: n }, () => []);
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      const bi = boxy[i], bj = boxy[j];
      const blisko = bi && bj && bboxStykaja(bi, bj, tol) && minOdlegloscWierzcholkow(ringi[i], ringi[j]) <= tol;
      if (blisko) {
        sasiedzi[i].push(j);
        sasiedzi[j].push(i);
      }
    }
  }
  // BFS spójności od węzła 0.
  const odwiedzone = new Set<number>([0]);
  const kolejka = [0];
  while (kolejka.length) {
    const v = kolejka.shift()!;
    for (const s of sasiedzi[v]) if (!odwiedzone.has(s)) {
      odwiedzone.add(s);
      kolejka.push(s);
    }
  }
  return odwiedzone.size === n;
}
