/** Testy prognozy potencjału zabudowy (port `potential.py`) — offline, deterministyczne. */

import { test } from "node:test";
import assert from "node:assert/strict";
import {
  efektywnoscKsztaltu,
  mnoznikSpadku,
  prognozaPotencjalu,
  sasiedztwoDeterministyczne,
} from "../potencjal";
import { KONFIG_POZIOM1 } from "../../config";

const CFG = KONFIG_POZIOM1.potencjal;

test("potencjał: efektywność kształtu — brak geometrii → wartość neutralna, bez flag", () => {
  const r = efektywnoscKsztaltu(null, null, CFG);
  assert.equal(r.eff, CFG.efektywnoscNeutralna);
  assert.equal(r.flagi.length, 0);
});

test("potencjał: efektywność kształtu — wąska działka obniża efektywność i flaguje", () => {
  const szeroka = efektywnoscKsztaltu(0.8, 40, CFG);
  const waska = efektywnoscKsztaltu(0.8, 10, CFG); // < 18 m
  assert.ok(waska.eff < szeroka.eff);
  assert.ok(waska.flagi.some((f) => f.includes("wąska")));
});

test("potencjał: mnożnik spadku — progi 3/8/12%", () => {
  assert.equal(mnoznikSpadku(1).mult, 1.0);
  assert.equal(mnoznikSpadku(5).mult, 0.9);
  assert.equal(mnoznikSpadku(10).mult, 0.7);
  assert.equal(mnoznikSpadku(20).mult, 0.5);
  assert.ok(mnoznikSpadku(20).flagi.length > 0);
});

test("potencjał: sąsiedztwo deterministyczne — powtarzalne dla tego samego seeda", () => {
  const a = sasiedztwoDeterministyczne("dzialka-1");
  const b = sasiedztwoDeterministyczne("dzialka-1");
  assert.deepEqual(a, b);
  const c = sasiedztwoDeterministyczne("dzialka-2");
  assert.notEqual(a.pokrycieUdzial + a.typoweKondygnacje, c.pokrycieUdzial + c.typoweKondygnacje);
});

test("potencjał: realny spadek (NMT) nadpisuje spadek deterministyczny", () => {
  const s = sasiedztwoDeterministyczne("dzialka-1", 9.5);
  assert.equal(s.spadekPct, 9.5);
});

test("potencjał: prognoza z powierzchni + kształtu daje dodatni PUM i mieszkania", () => {
  const nb = sasiedztwoDeterministyczne("test-3300", 2);
  const p = prognozaPotencjalu({
    powierzchniaM2: 3300,
    zwartosc: 0.78,
    minSzerokoscM: 55,
    sasiedztwo: nb,
    mpzp: "brak",
  });
  assert.ok(p.pumM2 > 0);
  assert.ok(p.powierzchniaZabudowyM2 > 0);
  assert.ok(p.mieszkania.mlodzi >= p.mieszkania.seniorzy); // mniejszy metraż → więcej mieszkań
  assert.equal(p.flagaMpzp, "brak");
  assert.ok(p.szacowanePokrycie <= CFG.gornyLimitPokrycia);
});

test("potencjał: MPZP obniża pewność o 15 pkt (adnotacja do potwierdzenia w planie)", () => {
  const nb = sasiedztwoDeterministyczne("test-mpzp", 2);
  const bezMpzp = prognozaPotencjalu({ powierzchniaM2: 3000, zwartosc: 0.8, minSzerokoscM: 50, sasiedztwo: nb, mpzp: "brak" });
  const zMpzp = prognozaPotencjalu({ powierzchniaM2: 3000, zwartosc: 0.8, minSzerokoscM: 50, sasiedztwo: nb, mpzp: "jest" });
  assert.equal(zMpzp.pewnosc, Math.max(0, bezMpzp.pewnosc - 15));
  assert.ok(zMpzp.flagi.some((f) => f.includes("MPZP")));
});

test("potencjał: pokrycie ograniczone górnym limitem", () => {
  const nb = { pokrycieUdzial: 0.9, typoweKondygnacje: 4, liczbaProbki: 10, wysokosciDostepne: true, spadekPct: 1, zrodlo: "deterministyczne" as const };
  const p = prognozaPotencjalu({ powierzchniaM2: 5000, zwartosc: 0.9, minSzerokoscM: 60, sasiedztwo: nb });
  assert.equal(p.szacowanePokrycie, CFG.gornyLimitPokrycia);
});
