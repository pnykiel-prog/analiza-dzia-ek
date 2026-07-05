/** Testy statycznej warstwy sklepów (kanał A): najbliższe, bufor „w zasięgu". */

import { test } from "node:test";
import assert from "node:assert/strict";
import { kandydaciSklep, SKLEPY, type SklepStaly } from "../data/sklepy";

const dane: SklepStaly[] = [
  { id: "s1", kategoria: "sklep", nazwa: "Dino", adres: "", lat: 52.001, lon: 21.0, teryt_gmina: "", siec: "Dino", zrodlo: "siec", data_importu: "" },
  { id: "s2", kategoria: "sklep", nazwa: "Biedronka", adres: "", lat: 52.02, lon: 21.0, teryt_gmina: "", siec: "Biedronka", zrodlo: "siec", data_importu: "" },
];

test("kandydaciSklep: k-najbliższych po linii prostej, posortowane", () => {
  const k = kandydaciSklep(52.0, 21.0, 2, dane);
  assert.equal(k.length, 2);
  assert.ok(k.every((c) => c.usluga === "sklep"));
  assert.ok(k[0].dLinia < k[1].dLinia); // najbliższy pierwszy (Dino ~111 m)
});

test("kandydaciSklep: punkt poza buforem POMIJANY (luka, nie absurdalna odległość)", () => {
  const k = kandydaciSklep(52.0, 21.0, 3, dane, 500); // bufor 500 m
  assert.equal(k.length, 1); // tylko Dino ~111 m; Biedronka ~2,2 km poza buforem
});

test("SKLEPY seed: rekordy mają współrzędne i kategorię sklep", () => {
  assert.ok(SKLEPY.length > 0);
  for (const s of SKLEPY) {
    assert.equal(s.kategoria, "sklep");
    assert.equal(typeof s.lat, "number");
    assert.equal(typeof s.lon, "number");
  }
});
