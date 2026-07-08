/** Testy modelu popytu P1 (4 werdykty + atrakcyjność migracyjna) — offline. */

import { test } from "node:test";
import assert from "node:assert/strict";
import { ocenPopytP1 } from "../popytP1";
import { DZIALKI_PRZYKLADOWE } from "../../data/sample";
import type { DaneDzialki } from "../../types";

const [wzorcowa, , bialePlamy] = DZIALKI_PRZYKLADOWE;
const POJ = { mlodzi: 30, seniorzy: 27 };

test("popytP1: zwraca 4 werdykty dwóch natur z poprawnymi kluczami", () => {
  const o = ocenPopytP1(wzorcowa, POJ);
  assert.equal(o.werdykty.spolecznyMlodzi.natura, "spoleczny");
  assert.equal(o.werdykty.spolecznySeniorzy.natura, "spoleczny");
  assert.equal(o.werdykty.komunalnyMlodzi.natura, "komunalny");
  assert.equal(o.werdykty.komunalnySeniorzy.natura, "komunalny");
  assert.ok(["spolecznyMlodzi", "spolecznySeniorzy", "komunalnyMlodzi", "komunalnySeniorzy"].includes(o.rekomendowanyKierunek));
});

test("popytP1: trójdzielny podział — liczby K + S ≤ N_grupa; segment społeczny dodatni", () => {
  const o = ocenPopytP1(wzorcowa, POJ);
  const k = o.kwalifikacje.mlodzi;
  assert.ok(k.nGrupa !== null && k.nSpoleczny !== null && k.nKomunalny !== null);
  assert.ok(k.nSpoleczny! + k.nKomunalny! <= k.nGrupa!); // K + S ≤ grupa (reszta = rynek)
  assert.ok(k.nSpoleczny! > 0);
});

test("popytP1: werdykt komunalny NIE zależy od pojemności działki (per mieszkaniec)", () => {
  const maloMieszkan = ocenPopytP1(wzorcowa, { mlodzi: 5, seniorzy: 5 });
  // Duża pojemność (> liczba kwalifikujących) → niższa wystarczalność społeczna.
  const duzoMieszkan = ocenPopytP1(wzorcowa, { mlodzi: 6000, seniorzy: 6000 });
  // Komunalny: identyczny (bez pojemności). Społeczny: inny (wystarczalność vs pojemność).
  assert.equal(maloMieszkan.werdykty.komunalnyMlodzi.score, duzoMieszkan.werdykty.komunalnyMlodzi.score);
  assert.ok(maloMieszkan.werdykty.spolecznyMlodzi.score > duzoMieszkan.werdykty.spolecznyMlodzi.score);
});

test("popytP1: bramka A1 — brak napływu i luki → niska atrakcyjność (bez życzeniowej migracji)", () => {
  const wymierajaca: DaneDzialki = {
    ...bialePlamy,
    saldoMigracjiMlodzi: -10,
    naplywZameldowanNa1000: null,
    czynszRynkowyM2: null, // brak luki
    wartoscOdtworzeniowaM2: null,
    bezrobociePct: 12,
    liczbaPodmiotowGosp: 60,
  };
  const o = ocenPopytP1(wymierajaca, POJ);
  const a = o.atrakcyjnoscMigracyjna;
  assert.ok(a.a1 <= 20, `A1 powinno być niskie: ${a.a1}`);
  assert.ok(a.a2 <= 15 && a.a3 <= 15, `A2/A3 powinny być bliskie 0: ${a.a2}/${a.a3}`);
});

test("popytP1: komunalny-seniorzy ma flage senioralne-ze-wsparciem i najnizsza pewnosc", () => {
  const o = ocenPopytP1(bialePlamy, POJ);
  const ks = o.werdykty.komunalnySeniorzy;
  assert.ok(ks.flagi.some((f) => f.includes("senioralne ze wsparciem")));
  assert.ok(ks.pewnosc <= o.werdykty.komunalnyMlodzi.pewnosc);
});

