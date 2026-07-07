/** Testy bramki wielkości/kształtu + formy zabudowy (M1) — offline, deterministyczne. */

import { test } from "node:test";
import assert from "node:assert/strict";
import { liczBramkeWielkosci } from "../bramkaWielkosci";
import type { DaneDzialki, SasiedztwoDane } from "../../types";

// Sąsiedztwo wysokie (5 kond., pokrycie 0.4) — stały sygnał do powtarzalnych liczb.
const SASIEDZTWO_WYS: SasiedztwoDane = {
  pokrycieUdzial: 0.4,
  typoweKondygnacje: 5,
  liczbaProbki: 10,
  wysokosciDostepne: true,
  spadekPct: 1,
  zrodlo: "deterministyczne",
};
// Sąsiedztwo niskie (3 kond., pokrycie 0.45) — do przypadku konfliktu progów.
const SASIEDZTWO_NIS: SasiedztwoDane = {
  pokrycieUdzial: 0.45,
  typoweKondygnacje: 3,
  liczbaProbki: 10,
  wysokosciDostepne: true,
  spadekPct: 1,
  zrodlo: "deterministyczne",
};

function dz(over: Partial<DaneDzialki>): DaneDzialki {
  return { id: "test", teryt: "0000000", powierzchniaM2: 0, zwartoscKsztaltu: 0.85, minSzerokoscM: 50, ...over } as DaneDzialki;
}

test("bramka: duża, foremna działka → ok, forma wysoka rekomendowana (najwięcej lokali)", () => {
  const b = liczBramkeWielkosci(dz({ powierzchniaM2: 5000 }), SASIEDZTWO_WYS, "brak");
  assert.equal(b.wynik, "ok");
  assert.equal(b.fizycznieWykonalna, true);
  assert.equal(b.formaRekomendowana, "wysoka");
  assert.ok(b.wysoka.lokali > b.niska.lokali, "wysoka daje więcej lokali niż niska");
  assert.ok(b.wysoka.lokali >= 40, "powyżej progu opłacalności wysokiej");
  assert.equal(b.ponizejProguOplacalnosci, false);
});

test("bramka: mieszkania liczone z PUM (po odjęciu wspólnych i usług) < PU", () => {
  const b = liczBramkeWielkosci(dz({ powierzchniaM2: 5000 }), SASIEDZTWO_WYS, "brak");
  // PUM zawsze mniejszy od PU (odjęte wspólne + usługi) — brak zawyżenia z powierzchni użytkowej.
  assert.ok(b.wysoka.pumM2 < b.wysoka.puM2);
  assert.ok(b.niska.pumM2 < b.niska.puM2);
});

test("bramka: mała skala → punkt decyzyjny (nizsza_oplacalnosc), nie odrzucenie", () => {
  const b = liczBramkeWielkosci(dz({ powierzchniaM2: 1000 }), SASIEDZTWO_WYS, "brak");
  assert.equal(b.wynik, "nizsza_oplacalnosc");
  assert.equal(b.fizycznieWykonalna, true); // da się zbudować — tylko poniżej progu
  assert.equal(b.ponizejProguOplacalnosci, true);
  assert.ok(b.notaSkali && b.notaSkali.includes("progu"));
});

test("bramka: konflikt progów — wysoka poniżej 40, niska w progu (≥20) → decyzja klienta", () => {
  const b = liczBramkeWielkosci(dz({ powierzchniaM2: 1500, zwartoscKsztaltu: 0.9, minSzerokoscM: 40 }), SASIEDZTWO_NIS, "brak");
  assert.equal(b.wynik, "konflikt");
  assert.equal(b.konfliktProgow, true);
  assert.ok(b.wysoka.lokali < 40, "wysoka poniżej swojego progu");
  assert.ok(b.niska.lokali >= 20, "niska w swoim progu");
});

test("bramka: działka za mała (0 lokali) i mała powierzchniowo → scalenie (bez pytania)", () => {
  const b = liczBramkeWielkosci(dz({ powierzchniaM2: 60, minSzerokoscM: 12 }), SASIEDZTWO_WYS, "brak");
  assert.equal(b.wynik, "scalenie");
  assert.equal(b.fizycznieWykonalna, false);
  assert.ok(b.komunikat.includes("scalenie") || b.komunikat.includes("połączenie"));
});

test("bramka: działka zbyt wąska → nieprzydatna (fizyczna niewykonalność)", () => {
  const b = liczBramkeWielkosci(dz({ powierzchniaM2: 2000, minSzerokoscM: 4 }), SASIEDZTWO_WYS, "brak");
  assert.equal(b.wynik, "nieprzydatna");
  assert.equal(b.fizycznieWykonalna, false);
});
