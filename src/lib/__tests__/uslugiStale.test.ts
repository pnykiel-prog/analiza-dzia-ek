/** Testy statycznej warstwy usług (kanał A): najbliższy per kategoria, k-limit. */

import { test } from "node:test";
import assert from "node:assert/strict";
import { kandydaciStale, KATEGORIE_STALE, USLUGI_STALE, type UslugaStala } from "../data/uslugiStale";

test("USLUGI_STALE: seed ma tylko kategorie stałe i współrzędne", () => {
  assert.ok(USLUGI_STALE.length > 0);
  for (const u of USLUGI_STALE) {
    assert.ok((KATEGORIE_STALE as readonly string[]).includes(u.kategoria));
    assert.equal(typeof u.lat, "number");
    assert.equal(typeof u.lon, "number");
  }
});

test("kandydaciStale: k-najbliższych per kategoria, posortowane po linii prostej", () => {
  const dane: UslugaStala[] = [
    { id: "s1", kategoria: "szkola", nazwa: "A", adres: "", lat: 52.005, lon: 21.0, teryt_gmina: "", zrodlo: "RSPO", data_importu: "" },
    { id: "s2", kategoria: "szkola", nazwa: "B", adres: "", lat: 52.001, lon: 21.0, teryt_gmina: "", zrodlo: "RSPO", data_importu: "" },
    { id: "s3", kategoria: "szkola", nazwa: "C", adres: "", lat: 52.003, lon: 21.0, teryt_gmina: "", zrodlo: "RSPO", data_importu: "" },
    { id: "p1", kategoria: "poz", nazwa: "POZ", adres: "", lat: 52.0, lon: 21.002, teryt_gmina: "", zrodlo: "RPWDL", data_importu: "" },
  ];
  const k = kandydaciStale(52.0, 21.0, 2, dane);
  const szk = k.filter((c) => c.usluga === "szkola");
  assert.equal(szk.length, 2); // k-limit
  assert.ok(szk[0].dLinia < szk[1].dLinia); // najbliższy pierwszy
  assert.ok(k.some((c) => c.usluga === "poz"));
  assert.ok(!k.some((c) => c.usluga === "przystanek")); // przystanek NIE ze statyki (OSM)
});

test("kandydaciStale: seed wokół Warszawy zwraca komplet kategorii rejestrowych", () => {
  const k = kandydaciStale(52.23, 21.01, 3);
  const kat = new Set(k.map((c) => c.usluga));
  for (const c of KATEGORIE_STALE) assert.ok(kat.has(c), `brak kategorii ${c}`);
});

test("kandydaciStale: punkt poza buforem POMIJANY (luka, nie absurdalna odległość)", () => {
  const dane: UslugaStala[] = [
    { id: "s1", kategoria: "szkola", nazwa: "Bliska", adres: "", lat: 52.001, lon: 21.0, teryt_gmina: "", zrodlo: "RSPO", data_importu: "" },
    { id: "p1", kategoria: "poz", nazwa: "Daleka 250 km", adres: "", lat: 50.0, lon: 19.0, teryt_gmina: "", zrodlo: "RPWDL", data_importu: "" },
  ];
  const k = kandydaciStale(52.0, 21.0, 3, dane, 8500); // bufor 8,5 km
  assert.ok(k.some((c) => c.usluga === "szkola")); // ~111 m — w zasięgu
  assert.ok(!k.some((c) => c.usluga === "poz")); // ~250 km — luka, pomijana (bez 236 km)
});
