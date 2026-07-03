/** Testy offline: parsowanie WKT/geometrii i odpowiedzi ULDK (bez sieci). */

import { test } from "node:test";
import assert from "node:assert/strict";
import { powierzchniaZWkt, metrykiZWkt, bbox, bboxStykaja, pl1992ToWgs84, wgs84ToPl1992, konturSvg, konturGeo, zwartoscKsztaltu, minSzerokoscKsztaltu } from "../../geo";
import { parsujOdpowiedzUldk } from "../../data/uldk";

test("geo: powierzchnia prostokąta 100×50 = 5000 m²", () => {
  const wkt = "POLYGON((0 0,100 0,100 50,0 50,0 0))";
  assert.equal(powierzchniaZWkt(wkt), 5000);
});

test("geo: kontur SVG — skaluje/centruje i odbija oś Y", () => {
  // Kwadrat 100×100 w pudełku 100×100 wyśrodkowanym na (250,215).
  const pts = konturSvg("POLYGON((0 0,100 0,100 100,0 100,0 0))", { cx: 250, cy: 215, w: 100, h: 100 });
  assert.ok(pts);
  const wsp = pts!.split(" ").map((p) => p.split(",").map(Number));
  const xs = wsp.map((c) => c[0]);
  const ys = wsp.map((c) => c[1]);
  // Wyśrodkowane: X w [200,300], Y w [165,265].
  assert.ok(Math.min(...xs) >= 199.9 && Math.max(...xs) <= 300.1);
  assert.ok(Math.min(...ys) >= 164.9 && Math.max(...ys) <= 265.1);
  assert.equal(konturSvg("POINT(1 2)"), null); // brak wielokąta → null
});

test("geo: kontur WGS84 — reprojekcja pierścienia do [lon,lat] w granicach Polski", () => {
  // Kwadrat 100 m w EPSG:2180 w okolicy Rzeszowa.
  const g = konturGeo("POLYGON((640000 244000,640100 244000,640100 244100,640000 244100,640000 244000))");
  assert.ok(g);
  assert.equal(g!.length, 5); // 4 wierzchołki + domknięcie
  for (const [lon, lat] of g!) {
    assert.ok(lon > 14 && lon < 25, `lon poza Polską: ${lon}`);
    assert.ok(lat > 49 && lat < 55, `lat poza Polską: ${lat}`);
  }
  assert.equal(konturGeo("POINT(1 2)"), null);
});

test("geo: zwartość kształtu (Polsby-Popper) — kwadrat ≈ π/4, wąski pas dużo niżej", () => {
  const kwadrat = zwartoscKsztaltu("POLYGON((0 0,100 0,100 100,0 100,0 0))");
  assert.ok(kwadrat !== null && Math.abs(kwadrat! - Math.PI / 4) < 0.02, `kwadrat: ${kwadrat}`);
  const pas = zwartoscKsztaltu("POLYGON((0 0,200 0,200 10,0 10,0 0))");
  assert.ok(pas !== null && pas! < kwadrat!, `pas ${pas} powinien być mniej zwarty niż kwadrat ${kwadrat}`);
  assert.equal(zwartoscKsztaltu("POINT(1 2)"), null);
});

test("geo: min. szerokość — obrócony prostokąt 100×20 daje krótszy bok ≈ 20 m", () => {
  // Prostokąt 100×20 obrócony o 45° — obwiednia osiowa myli, min-rect nie.
  const c = Math.SQRT1_2; // cos45=sin45
  const pts = [
    [0, 0],
    [100 * c, 100 * c],
    [100 * c - 20 * c, 100 * c + 20 * c],
    [-20 * c, 20 * c],
  ];
  const wkt = `POLYGON((${pts.map((p) => `${p[0]} ${p[1]}`).join(",")},${pts[0][0]} ${pts[0][1]}))`;
  const w = minSzerokoscKsztaltu(wkt);
  assert.ok(w !== null && Math.abs(w! - 20) < 1.5, `min szerokość: ${w}`);
  assert.equal(minSzerokoscKsztaltu("POINT(1 2)"), null);
});

