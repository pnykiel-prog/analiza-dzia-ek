/** Testy kaskady źródeł wskaźników (auto > ręczne potwierdzone > prognoza; legalne > fizyczne). */

import { test } from "node:test";
import assert from "node:assert/strict";
import { kaskadaWskaznikow } from "../kaskadaWskaznikow";
import type { DaneDzialki } from "../../types";

const D = (p: Partial<DaneDzialki>) => p as DaneDzialki;

test("kaskada: brak źródeł → wszystko prognoza (najniższa pewność)", () => {
  const r = kaskadaWskaznikow(D({}));
  assert.equal(r.kZabPct.zrodlo, "prognoza");
  assert.equal(r.far.zrodlo, "prognoza");
  assert.equal(r.kondygnacje.zrodlo, "prognoza");
  assert.equal(r.pbcPct.zrodlo, "prognoza");
  assert.equal(r.pewnosc, 45);
});

test("kaskada: KIMPZP (mpzpMeta) → auto; kondygnacje z wysokości legalnej", () => {
  const r = kaskadaWskaznikow(D({ mpzpMeta: { maxWysokoscM: "12", intensywnoscZabudowy: "1,4" } }));
  assert.equal(r.kondygnacje.zrodlo, "auto");
  assert.equal(r.kondygnacje.wartosc, 4); // 12 / 3,2 ≈ 4
  assert.equal(r.far.zrodlo, "auto");
  assert.equal(r.far.wartosc, 1.4);
});

test("kaskada: ręczne wchodzi tylko po potwierdzeniu", () => {
  const bezPotw = kaskadaWskaznikow(D({ wskaznikiReczne: { maxWysokoscM: 12, intensywnosc: 1.5 }, wskaznikiPotwierdzone: false }));
  assert.equal(bezPotw.far.zrodlo, "prognoza"); // niepotwierdzone → ignorowane
  const zPotw = kaskadaWskaznikow(D({ wskaznikiReczne: { maxWysokoscM: 12, intensywnosc: 1.5 }, wskaznikiPotwierdzone: true }));
  assert.equal(zPotw.far.zrodlo, "deklarowane");
  assert.equal(zPotw.far.wartosc, 1.5);
  assert.equal(zPotw.kondygnacje.zrodlo, "deklarowane");
  assert.equal(zPotw.kondygnacje.wartosc, 4);
});

test("kaskada: legalne > fizyczne dla limitu wysokości (nie zaniżamy przy niskim sąsiedztwie)", () => {
  // Plan legalny 15 m (≈5 kond.), sąsiedztwo fizyczne tylko 2 piętra → limit = 5 (legalny).
  const r = kaskadaWskaznikow(D({ mpzpMeta: { maxWysokoscM: "15" }, wysokoscOkolicyPieter: 2 }));
  assert.equal(r.kondygnacje.zrodlo, "auto");
  assert.equal(r.kondygnacje.wartosc, 5);
  assert.ok(r.flagi.some((f) => f.includes("plan wiąże")));
});

test("kaskada: fizyczne (sąsiedztwo) używane gdy brak legalnego", () => {
  const r = kaskadaWskaznikow(D({ wysokoscOkolicyPieter: 4 }));
  assert.equal(r.kondygnacje.wartosc, 4);
  assert.equal(r.far.zrodlo, "prognoza"); // FAR spójny = 4 × 35/100 = 1.4
  assert.equal(r.far.wartosc, 1.4);
});

test("kaskada: walidacja ręcznego — flagi >60% zabudowy i >2,0 intensywność", () => {
  const r = kaskadaWskaznikow(D({ wskaznikiReczne: { maxPowZabudowyPct: 70, intensywnosc: 2.5 }, wskaznikiPotwierdzone: true }));
  assert.ok(r.flagi.some((f) => f.includes("> 60%")));
  assert.ok(r.flagi.some((f) => f.includes("> 2,0")));
});

test("kaskada: auto wygrywa nad ręcznym (rozbieżność informacyjnie)", () => {
  const r = kaskadaWskaznikow(D({
    wskaznikiPlanistyczne: { intensywnosc: 1.2, maxWysokoscM: 12, maxKondygnacje: 4, maxPowZabudowyPct: 35, minPbcPct: 30, normatywParkingowy: 0.8, udzialUslugPct: 15 },
    wskaznikiReczne: { maxPowZabudowyPct: 50 },
    wskaznikiPotwierdzone: true,
  }));
  assert.equal(r.kZabPct.zrodlo, "auto"); // plan 35% wygrywa
  assert.equal(r.kZabPct.wartosc, 35);
  assert.ok(r.flagi.some((f) => f.includes("używamy planu")));
});

test("kaskada: pewność = najsłabsze użyte źródło (mieszany zestaw)", () => {
  // FAR auto, reszta prognoza → najsłabsze = prognoza (45).
  const r = kaskadaWskaznikow(D({ mpzpMeta: { intensywnoscZabudowy: "1,4" } }));
  assert.equal(r.far.zrodlo, "auto");
  assert.equal(r.kZabPct.zrodlo, "prognoza");
  assert.equal(r.pewnosc, 45);
});
