/** Testy silnika przecięcia poligonów (bramka E) + reader warstw środowiskowych — offline. */

import { test } from "node:test";
import assert from "node:assert/strict";
import { punktWPierscieniu, punktWGeometrii } from "../geo";
import { strefySrodowiskowe, warstwaZaladowana } from "../data/srodowisko";

// Kwadrat [0,0]–[10,10] jako pierścień [lon,lat].
const KWADRAT: [number, number][] = [
  [0, 0],
  [10, 0],
  [10, 10],
  [0, 10],
  [0, 0],
];

test("punktWPierscieniu: wewnątrz true, na zewnątrz false", () => {
  assert.equal(punktWPierscieniu(5, 5, KWADRAT), true);
  assert.equal(punktWPierscieniu(15, 5, KWADRAT), false);
  assert.equal(punktWPierscieniu(-1, -1, KWADRAT), false);
});

test("punktWGeometrii: Polygon z dziurą — punkt w dziurze = poza geometrią", () => {
  const dziura: number[][] = [
    [4, 4],
    [6, 4],
    [6, 6],
    [4, 6],
    [4, 4],
  ];
  const poly = [KWADRAT as unknown as number[][], dziura]; // [zewnętrzny, dziura]
  assert.equal(punktWGeometrii(1, 1, "Polygon", poly), true); // w środku, poza dziurą
  assert.equal(punktWGeometrii(5, 5, "Polygon", poly), false); // w dziurze
});

test("punktWGeometrii: MultiPolygon — trafienie w którykolwiek poligon", () => {
  const drugi: number[][][] = [
    [
      [20, 20],
      [30, 20],
      [30, 30],
      [20, 30],
      [20, 20],
    ],
  ];
  const multi = [[KWADRAT as unknown as number[][]], drugi];
  assert.equal(punktWGeometrii(25, 25, "MultiPolygon", multi), true);
  assert.equal(punktWGeometrii(5, 5, "MultiPolygon", multi), true);
  assert.equal(punktWGeometrii(15, 15, "MultiPolygon", multi), false);
});

test("strefySrodowiskowe: seed pusty → brak trafień, warstwy niezaładowane (→ do weryfikacji)", () => {
  const w = strefySrodowiskowe(21.0, 52.0);
  assert.equal(w.powodz, null);
  assert.equal(w.natura2000, false);
  assert.equal(w.osuwisko, false);
  assert.equal(warstwaZaladowana("powodz_q1"), false);
  assert.equal(warstwaZaladowana("ochrona_przyrody"), false);
});
