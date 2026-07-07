/** Testy warstwy aptek (OSM): k-najbliższych, bufor zasięgu. */

import { test } from "node:test";
import assert from "node:assert/strict";
import { kandydaciApteka, APTEKI, type AptekaStala } from "../data/apteki";

test("APTEKI: seed ma współrzędne i kategorię apteka", () => {
  assert.ok(APTEKI.length > 0);
  for (const a of APTEKI) {
    assert.equal(a.kategoria, "apteka");
    assert.equal(typeof a.lat, "number");
    assert.equal(typeof a.lon, "number");
  }
});

test("kandydaciApteka: k-najbliższych posortowane po linii prostej", () => {
  const dane: AptekaStala[] = [
    { id: "a1", kategoria: "apteka", nazwa: "Bliska", adres: "", lat: 52.001, lon: 21.0, zrodlo: "OSM", data_importu: "" },
    { id: "a2", kategoria: "apteka", nazwa: "Dalsza", adres: "", lat: 52.004, lon: 21.0, zrodlo: "OSM", data_importu: "" },
    { id: "a3", kategoria: "apteka", nazwa: "Najbliższa", adres: "", lat: 52.0005, lon: 21.0, zrodlo: "OSM", data_importu: "" },
  ];
  const k = kandydaciApteka(52.0, 21.0, 2, dane);
  assert.equal(k.length, 2);
  assert.ok(k[0].dLinia < k[1].dLinia);
  assert.ok(k.every((c) => c.usluga === "apteka"));
});

test("kandydaciApteka: punkt poza buforem POMIJANY (luka, nie absurdalna odległość)", () => {
  const dane: AptekaStala[] = [
    { id: "a1", kategoria: "apteka", nazwa: "Daleka 250 km", adres: "", lat: 50.0, lon: 19.0, zrodlo: "OSM", data_importu: "" },
  ];
  const k = kandydaciApteka(52.0, 21.0, 3, dane, 8500);
  assert.equal(k.length, 0); // ~250 km — poza buforem
});
