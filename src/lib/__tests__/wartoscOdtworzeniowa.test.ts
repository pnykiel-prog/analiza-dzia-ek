/** Testy warstwy wartości odtworzeniowej: miasto wydzielone vs reszta, benchmark fallback. */

import { test } from "node:test";
import assert from "node:assert/strict";
import { stawkaWO, przeterminowana } from "../data/wartoscOdtworzeniowa";

test("stawkaWO: miasto wydzielone bierze swoją stawkę (Rzeszów 7018, nie reszta)", () => {
  const s = stawkaWO("podkarpackie", "Rzeszów");
  assert.equal(s.wartosc, 7018);
  assert.equal(s.typ, "miasto_wydzielone");
  assert.equal(s.benchmark, false);
  assert.ok(s.okresOd && s.obwieszczenie);
});

test("stawkaWO: gmina spoza miasta wydzielonego → reszta województwa (4851)", () => {
  const s = stawkaWO("podkarpackie", "Trzebownisko");
  assert.equal(s.wartosc, 4851);
  assert.equal(s.typ, "wojewodztwo_reszta");
});

test("stawkaWO: województwo bez wpisu obwieszczeniowego → benchmark z config-rynek", () => {
  const s = stawkaWO("świętokrzyskie", "Kielce");
  assert.equal(s.benchmark, true);
  assert.equal(s.typ, "benchmark");
  assert.ok(s.wartosc > 0);
});

test("przeterminowana: okres_do < dziś → true", () => {
  assert.equal(przeterminowana("2025-09-30", "2026-07-07"), true);
  assert.equal(przeterminowana("2026-09-30", "2026-07-07"), false);
  assert.equal(przeterminowana(null, "2026-07-07"), false);
});
