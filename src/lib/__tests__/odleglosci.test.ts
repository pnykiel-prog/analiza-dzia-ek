/** Testy funkcji czystych konektora odległości (klasyfikacja OSM, haversine, najbliższe). */

import { test } from "node:test";
import assert from "node:assert/strict";
import { klasyfikujUsluge, haversineM, zbierzOdleglosci, type ElementGeo } from "../data/connectors/odleglosci";

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
