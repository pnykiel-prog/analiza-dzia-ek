/** Testy OCZYSZCZONEGO modelu popytu P1 (5 kroków, jeden mnożnik migracji) — offline. */

import { test } from "node:test";
import assert from "node:assert/strict";
import { ocenPopytP1 } from "../popytP1";
import { KONFIG_POPYT_P1 } from "../../config";
import { DZIALKI_PRZYKLADOWE } from "../../data/sample";
import type { DaneDzialki } from "../../types";

const [wzorcowa, , bialePlamy] = DZIALKI_PRZYKLADOWE;
const POJ = { mlodzi: 30, seniorzy: 27 };

test("popytP1: zwraca 4 werdykty dwóch natur z poprawnymi kluczami", () => {
  const o = ocenPopytP1(wzorcowa, POJ);
  assert.equal(o.werdykty.spolecznyMlodzi.natura, "spoleczny");
  assert.equal(o.werdykty.komunalnySeniorzy.natura, "komunalny");
  assert.ok(["spolecznyMlodzi", "spolecznySeniorzy"].includes(o.rekomendowanyKierunek));
});

test("popytP1: K + S ≤ N_grupa; segment społeczny dodatni", () => {
  const k = ocenPopytP1(wzorcowa, POJ).kwalifikacje.mlodzi;
  assert.ok(k.nGrupa !== null && k.nSpoleczny !== null && k.nKomunalny !== null);
  assert.ok(k.nSpoleczny! + k.nKomunalny! <= k.nGrupa!);
  assert.ok(k.nSpoleczny! > 0);
});

test("popytP1: komunalny NIE zależy od pojemności; społeczny zależy", () => {
  const malo = ocenPopytP1(wzorcowa, { mlodzi: 5, seniorzy: 5 });
  const duzo = ocenPopytP1(wzorcowa, { mlodzi: 6000, seniorzy: 6000 });
  assert.equal(malo.werdykty.komunalnyMlodzi.score, duzo.werdykty.komunalnyMlodzi.score);
  assert.ok(malo.werdykty.spolecznyMlodzi.score > duzo.werdykty.spolecznyMlodzi.score);
});

test("popytP1: komunalny-seniorzy ma flagę senioralną i nie wyższą pewność niż aktywni", () => {
  const o = ocenPopytP1(wzorcowa, POJ);
  const ks = o.werdykty.komunalnySeniorzy;
  assert.ok(ks.flagi.some((f) => f.includes("senioralne ze wsparciem")));
  assert.ok(ks.pewnosc <= o.werdykty.komunalnyMlodzi.pewnosc);
});

test("popytP1: wysoka luka czynszowa → flaga popytu na najem społeczny", () => {
  const wysoka: DaneDzialki = { ...wzorcowa, czynszRynkowyM2: 100, wartoscOdtworzeniowaM2: 3000 };
  const o = ocenPopytP1(wysoka, POJ);
  const flagi = [...o.werdykty.spolecznyMlodzi.flagi, ...o.werdykty.spolecznySeniorzy.flagi];
  assert.ok(flagi.some((f) => f.includes("realny popyt na najem społeczny")));
  const niska: DaneDzialki = { ...wzorcowa, czynszRynkowyM2: 20, wartoscOdtworzeniowaM2: 9000 };
  const o2 = ocenPopytP1(niska, POJ);
  assert.ok(![...o2.werdykty.spolecznyMlodzi.flagi, ...o2.werdykty.spolecznySeniorzy.flagi].some((f) => f.includes("realny popyt na najem społeczny")));
});

test("popytP1: wyższy dochód gminy → mniejszy segment komunalny (qK)", () => {
  const biedna = ocenPopytP1({ ...wzorcowa, dochodPrzecietnyGmina: 3500 }, POJ);
  const bogata = ocenPopytP1({ ...wzorcowa, dochodPrzecietnyGmina: 12000 }, POJ);
  assert.ok((biedna.kwalifikacje.mlodzi.qK ?? 0) > (bogata.kwalifikacje.mlodzi.qK ?? 0));
});

test("popytP1: progi dochodowe NIEZALEŻNE od wartości odtworzeniowej", () => {
  const a = ocenPopytP1({ ...wzorcowa, wartoscOdtworzeniowaM2: 4000 }, POJ);
  const b = ocenPopytP1({ ...wzorcowa, wartoscOdtworzeniowaM2: 12000 }, POJ);
  assert.equal(a.kwalifikacje.mlodzi.qK, b.kwalifikacje.mlodzi.qK);
  assert.equal(a.kwalifikacje.seniorzy.nSpoleczny, b.kwalifikacje.seniorzy.nSpoleczny);
});

test("popytP1: rozkład dochodu per profil — seniorzy (emerytury) mają wyższy qK niż aktywni", () => {
  const o = ocenPopytP1(wzorcowa, POJ);
  assert.ok((o.kwalifikacje.seniorzy.qK ?? 0) > (o.kwalifikacje.mlodzi.qK ?? 0));
});

test("popytP1: rekomendacja działki TYLKO spośród werdyktów społecznych", () => {
  const o = ocenPopytP1(wzorcowa, POJ);
  assert.ok(["spolecznyMlodzi", "spolecznySeniorzy"].includes(o.rekomendowanyKierunek));
});

