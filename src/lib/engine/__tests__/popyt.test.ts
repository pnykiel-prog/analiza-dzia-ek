/** Testy pod-modelu popytu (W2): rozdział wewn./zewn., kwalifikacja, filtr najmu, flagi. */

import { test } from "node:test";
import assert from "node:assert/strict";
import { ocenPopyt, filtrujNajemDlugoterminowy, lukaCenowaPct } from "../popyt";
import { KONFIG_SCORING } from "../../config";
import { DZIALKI_PRZYKLADOWE } from "../../data/sample";

const [wzorcowa, senioralna, bialePlamy] = DZIALKI_PRZYKLADOWE;

test("popyt: realizowalny w zakresie 0–100 dla wszystkich działek/profili", () => {
  for (const d of DZIALKI_PRZYKLADOWE)
    for (const p of ["mlodzi", "seniorzy"] as const) {
      const r = ocenPopyt(d, p, KONFIG_SCORING);
      assert.ok(r.realizowalny >= 0 && r.realizowalny <= 100, `${d.id}/${p}=${r.realizowalny}`);
      assert.ok(r.wewnetrzny >= 0 && r.zewnetrzny >= 0);
    }
});

test("popyt: wzorcowa (podmiejska) — młodzi z realnym popytem zewnętrznym (napływ + praca)", () => {
  const m = ocenPopyt(wzorcowa, "mlodzi", KONFIG_SCORING);
  assert.ok(m.zewnetrzny >= 50, `zewnętrzny młodzi=${m.zewnetrzny}`);
  assert.ok(m.realizowalny >= 70, `realizowalny młodzi=${m.realizowalny}`);
  // Silny wewnętrzny i zewnętrzny → interpretacja „silny rynek".
  assert.match(m.interpretacja, /silny/i);
});

test("popyt: senioralna — przewaga popytu wewnętrznego nad zewnętrznym", () => {
  const s = ocenPopyt(senioralna, "seniorzy", KONFIG_SCORING);
  assert.ok(s.wewnetrzny > s.zewnetrzny, `wewn=${s.wewnetrzny} zewn=${s.zewnetrzny}`);
});

test("popyt: białe plamy — brak czynszu → kwalifikacja szacunkowa (fallback), obniżona pewność, flaga", () => {
  const m = ocenPopyt(bialePlamy, "mlodzi", KONFIG_SCORING);
  assert.equal(m.udzialKwalifikujacyPct, null); // brak dochodu-do-czynszu policzalnego
  assert.ok(m.pewnosc < 100);
  assert.ok(m.flagi.some((f) => f.toLowerCase().includes("czynsz")));
});

test("popyt: pułapka seniorów — wysoki 65+ przy wyludnianiu → flaga", () => {
  const s = ocenPopyt(bialePlamy, "seniorzy", KONFIG_SCORING); // 26% 65+, malejąca, niestabilna
  assert.ok(s.flagi.some((f) => f.toLowerCase().includes("pułapka seniorów")));
});

test("popyt: luka cenowa liczona z czynszu i wartości odtworzeniowej", () => {
  const luka = lukaCenowaPct(wzorcowa, KONFIG_SCORING)!;
  assert.ok(luka > 40 && luka < 55, `luka=${luka}`); // ~46%
  assert.equal(lukaCenowaPct(bialePlamy, KONFIG_SCORING), null); // brak czynszu
});

test("popyt: mnożnik usług tłumi popyt przy słabej dostępności", () => {
  const dobre = ocenPopyt(wzorcowa, "mlodzi", KONFIG_SCORING); // dojazd 35, przystanek, szkoły
  const slabe = ocenPopyt(bialePlamy, "mlodzi", KONFIG_SCORING); // dojazd 75, brak przystanku
  assert.ok(dobre.mnoznikUslugi > slabe.mnoznikUslugi);
});

test("filtr najmu: odrzuca dobowe/turystyczne, liczy udział krótkoterminowego", () => {
  const oferty = [
    { cena: 2500, jednostka: "miesiac" as const, m2: 45 },
    { cena: 2800, jednostka: "miesiac" as const, m2: 50 },
    { cena: 200, jednostka: "doba" as const, m2: 40 },
    { cena: 3000, opis: "Apartament na doby, Airbnb" },
  ];
  const r = filtrujNajemDlugoterminowy(oferty);
  assert.equal(r.dlugoterminowe.length, 2);
  assert.equal(Math.round(r.udzialKrotkoterminowego * 100), 50);
  assert.equal(r.rynekTurystyczny, true);
});

test("filtr najmu: sama pula długoterminowa → brak flagi turystycznej", () => {
  const r = filtrujNajemDlugoterminowy([
    { cena: 2500, jednostka: "miesiac", m2: 45 },
    { cena: 2600, jednostka: "miesiac", m2: 48 },
  ]);
  assert.equal(r.rynekTurystyczny, false);
  assert.equal(r.udzialKrotkoterminowego, 0);
});
