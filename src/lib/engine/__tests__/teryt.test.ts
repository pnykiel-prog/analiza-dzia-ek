/** Testy offline: odwrotny indeks TERYT (kod/identyfikator → jednostka). */

import { test } from "node:test";
import assert from "node:assert/strict";
import { odwrotnyTeryt } from "../../teryt";

test("teryt: pełny identyfikator działki → województwo/powiat/gmina", () => {
  const r = odwrotnyTeryt("186301_1.0001.100/1"); // Rzeszów (miasto)
  assert.ok(r);
  assert.equal(r!.wojewodztwo, "podkarpackie");
  assert.equal(r!.gmina, "Rzeszów");
});

test("teryt: sam kod gminy (z sufiksem ULDK i bez) rozpoznawany", () => {
  const zSufiksem = odwrotnyTeryt("186301_1");
  const bezSufiksu = odwrotnyTeryt("186301");
  assert.ok(zSufiksem);
  assert.ok(bezSufiksu);
  assert.equal(zSufiksem!.wojewodztwo, "podkarpackie");
  assert.equal(bezSufiksu!.gmina, "Rzeszów");
});

test("teryt: nazwa gminy bez etykiety rodzaju (miasto/obszar wiejski)", () => {
  const r = odwrotnyTeryt("186301_1");
  assert.ok(r);
  assert.ok(!/\(/.test(r!.gmina), `nazwa nie powinna zawierać etykiety: ${r!.gmina}`);
});

test("teryt: nieznany kod → null (nie rzuca)", () => {
  assert.equal(odwrotnyTeryt("999999_9.0001.1"), null);
});
