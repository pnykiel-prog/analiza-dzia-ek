/** Testy domknięcia M2 (kanały A–F) — wejście realnie zmienia wyjście właściwym kanałem. */

import { test } from "node:test";
import assert from "node:assert/strict";
import { dostepnoscA, przydatnoscEkonomicznaB, modyfikatorPopytuC, ocenM2 } from "../kanalyM2";
import { uruchomPoziom1 } from "../poziom1";
import { DZIALKI_PRZYKLADOWE } from "../../data/sample";
import type { DaneDzialki } from "../../types";

const baza = DZIALKI_PRZYKLADOWE[0];
const p1 = uruchomPoziom1(baza);

test("kanał A: usługi w zasięgu → mnożnik ≈1, obsługiwalny", () => {
  const d = { ...baza, odleglosciM2: { poz: 300, apteka: 400, sklep: 200, przystanek: 300 } } as DaneDzialki;
  const a = dostepnoscA(d, "seniorzy");
  assert.equal(a.obsluzalny, true);
  assert.ok(a.mnoznik > 0.95, `mnożnik: ${a.mnoznik}`);
});

test("kanał A: usługa za progiem → dyskwalifikacja profilu (bramka)", () => {
  const a = dostepnoscA({ ...baza, odleglosciM2: { poz: 5000 } } as DaneDzialki, "seniorzy"); // 5 km > 2,5 km
  assert.equal(a.obsluzalny, false);
  assert.equal(a.mnoznik, 0);
});

test("kanał A: brak odległości → NIE dyskwalifikuje (unknown ≠ far)", () => {
  const a = dostepnoscA({ ...baza, odleglosciM2: null } as DaneDzialki, "seniorzy");
  assert.equal(a.obsluzalny, true);
  assert.equal(a.mnoznik, 1);
});

test("kanał B: daleka sieć + spadek → niższa przydatność ekonomiczna (skaluje, nie dyskwalifikuje)", () => {
  const blisko = przydatnoscEkonomicznaB({ ...baza, odlegloscDoSieciM: 30, sredniSpadekPct: 2 } as DaneDzialki);
  const daleko = przydatnoscEkonomicznaB({ ...baza, odlegloscDoSieciM: 1200, sredniSpadekPct: 15 } as DaneDzialki);
  assert.ok(daleko.wartosc < blisko.wartosc, `${daleko.wartosc} < ${blisko.wartosc}`);
  assert.ok(daleko.wartosc > 0); // nie zeruje
});

test("kanał C: daleki dojazd do aglomeracji tłumi popyt młodych silniej niż seniorów", () => {
  const d = { ...baza, czasDojazdAglomeracjaMin: 120 } as DaneDzialki;
  const cM = modyfikatorPopytuC(d, "mlodzi");
  const cS = modyfikatorPopytuC(d, "seniorzy");
  assert.ok(cM.mnoznik < cS.mnoznik, `młodzi ${cM.mnoznik} < seniorzy ${cS.mnoznik}`);
});

test("DOMKNIĘCIE: ekstremalna odległość usług ZMIENIA werdykt i rekomendację", () => {
  const blisko = { ...baza, odleglosciM2: { poz: 300, apteka: 300, sklep: 300, przystanek: 300, szkola: 300, przedszkole: 300 } } as DaneDzialki;
  const daleko = { ...baza, odleglosciM2: { poz: 9000, apteka: 9000, sklep: 9000, przystanek: 9000, szkola: 9000, przedszkole: 9000 } } as DaneDzialki;
  const oB = ocenM2(blisko, p1, "pass");
  const oD = ocenM2(daleko, p1, "pass");
  assert.notEqual(oB.rekomendacja, "brak");
  assert.equal(oD.rekomendacja, "brak"); // oba profile poza zasięgiem → BRAK
  assert.ok(oB.werdykty.seniorzy.score > oD.werdykty.seniorzy.score); // wejście realnie rusza wynik
});

test("DOMKNIĘCIE: bramka E (fail) → oba profile niedopuszczalne, rekomendacja brak", () => {
  const o = ocenM2({ ...baza, odleglosciM2: { poz: 300 } } as DaneDzialki, p1, "fail");
  assert.equal(o.rekomendacja, "brak");
  assert.equal(o.werdykty.mlodzi.dopuszczalny, false);
  assert.equal(o.werdykty.seniorzy.dopuszczalny, false);
});
