/** Testy przekroju montażu M3 (oba reżimy, wkład własny domykający) — offline. */

import { test } from "node:test";
import assert from "node:assert/strict";
import { przekrojObuRezimow, rolaZeSposobu, type WejscieMontazu } from "../finanse/przekroj";

function wej(over: Partial<WejscieMontazu> = {}): WejscieMontazu {
  return {
    pumMieszkalnaM2: 5000,
    pumCalkowiteM2: 6000,
    kosztBudowyM2: 9500,
    wartoscOdtworzeniowaM2: 7000,
    wartoscDzialkiPln: 2_000_000,
    rolaDzialki: "neutralna",
    partycypacjaNajemcowPct: 0,
    wkladGminyPct: 0,
    ...over,
  };
}

test("przekrój: źródła sumują się do kosztu (wkład własny domyka)", () => {
  for (const kol of Object.values(przekrojObuRezimow(wej()))) {
    const s = kol.zrodla;
    const suma = s.grant + s.kredyt + s.aport + s.partycypacjaNajemcow + s.wkladGminy + s.wkladWlasny;
    assert.equal(suma, kol.koszt.razem, `${kol.rezim}: źródła = koszt`);
    assert.ok(s.wkladWlasny >= 0);
  }
});

test("przekrój: aport → działka po stronie źródeł, koszt bez gruntu", () => {
  const p = przekrojObuRezimow(wej({ rolaDzialki: "zrodlo" }));
  assert.equal(p.obecny.koszt.grunt, 0);
  assert.equal(p.obecny.zrodla.aport, 2_000_000);
});

test("przekrój: zakup → działka po stronie kosztu, brak aportu", () => {
  const p = przekrojObuRezimow(wej({ rolaDzialki: "koszt" }));
  assert.equal(p.obecny.koszt.grunt, 2_000_000);
  assert.equal(p.obecny.zrodla.aport, 0);
  assert.equal(p.obecny.koszt.razem, p.obecny.koszt.budowa + 2_000_000);
});

test("przekrój: droższa budowa → większy wkład własny", () => {
  const tani = przekrojObuRezimow(wej({ kosztBudowyM2: 5000 })).obecny.zrodla.wkladWlasny;
  const drogi = przekrojObuRezimow(wej({ kosztBudowyM2: 14000 })).obecny.zrodla.wkladWlasny;
  assert.ok(drogi > tani);
});

test("przekrój: reżim przyszły (50 lat) → większy kredyt niż obecny (30 lat)", () => {
  const p = przekrojObuRezimow(wej());
  assert.ok(p.przyszly.zrodla.kredyt > p.obecny.zrodla.kredyt, "dłuższy okres → większa zdolność kredytowa");
});

test("przekrój: rola działki ze sposobu wniesienia", () => {
  assert.equal(rolaZeSposobu("ZAKUP_KREDYT"), "koszt");
  assert.equal(rolaZeSposobu("APORT_GMINNY"), "zrodlo");
  assert.equal(rolaZeSposobu("LOKAL_ZA_GRUNT"), "zrodlo");
  assert.equal(rolaZeSposobu("JUZ_POSIADANA"), "neutralna");
});
