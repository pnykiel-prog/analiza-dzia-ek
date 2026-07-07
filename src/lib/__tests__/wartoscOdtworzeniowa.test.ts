/** Testy warstwy wartości odtworzeniowej: miasto wydzielone vs reszta, benchmark fallback. */

import { test } from "node:test";
import assert from "node:assert/strict";
import { stawkaWO, przeterminowana } from "../data/wartoscOdtworzeniowa";

test("stawkaWO: miasto wydzielone bierze swoją stawkę (Rzeszów 8935 na 1.04–30.09.2026)", () => {
  const s = stawkaWO("podkarpackie", "Rzeszów");
  assert.equal(s.wartosc, 8935);
  assert.equal(s.typ, "miasto_wydzielone");
  assert.equal(s.benchmark, false);
  assert.ok(s.okresOd && s.obwieszczenie);
});

test("stawkaWO: gmina spoza miasta wydzielonego → reszta województwa (podkarpackie 7170)", () => {
  const s = stawkaWO("podkarpackie", "Trzebownisko");
  assert.equal(s.wartosc, 7170);
  assert.equal(s.typ, "wojewodztwo_reszta");
});

test("stawkaWO: województwo z dwoma miastami — każde ma swoją stawkę (Bydgoszcz/Toruń)", () => {
  assert.equal(stawkaWO("kujawsko-pomorskie", "Bydgoszcz").wartosc, 7759);
  assert.equal(stawkaWO("kujawsko-pomorskie", "Toruń").wartosc, 7774);
  assert.equal(stawkaWO("kujawsko-pomorskie", "Inowrocław").wartosc, 6685); // reszta
});

test("stawkaWO: województwo bez wpisu obwieszczeniowego (lubelskie do weryfikacji) → benchmark", () => {
  const s = stawkaWO("lubelskie", "Lublin");
  assert.equal(s.benchmark, true);
  assert.equal(s.typ, "benchmark");
  assert.ok(s.wartosc > 0);
});

test("przeterminowana: okres_do < dziś → true", () => {
  assert.equal(przeterminowana("2025-09-30", "2026-07-07"), true);
  assert.equal(przeterminowana("2026-09-30", "2026-07-07"), false);
  assert.equal(przeterminowana(null, "2026-07-07"), false);
});
