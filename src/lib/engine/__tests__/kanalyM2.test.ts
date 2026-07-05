/** Testy domknięcia M2 (kanały A–F) — wejście realnie zmienia wyjście właściwym kanałem. */

import { test } from "node:test";
import assert from "node:assert/strict";
import { dostepnoscA, przydatnoscEkonomicznaB, modyfikatorPopytuC, ocenM2, kontekstZGtfs, flagiTransportu } from "../kanalyM2";
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

test("kanał A: progi PER USŁUGA — sklep 2800 m nie dyskwalifikuje seniora (próg 3000), przystanek 2600 tak (próg 2500)", () => {
  // Sklep senior: dyskw 3000 → 2800 nie bramkuje (dawny wspólny próg 2500 błędnie by zbramkował).
  const sklep = dostepnoscA({ ...baza, odleglosciM2: { sklep: 2800 } } as DaneDzialki, "seniorzy");
  assert.equal(sklep.obsluzalny, true);
  assert.ok(sklep.mnoznik > 0.3 && sklep.mnoznik < 0.5, `sklep 2800 → mnożnik ${sklep.mnoznik}`);
  // Przystanek senior: dyskw 2500 → 2600 bramkuje (usługa wrażliwsza) — TYLKO w kontekście miejskim.
  const przyst = dostepnoscA({ ...baza, odleglosciM2: { przystanek: 2600 }, kontekstTransportowy: "z_komunikacja" } as DaneDzialki, "seniorzy");
  assert.equal(przyst.obsluzalny, false);
  assert.equal(przyst.mnoznik, 0);
});

test("kanał A: gradient 1,0 → 0,3 — na środku między komfortem a dyskwalifikacją f≈0,65", () => {
  // Przystanek senior: komfort 300, dyskw 2500 → środek 1400 m: 1 − 0,7×0,5 = 0,65 (kontekst miejski).
  const a = dostepnoscA({ ...baza, odleglosciM2: { przystanek: 1400 }, kontekstTransportowy: "z_komunikacja" } as DaneDzialki, "seniorzy");
  assert.equal(a.obsluzalny, true);
  assert.ok(Math.abs(a.mnoznik - 0.65) < 0.02, `środek → ${a.mnoznik} (oczekiwane ≈0,65)`);
});

test("transport §4: przystanek daleko NIE bramkuje na wsi/bez GTFS (kontekst ≠ z_komunikacja)", () => {
  // Ta sama odległość 2600 m co wyżej, ale bez kontekstu miejskiego → przystanek poza bramką.
  const bezKontekstu = dostepnoscA({ ...baza, odleglosciM2: { przystanek: 2600 } } as DaneDzialki, "seniorzy");
  assert.equal(bezKontekstu.obsluzalny, true); // §0: brak GTFS nigdy nie dyskwalifikuje
  assert.equal(bezKontekstu.mnoznik, 1); // przystanek wyłączony z kanału A
  const wies = dostepnoscA({ ...baza, odleglosciM2: { przystanek: 2600 }, kontekstTransportowy: "bez_komunikacji" } as DaneDzialki, "seniorzy");
  assert.equal(wies.obsluzalny, true);
  assert.equal(wies.mnoznik, 1);
});

test("transport §6: usługi pieszo (POZ) bramkują niezależnie od kontekstu transportu (wieś)", () => {
  // Na wsi transport = flaga, ale brak POZ w zasięgu nadal chroni seniora (osobna bramka).
  const a = dostepnoscA({ ...baza, odleglosciM2: { poz: 6000 }, kontekstTransportowy: "bez_komunikacji" } as DaneDzialki, "seniorzy");
  assert.equal(a.obsluzalny, false);
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

test("transport §3: kontekstZGtfs — żywa linia = miasto, martwa/daleka = wieś, brak = null", () => {
  assert.equal(kontekstZGtfs(400, 40), "z_komunikacja"); // blisko + częsta
  assert.equal(kontekstZGtfs(400, 3), "bez_komunikacji"); // martwa linia (2–3 kursy) → NIE miasto
  assert.equal(kontekstZGtfs(3000, 40), "bez_komunikacji"); // częsta, ale poza promieniem
  assert.equal(kontekstZGtfs(400, null), null); // brak GTFS → nieznane
  assert.equal(kontekstZGtfs(null, 40), "bez_komunikacji"); // częstotliwość jest, ale przystanek poza zasięgiem
});

test("transport §4.2/§9: wieś bez GTFS → flaga, werdykt senioralny NIE obniżony", () => {
  const wies = { ...baza, odleglosciM2: { poz: 300, apteka: 300, sklep: 300 }, kontekstTransportowy: "bez_komunikacji" } as DaneDzialki;
  const miasto = { ...baza, odleglosciM2: { poz: 300, apteka: 300, sklep: 300 }, kontekstTransportowy: "z_komunikacja", przystanekZCzestotliwoscia: true } as DaneDzialki;
  const oW = ocenM2(wies, p1, "pass");
  const oM = ocenM2(miasto, p1, "pass");
  assert.ok(oW.flagi.some((f) => /bez komunikacji zbiorowej/i.test(f))); // flaga wywieszona
  assert.equal(oM.flagi.length, 0); // miasto — bez flagi
  // Brak transportu na wsi NIE obniża werdyktu senioralnego względem miasta z transportem.
  assert.ok(oW.werdykty.seniorzy.score >= oM.werdykty.seniorzy.score);
});

test("transport §5: flagiTransportu tylko dla bez_komunikacji (brak GTFS ≠ flaga)", () => {
  assert.equal(flagiTransportu({ ...baza, kontekstTransportowy: "bez_komunikacji" } as DaneDzialki).length, 1);
  assert.equal(flagiTransportu({ ...baza, kontekstTransportowy: "z_komunikacja" } as DaneDzialki).length, 0);
  assert.equal(flagiTransportu({ ...baza } as DaneDzialki).length, 0); // null → brak flagi „bez"
});
