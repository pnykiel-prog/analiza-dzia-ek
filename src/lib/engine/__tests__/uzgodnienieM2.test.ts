/** Testy offline: silnik uzgodnienia danych M2 (rozpoznanie braków, sekcje E3). */

import { test } from "node:test";
import assert from "node:assert/strict";
import { uzgodnijM2, KATALOG_M2, wartoscPolaTekst } from "../uzgodnienieM2";
import type { DaneDzialki } from "../../types";

// Minimalna działka: część pól M2 obecna (pozyskane), reszta brak.
const bazowa = {
  sredniSpadekPct: 6,
  odlegloscDoSieciM: 120,
  przystanekZCzestotliwoscia: true,
  pustostanyPct: 4,
  dostepDrogaPubliczna: true,
} as unknown as DaneDzialki;

test("uzgodnienieM2: pole obecne w danych → pozyskane (sekcja A)", () => {
  const w = uzgodnijM2(bazowa);
  const spadek = w.pola.find((p) => p.klucz === "sredniSpadekPct")!;
  assert.equal(spadek.status, "pozyskane");
  assert.equal(spadek.wartosc, 6);
  assert.ok(w.sekcjaA.some((p) => p.klucz === "sredniSpadekPct"));
});

test("uzgodnienieM2: pole brakujące on/gate → sekcja B; off → sekcja C", () => {
  const w = uzgodnijM2(bazowa);
  // natura2000 (gate) brak → sekcja B
  assert.ok(w.sekcjaB.some((p) => p.klucz === "natura2000"));
  // czasDojazdAglomeracjaMin (off) brak → sekcja C, bez pola ręcznego
  assert.ok(w.sekcjaC.some((p) => p.klucz === "czasDojazdAglomeracjaMin"));
  // żadne pole off nie trafia do B (brak opcji ręcznej)
  assert.ok(!w.sekcjaB.some((p) => p.manualFallback === "off"));
});

test("uzgodnienieM2: każde pole trafia dokładnie do jednej sekcji; suma = katalog", () => {
  const w = uzgodnijM2(bazowa);
  assert.equal(w.pola.length, KATALOG_M2.length);
  assert.equal(w.sekcjaA.length + w.sekcjaB.length + w.sekcjaC.length, KATALOG_M2.length);
});

test("uzgodnienieM2: nadpisanie ręczne → pozyskane, źródło ręczne (user-sourced)", () => {
  const w = uzgodnijM2(bazowa, { nadpisania: { osuwisko: false } });
  const os = w.pola.find((p) => p.klucz === "osuwisko")!;
  assert.equal(os.status, "pozyskane");
  assert.equal(os.wartosc, false);
  assert.equal(os.zrodlo, "ręczne");
  assert.ok(os.pewnosc > 0 && os.pewnosc < 80);
  assert.ok(w.sekcjaA.some((p) => p.klucz === "osuwisko"));
});

test("uzgodnienieM2: pominięcie → status pominiete (nie blokuje), zostaje w sekcji B dla on/gate", () => {
  const w = uzgodnijM2(bazowa, { pominiete: ["natura2000"] });
  const nat = w.pola.find((p) => p.klucz === "natura2000")!;
  assert.equal(nat.status, "pominiete");
  assert.ok(w.sekcjaB.some((p) => p.klucz === "natura2000")); // wciąż do uzupełnienia/„Przelicz"
});

test("uzgodnienieM2: więcej danych → wyższa pewność i pozyskanychPct; brak nie zeruje (≠ blokada)", () => {
  const puste = {} as unknown as DaneDzialki;
  const wPuste = uzgodnijM2(puste);
  const wPelne = uzgodnijM2(bazowa);
  assert.ok(wPelne.pozyskanychPct > wPuste.pozyskanychPct);
  assert.ok(wPelne.pewnosc > wPuste.pewnosc);
  // Nawet przy zerze danych pewność > 0 (braki tylko obniżają, nie blokują).
  assert.ok(wPuste.pewnosc > 0);
  assert.equal(wPuste.pozyskanychPct, 0);
});

test("uzgodnienieM2: formatowanie wartości (jednostka, bool, wskaźniki → skrót)", () => {
  const w = uzgodnijM2(bazowa);
  assert.equal(wartoscPolaTekst(w.pola.find((p) => p.klucz === "sredniSpadekPct")!), "6 %");
  assert.equal(wartoscPolaTekst(w.pola.find((p) => p.klucz === "przystanekZCzestotliwoscia")!), "tak");
  assert.equal(wartoscPolaTekst(w.pola.find((p) => p.klucz === "natura2000")!), "—");
  // Wskaźniki planistyczne (obiekt) → zwięzły skrót zamiast [object Object].
  const zWsk = uzgodnijM2({ wskaznikiPlanistyczne: { intensywnosc: 1.2, maxKondygnacje: 5, maxPowZabudowyPct: 40 } } as unknown as DaneDzialki);
  const wsk = zWsk.pola.find((p) => p.klucz === "wskaznikiPlanistyczne")!;
  assert.equal(wartoscPolaTekst(wsk), "int. 1.2 · 5 kond. · 40% zab.");
});
