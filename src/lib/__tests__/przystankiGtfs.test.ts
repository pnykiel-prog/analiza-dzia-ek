/** Testy statycznej warstwy GTFS — kontekst transportowy (wytyczne transport §3). */

import { test } from "node:test";
import assert from "node:assert/strict";
import { kontekstGtfs, PRZYSTANKI_GTFS, type PrzystanekGtfs } from "../data/przystankiGtfs";

const dane: PrzystanekGtfs[] = [
  { nazwa: "Żywy blisko", lat: 52.0, lon: 21.0, kursyDobe: 200, feed: "T" }, // miasto
  { nazwa: "Martwa linia", lat: 50.0, lon: 20.0, kursyDobe: 3, feed: "T" }, // wieś (poniżej progu)
];

test("kontekstGtfs: żywy przystanek w promieniu → z_komunikacja", () => {
  const w = kontekstGtfs(52.001, 21.0, dane); // ~110 m od żywego
  assert.equal(w.kontekst, "z_komunikacja");
  assert.equal(w.przystanekKursyDobe, 200);
});

test("kontekstGtfs: tylko martwa linia w pobliżu → bez_komunikacji (nie miasto)", () => {
  const w = kontekstGtfs(50.001, 20.0, dane); // blisko martwej linii (3 kursy < próg 10)
  assert.equal(w.kontekst, "bez_komunikacji");
});

test("kontekstGtfs: brak przystanku w zasięgu pokrycia → kontekst nieznany (null, bez flagi)", () => {
  const w = kontekstGtfs(54.5, 18.5, dane); // Trójmiasto — daleko od obu (>8 km)
  assert.equal(w.kontekst, null);
});

test("kontekstGtfs: żywy przystanek daleko (poza R) ale w pokryciu → bez_komunikacji", () => {
  // 52.0,21.0 żywy; punkt ~3 km dalej: poza RgtfsM (1500 m), w zasiegPokryciaM (8000 m).
  const w = kontekstGtfs(52.027, 21.0, dane);
  assert.equal(w.kontekst, "bez_komunikacji");
});

test("seed gtfs_przystanki.json: rekordy mają współrzędne i kursyDobe", () => {
  assert.ok(PRZYSTANKI_GTFS.length > 0);
  for (const p of PRZYSTANKI_GTFS) {
    assert.equal(typeof p.lat, "number");
    assert.equal(typeof p.lon, "number");
    assert.equal(typeof p.kursyDobe, "number");
  }
});
