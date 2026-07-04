/** Testy funkcji czystych konektora odległości (klasyfikacja OSM, haversine, najbliższe). */

import { test } from "node:test";
import assert from "node:assert/strict";
import { klasyfikujUsluge, haversineM, zbierzOdleglosci, kNajblizsze, minZDystansow, type ElementGeo } from "../data/connectors/odleglosci";

test("klasyfikujUsluge: mapuje tagi OSM na klucze usług M2", () => {
  assert.equal(klasyfikujUsluge({ highway: "bus_stop" }), "przystanek");
  assert.equal(klasyfikujUsluge({ public_transport: "platform" }), "przystanek");
  assert.equal(klasyfikujUsluge({ railway: "tram_stop" }), "przystanek");
  assert.equal(klasyfikujUsluge({ amenity: "pharmacy" }), "apteka");
  assert.equal(klasyfikujUsluge({ amenity: "doctors" }), "poz");
  assert.equal(klasyfikujUsluge({ amenity: "school" }), "szkola");
  assert.equal(klasyfikujUsluge({ amenity: "kindergarten" }), "przedszkole");
  assert.equal(klasyfikujUsluge({ shop: "supermarket" }), "sklep");
  assert.equal(klasyfikujUsluge({ shop: "clothes" }), null); // sklep nie-spożywczy → nieistotny
  assert.equal(klasyfikujUsluge({ leisure: "park" }), null);
});

test("haversineM: ~1113 m na 0,01° szerokości", () => {
  const d = haversineM(52.0, 21.0, 52.01, 21.0);
  assert.ok(Math.abs(d - 1113) < 20, `d=${d}`);
});

test("zbierzOdleglosci: najbliższy obiekt każdego typu, zaokrąglony do 10 m", () => {
  const lat = 52.0, lon = 21.0;
  const els: ElementGeo[] = [
    { tags: { highway: "bus_stop" }, lat: 52.001, lon: 21.0 }, // ~111 m
    { tags: { highway: "bus_stop" }, lat: 52.005, lon: 21.0 }, // ~556 m (dalej — ignorowany)
    { tags: { amenity: "pharmacy" }, center: { lat: 52.0, lon: 21.003 } }, // ~205 m
    { tags: { shop: "convenience" }, lat: 52.002, lon: 21.0 }, // ~222 m
    { tags: { leisure: "park" }, lat: 52.0, lon: 21.0 }, // nieistotny
    { tags: { amenity: "school" } }, // brak współrzędnych → pomijany
  ];
  const o = zbierzOdleglosci(els, lat, lon);
  assert.ok(Math.abs(o.przystanek - 110) <= 10, `przystanek=${o.przystanek}`);
  assert.ok(o.apteka > 190 && o.apteka < 220, `apteka=${o.apteka}`);
  assert.ok(o.sklep > 210 && o.sklep < 240, `sklep=${o.sklep}`);
  assert.equal(o.szkola, undefined); // brak współrzędnych → nie zapisujemy
  assert.equal(o.przystanek % 10, 0); // zaokrąglenie do 10 m
});

test("kNajblizsze: k najbliższych POI każdego typu, posortowane po linii prostej", () => {
  const lat = 52.0, lon = 21.0;
  const els: ElementGeo[] = [
    { tags: { highway: "bus_stop" }, lat: 52.005, lon: 21.0 }, // dalej
    { tags: { highway: "bus_stop" }, lat: 52.001, lon: 21.0 }, // bliżej
    { tags: { highway: "bus_stop" }, lat: 52.003, lon: 21.0 }, // środek
    { tags: { amenity: "pharmacy" }, lat: 52.0, lon: 21.001 },
  ];
  const k = kNajblizsze(els, lat, lon, 2);
  const przyst = k.filter((c) => c.usluga === "przystanek");
  assert.equal(przyst.length, 2); // ograniczone do k
  assert.ok(przyst[0].dLinia < przyst[1].dLinia); // najbliższy pierwszy
  assert.ok(k.some((c) => c.usluga === "apteka"));
});

test("minZDystansow: min trasą per usługa, fallback do linii przy null", () => {
  const kand = [
    { usluga: "przystanek", lat: 0, lon: 0, dLinia: 200 },
    { usluga: "przystanek", lat: 0, lon: 0, dLinia: 300 },
    { usluga: "apteka", lat: 0, lon: 0, dLinia: 400 },
  ];
  // Trasa: przystanek#1 dłuższa niż linia (600), przystanek#2 null → linia 300; apteka 450.
  const o = minZDystansow(kand, [600, null, 450]);
  assert.equal(o.przystanek, 300); // min(600, fallback 300)
  assert.equal(o.apteka, 450);
});