test("popytP1: pułapka senioralna to FLAGA, nie cięcie score komunalnego", () => {
  const zWzorcem: DaneDzialki = { ...wzorcowa, trendLudnosc: "malejaca", trend65Plus: "rosnacy", populacjaStabilna: false };
  const bez: DaneDzialki = { ...wzorcowa, trendLudnosc: "malejaca", trend65Plus: "stabilny", populacjaStabilna: false };
  const a = ocenPopytP1(zWzorcem, POJ).werdykty.komunalnySeniorzy;
  const b = ocenPopytP1(bez, POJ).werdykty.komunalnySeniorzy;
  assert.equal(a.score, b.score); // trend nie tnie już wyniku komunalnego
  assert.ok(a.flagi.some((f) => f.includes("ryzyko utrwalania odpływu")));
});

// ── Oczyszczony model: udział bez mieszkania (tabela) ─────────────────────────

test("udział bez mieszkania (tabela) skaluje popyt obu profili + flaga założenia", () => {
  const bazowy = ocenPopytP1(wzorcowa, POJ);
  const cfgPol = {
    ...KONFIG_POPYT_P1,
    udzialBezMieszkania: {
      mlodzi: { komunalny: KONFIG_POPYT_P1.udzialBezMieszkania.mlodzi.komunalny / 2, spoleczny: KONFIG_POPYT_P1.udzialBezMieszkania.mlodzi.spoleczny / 2 },
      seniorzy: { komunalny: KONFIG_POPYT_P1.udzialBezMieszkania.seniorzy.komunalny / 2, spoleczny: KONFIG_POPYT_P1.udzialBezMieszkania.seniorzy.spoleczny / 2 },
    },
  };
  const polowa = ocenPopytP1(wzorcowa, POJ, cfgPol);
  assert.ok(Math.abs(polowa.kwalifikacje.mlodzi.nKomunalny! - bazowy.kwalifikacje.mlodzi.nKomunalny! / 2) <= 1);
  assert.ok(Math.abs(polowa.kwalifikacje.mlodzi.nSpoleczny! - bazowy.kwalifikacje.mlodzi.nSpoleczny! / 2) <= 1);
  assert.ok(bazowy.werdykty.spolecznyMlodzi.flagi.some((f) => f.includes("Udział bez mieszkania to założenie")));
});

// ── Oczyszczony model: komunalny zakotwiczony w liczbie bezwzględnej ──────────

test("komunalny: duża liczba kwalifikujących → WYSOKI popyt, NIGDY zero/nieoznaczony", () => {
  // Duże miasto: ~13 000+ kwalifikujących komunalnych → werdykt wysoki (nie „nie nadaje się").
  const duzeMiasto: DaneDzialki = { ...wzorcowa, liczbaMieszkancowGminy: 280000, liczbaAktywni: 170000, liczba65Plus: 65000, dochodPrzecietnyGmina: 6000 };
  const km = ocenPopytP1(duzeMiasto, POJ).werdykty.komunalnyMlodzi;
  assert.ok(km.liczbaKwalifikujacych! > 5000, `oczekiwano dużej liczby: ${km.liczbaKwalifikujacych}`);
  assert.equal(km.werdykt, "zielony");
  assert.ok(!km.nieoznaczony);
});

// ── Oczyszczony model: brak danych → nieoznaczony (nie zero, nie „nie nadaje się") ──

test("brak danych ludnościowych → werdykt nieoznaczony (nie czerwony, nie ostra liczba)", () => {
  const bezLudnosci: DaneDzialki = {
    ...bialePlamy,
    liczbaMieszkancowGminy: null,
    liczbaAktywni: null,
    liczba65Plus: null,
    udzialAktywniPct: null,
    udzial65PlusPct: null,
  };
  const o = ocenPopytP1(bezLudnosci, POJ);
  for (const w of Object.values(o.werdykty)) {
    assert.equal(w.nieoznaczony, true);
    assert.notEqual(w.werdykt, "czerwony"); // nigdy „nie nadaje się" przy nieznanej podstawie
    assert.equal(w.liczbaKwalifikujacych, null); // brak ostrej liczby
    assert.ok(w.pewnosc <= 30); // niska pewność
  }
});

// ── Oczyszczony model: migracja jako jeden mnożnik z wagą per kafel ───────────

test("migracja: gmina rosnąca podnosi popyt aktywnych społecznych; komunalny-seniorzy bez zmian (waga 0)", () => {
  const duzaPoj = { mlodzi: 4000, seniorzy: 4000 }; // duża pojemność → widać różnicę popytu (bez saturacji)
  const rosnaca: DaneDzialki = { ...wzorcowa, naplywZameldowanNa1000: 15, odplywMlodychNa1000: 3 };
  const kurczaca: DaneDzialki = { ...wzorcowa, naplywZameldowanNa1000: 3, odplywMlodychNa1000: 15 };
  const r = ocenPopytP1(rosnaca, duzaPoj);
  const k = ocenPopytP1(kurczaca, duzaPoj);
  assert.ok(r.werdykty.spolecznyMlodzi.score > k.werdykty.spolecznyMlodzi.score, "aktywni społeczni czuli migrację");
  // Komunalny-seniorzy: waga migracji 0 → popyt identyczny niezależnie od salda.
  assert.equal(r.werdykty.komunalnySeniorzy.liczbaKwalifikujacych, k.werdykty.komunalnySeniorzy.liczbaKwalifikujacych);
});