test("geo: front i proporcja z bbox", () => {
  const m = metrykiZWkt("POLYGON((0 0,100 0,100 50,0 50,0 0))");
  assert.equal(m.powierzchniaM2, 5000);
  assert.equal(m.frontM, 50); // krótszy bok
  assert.equal(m.proporcjaBokow, 2);
});

test("geo: obsługa prefiksu SRID i współrzędnych EPSG:2180", () => {
  const wkt = "SRID=2180;POLYGON((500000 600000,500100 600000,500100 600040,500000 600040,500000 600000))";
  assert.equal(powierzchniaZWkt(wkt), 4000);
});

test("geo: MULTIPOLYGON sumuje pola", () => {
  const wkt = "MULTIPOLYGON(((0 0,10 0,10 10,0 10,0 0)),((0 0,20 0,20 10,0 10,0 0)))";
  assert.equal(powierzchniaZWkt(wkt), 100 + 200);
});

test("geo: bboxStykaja wykrywa przyleganie i rozłączność", () => {
  const a = bbox("POLYGON((0 0,100 0,100 100,0 100,0 0))")!;
  const stykajacy = bbox("POLYGON((100 0,200 0,200 100,100 100,100 0))")!;
  const odlegly = bbox("POLYGON((500 500,600 500,600 600,500 600,500 500))")!;
  assert.equal(bboxStykaja(a, stykajacy), true);
  assert.equal(bboxStykaja(a, odlegly), false);
});

test("geo: reprojekcja PUWG1992 → WGS84 (okolice Głuchołazów)", () => {
  const [lon, lat] = pl1992ToWgs84(386924, 269276);
  assert.ok(lon > 16.5 && lon < 18.5, `lon poza zakresem: ${lon}`);
  assert.ok(lat > 49.5 && lat < 51.0, `lat poza zakresem: ${lat}`);
});

test("geo: WGS84 ↔ EPSG:2180 — odwracalność (Rzeszów, Warszawa)", () => {
  for (const [lon, lat] of [[21.999, 50.041], [21.012, 52.230]] as [number, number][]) {
    const [x, y] = wgs84ToPl1992(lon, lat);
    // Sensowny zakres 2180 dla Polski.
    assert.ok(x > 150000 && x < 900000, `easting poza zakresem: ${x}`);
    assert.ok(y > 100000 && y < 800000, `northing poza zakresem: ${y}`);
    const [lon2, lat2] = pl1992ToWgs84(x, y);
    assert.ok(Math.abs(lon2 - lon) < 1e-5 && Math.abs(lat2 - lat) < 1e-5, `roundtrip: ${lon2},${lat2}`);
  }
});

test("uldk: parsowanie odpowiedzi OK (status 0 + wiersze)", () => {
  const text = "0\nPOLYGON((0 0,1 0,1 1,0 1,0 0))|mazowieckie|piaseczyński|Lesznowola|0012";
  const p = parsujOdpowiedzUldk(text);
  assert.equal(p.ok, true);
  assert.equal(p.wiersze.length, 1);
  assert.equal(p.wiersze[0][1], "mazowieckie");
});

test("uldk: parsowanie odpowiedzi błędnej (status ≠ 0)", () => {
  const p = parsujOdpowiedzUldk("-1\nObiekt nie istnieje");
  assert.equal(p.ok, false);
});

test("uldk: słownik teryt|nazwa", () => {
  const p = parsujOdpowiedzUldk("0\n14|mazowieckie\n30|wielkopolskie");
  assert.equal(p.ok, true);
  assert.equal(p.wiersze.length, 2);
  assert.deepEqual(p.wiersze[1], ["30", "wielkopolskie"]);
});
