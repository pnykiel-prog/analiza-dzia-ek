/** Testy funkcji czystych konektorów spadku (B) i dojazdu do aglomeracji (C). */

import { test } from "node:test";
import assert from "node:assert/strict";
import { punktyProbek, spadekPct } from "../data/connectors/spadek";
import { najblizszaAglomeracja, czasDojazdMin } from "../data/connectors/aglomeracja";

test("punktyProbek: centroid + 4 punkty w zadanej odległości", () => {
  const p = punktyProbek(52.0, 21.0, 40);
  assert.equal(p.length, 5);
  assert.deepEqual(p[0], [52.0, 21.0]); // pierwszy = centroid
  // przesunięcie N/S ~ 40 m → ~0,00036°
  assert.ok(Math.abs(p[1][0] - 52.0 - 40 / 111320) < 1e-9);
  assert.ok(p[3][1] > 21.0 && p[4][1] < 21.0); // E/W
});

test("spadekPct: maks. nachylenie boków względem centroidu", () => {
  // centroid 100 m, bok +2 m na 40 m → 5%.
  assert.equal(spadekPct([100, 102, 100, 100, 100], 40), 5);
  // płasko → 0%.
  assert.equal(spadekPct([100, 100, 100, 100, 100], 40), 0);
  // niekompletne dane → null (nie dyskwalifikuje).
  assert.equal(spadekPct([100, NaN, 100], 40), null);
});

test("najblizszaAglomeracja: wybiera najbliższy ośrodek", () => {
  const a = najblizszaAglomeracja(52.15, 21.0); // pod Warszawą
  assert.equal(a.nazwa, "Warszawa");
  assert.ok(a.distKm < 20, `dist=${a.distKm}`);
  const b = najblizszaAglomeracja(50.05, 19.95); // Kraków
  assert.equal(b.nazwa, "Kraków");
});

test("czasDojazdMin: rośnie z odległością, min 5 min, zaokr. do 5", () => {
  const blisko = czasDojazdMin(10, 65, 1.3);
  const daleko = czasDojazdMin(80, 65, 1.3);
  assert.ok(daleko > blisko);
  assert.equal(daleko % 5, 0);
  assert.ok(czasDojazdMin(1, 65, 1.3) >= 5); // dolny limit
});
