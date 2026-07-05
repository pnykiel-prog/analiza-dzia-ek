/** Testy warstwy otoczenia + modyfikatora jakości życia (łagodny bonus, nie bramka). */

import { test } from "node:test";
import assert from "node:assert/strict";
import { najblizszeOtoczenie, type ObiektOtoczenia } from "../data/otoczenie";
import { modyfikatorOtoczenia, sygnalyOtoczenia } from "../engine/kanalyM2";
import type { DaneDzialki } from "../types";
import { DZIALKI_PRZYKLADOWE } from "../data/sample";

const baza = DZIALKI_PRZYKLADOWE[0];

const dane: ObiektOtoczenia[] = [
  { id: "z1", kategoria: "zielen", nazwa: "Park", lat: 52.001, lon: 21.0, zrodlo: "OSM", data_importu: "" },
  { id: "p1", kategoria: "poczta", nazwa: "Poczta", lat: 52.05, lon: 21.0, zrodlo: "OSM", data_importu: "" },
];

test("najblizszeOtoczenie: najbliższy per kategoria w buforze", () => {
  const o = najblizszeOtoczenie(52.0, 21.0, 8000, dane);
  assert.ok(o.zielen != null && o.zielen > 100 && o.zielen < 130); // ~111 m
  assert.ok(o.poczta != null); // ~5,5 km, w buforze 8 km
  assert.equal(o.plac_zabaw, undefined); // brak w danych
});

test("najblizszeOtoczenie: poza buforem pomijane (luka, nie absurdalna odległość)", () => {
  const o = najblizszeOtoczenie(52.0, 21.0, 500, dane);
  assert.ok(o.zielen != null); // ~111 m w buforze
  assert.equal(o.poczta, undefined); // ~5,5 km poza buforem 500 m
});

test("modyfikatorOtoczenia: bliska zieleń/poczta daje ŁAGODNY bonus, brak = neutralny (1,0)", () => {
  const dobre = { ...baza, odleglosciM2: { zielen: 200, plac_zabaw: 300, poczta: 300, bank: 250 } } as DaneDzialki;
  const mM = modyfikatorOtoczenia(dobre, "mlodzi");
  const mS = modyfikatorOtoczenia(dobre, "seniorzy");
  assert.ok(mM.mnoznik > 1 && mM.mnoznik <= 1.06, `młodzi ${mM.mnoznik}`);
  assert.ok(mS.mnoznik > 1 && mS.mnoznik <= 1.06, `seniorzy ${mS.mnoznik}`);
  // Brak danych otoczenia → neutralny (nie kara).
  assert.equal(modyfikatorOtoczenia({ ...baza, odleglosciM2: {} } as DaneDzialki, "mlodzi").mnoznik, 1);
});

test("modyfikatorOtoczenia: plac zabaw liczy się dla młodych, nie dla seniorów (waga 0)", () => {
  const tylkoPlac = { ...baza, odleglosciM2: { plac_zabaw: 150 } } as DaneDzialki;
  assert.ok(modyfikatorOtoczenia(tylkoPlac, "mlodzi").mnoznik > 1); // młodzi: plac zabaw ma wagę
  assert.equal(modyfikatorOtoczenia(tylkoPlac, "seniorzy").mnoznik, 1); // seniorzy: waga 0 → neutralny
});

test("sygnalyOtoczenia: obiekty w zasięgu spaceru → pozytywne sygnały", () => {
  const s = sygnalyOtoczenia({ ...baza, odleglosciM2: { zielen: 300, poczta: 400, bank: 3000 } } as DaneDzialki);
  assert.ok(s.some((t) => /zielone|park/i.test(t)));
  assert.ok(s.some((t) => /poczta/i.test(t)));
  assert.ok(!s.some((t) => /bank/i.test(t))); // bank 3000 m > komfort → bez sygnału
});