test("popytP1: wysoka luka czynszowa → flaga popytu na najem społeczny w M1 (estymacja)", () => {
  // Wysoka luka: drogi czynsz vs niska wartość odtworzeniowa → pułap niski → luka duża.
  const wysokaLuka: DaneDzialki = { ...wzorcowa, czynszRynkowyM2: 100, wartoscOdtworzeniowaM2: 3000 };
  const o = ocenPopytP1(wysokaLuka, POJ);
  const flagi = [...o.werdykty.spolecznyMlodzi.flagi, ...o.werdykty.spolecznySeniorzy.flagi];
  assert.ok(flagi.some((f) => f.includes("realny popyt na najem społeczny")), `flagi: ${flagi.join(" | ")}`);
  // Niska/ujemna luka → brak flagi.
  const niskaLuka: DaneDzialki = { ...wzorcowa, czynszRynkowyM2: 20, wartoscOdtworzeniowaM2: 9000 };
  const o2 = ocenPopytP1(niskaLuka, POJ);
  const flagi2 = [...o2.werdykty.spolecznyMlodzi.flagi, ...o2.werdykty.spolecznySeniorzy.flagi];
  assert.ok(!flagi2.some((f) => f.includes("realny popyt na najem społeczny")));
});

test("popytP1: wyższy dochód gminy → mniejszy segment komunalny (qK), większy rynek", () => {
  const biedna = ocenPopytP1({ ...wzorcowa, dochodPrzecietnyGmina: 3500 }, POJ);
  const bogata = ocenPopytP1({ ...wzorcowa, dochodPrzecietnyGmina: 12000 }, POJ);
  assert.ok((biedna.kwalifikacje.mlodzi.qK ?? 0) > (bogata.kwalifikacje.mlodzi.qK ?? 0));
});

test("popytP1 (1.1): progi dochodowe NIEZALEŻNE od wartości odtworzeniowej", () => {
  // Odświeżenie warstwy WO nie może przesuwać kwalifikacji dochodowej (błąd kategorii WO≠dochód).
  const a = ocenPopytP1({ ...wzorcowa, wartoscOdtworzeniowaM2: 4000 }, POJ);
  const b = ocenPopytP1({ ...wzorcowa, wartoscOdtworzeniowaM2: 12000 }, POJ);
  assert.equal(a.kwalifikacje.mlodzi.qK, b.kwalifikacje.mlodzi.qK);
  assert.equal(a.kwalifikacje.mlodzi.qS, b.kwalifikacje.mlodzi.qS);
  assert.equal(a.kwalifikacje.seniorzy.nSpoleczny, b.kwalifikacje.seniorzy.nSpoleczny);
});

test("popytP1 (1.2): rozkład dochodu per profil — seniorzy (emerytury) mają wyższy qK niż młodzi", () => {
  const o = ocenPopytP1(wzorcowa, POJ);
  // Niższa średnia emerytur → większa frakcja poniżej progu komunalnego.
  assert.ok((o.kwalifikacje.seniorzy.qK ?? 0) > (o.kwalifikacje.mlodzi.qK ?? 0));
});

test("popytP1 (4.1): rekomendacja działki wybierana TYLKO spośród werdyktów społecznych", () => {
  const o = ocenPopytP1(wzorcowa, POJ);
  // Kafle komunalne = „potrzeba gminy", nie rekomendacja konkretnej działki.
  assert.ok(["spolecznyMlodzi", "spolecznySeniorzy"].includes(o.rekomendowanyKierunek));
});

test("popytP1 (4.2): pulapka senioralna jako FLAGA, nie ciecie score komunalnego seniorow", () => {
  const bazaS: DaneDzialki = { ...wzorcowa, trendLudnosc: "malejaca" };
  const zWzorcem: DaneDzialki = { ...bazaS, trend65Plus: "rosnacy", populacjaStabilna: false };
  const bezWzorca: DaneDzialki = { ...bazaS, trend65Plus: "stabilny", populacjaStabilna: false };
  const a = ocenPopytP1(zWzorcem, POJ).werdykty.komunalnySeniorzy;
  const b = ocenPopytP1(bezWzorca, POJ).werdykty.komunalnySeniorzy;
  assert.equal(a.score, b.score); // wzorzec nie tnie już wyniku
  assert.ok(a.flagi.some((f) => f.includes("ryzyko utrwalania odpływu"))); // idzie jako flaga
});
