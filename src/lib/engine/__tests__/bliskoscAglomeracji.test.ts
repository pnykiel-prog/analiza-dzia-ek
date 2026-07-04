/** Testy modelu bliskości aglomeracji (pierścienie klas A–D → sygnał → modyfikator C). */

import { test } from "node:test";
import assert from "node:assert/strict";
import { silaMiasta, modyfikatorZSygnalu, bliskoscAglomeracji, type Miasto } from "../bliskoscAglomeracji";

test("silaMiasta: przykład §4 — Kraków (A) 25 km → siła 87,5, pierścień 1", () => {
  assert.deepEqual(silaMiasta("A", 25), { sila: 87.5, pierscien: 1 });
});

test("silaMiasta: rdzeń (≤ rdzeń) → pełna siła, pierścień 0; poza zasięgiem → 0", () => {
  assert.deepEqual(silaMiasta("A", 10), { sila: 100, pierscien: 0 });
  assert.deepEqual(silaMiasta("A", 70), { sila: 0, pierscien: -1 });
  assert.deepEqual(silaMiasta("D", 8), { sila: 8.3, pierscien: 1 }); // Wieliczka z §4
});

test("silaMiasta: 10 km od klasy A mocniejsze niż 10 km od klasy D (§120)", () => {
  assert.ok(silaMiasta("A", 10).sila > silaMiasta("D", 10).sila);
});

test("modyfikatorZSygnalu: 50 neutralny; skrajne wg amplitud; młodzi mocniej", () => {
  assert.deepEqual(modyfikatorZSygnalu(50), { mlodzi: 1, seniorzy: 1 });
  assert.deepEqual(modyfikatorZSygnalu(0), { mlodzi: 0.8, seniorzy: 0.925 });
  assert.deepEqual(modyfikatorZSygnalu(100), { mlodzi: 1.2, seniorzy: 1.075 });
  const m = modyfikatorZSygnalu(88.3);
  assert.ok(Math.abs(m.mlodzi - 1.153) < 0.002 && Math.abs(m.seniorzy - 1.057) < 0.002);
  // Młodzi zawsze reagują mocniej niż seniorzy (poza neutralnym 50).
  assert.ok(m.mlodzi > m.seniorzy);
});

test("bliskoscAglomeracji: sygnał = główny + 0,1×drugi; lista posortowana malejąco siłą", () => {
  const p = { lat: 50.0, lon: 20.0 };
  // Miasto A dokładnie w punkcie (dist 0 → siła 100), drugie A w punkcie (bonus), D poza zasięgiem.
  const miasta: Miasto[] = [
    { nazwa: "Rdzeń", lat: 50.0, lon: 20.0, klasa: "A" },
    { nazwa: "Drugi", lat: 50.0, lon: 20.0, klasa: "A" },
    { nazwa: "Daleki", lat: 55.0, lon: 15.0, klasa: "D" },
  ];
  const ba = bliskoscAglomeracji(p.lat, p.lon, undefined, miasta);
  assert.equal(ba.miastaWPoblizu[0].sila, 100);
  assert.equal(ba.sygnal, 100); // clamp(100 + 0,1×100)
  assert.equal(ba.modyfikator.mlodzi, 1.2);
  assert.ok(!ba.miastaWPoblizu.some((m) => m.nazwa === "Daleki")); // poza zasięgiem → nie na liście
});

test("bliskoscAglomeracji: peryferia (brak ośrodków w zasięgu) → sygnał 0, modyfikator tłumiący", () => {
  const miasta: Miasto[] = [{ nazwa: "Odległe", lat: 54.0, lon: 23.0, klasa: "B" }];
  const ba = bliskoscAglomeracji(50.0, 15.0, undefined, miasta);
  assert.equal(ba.sygnal, 0);
  assert.equal(ba.miastaWPoblizu.length, 0);
  assert.equal(ba.modyfikator.mlodzi, 0.8);
});
