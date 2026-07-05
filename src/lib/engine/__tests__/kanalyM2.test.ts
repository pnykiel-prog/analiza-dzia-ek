/** Testy domknięcia M2 (kanały A–F) — wejście realnie zmienia wyjście właściwym kanałem. */

import { test } from "node:test";
import assert from "node:assert/strict";
import { dostepnoscA, przydatnoscEkonomicznaB, modyfikatorPopytuC, modyfikatorTransportu, ocenM2, flagiTransportu } from "../kanalyM2";
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

test("kanał A: progi PER USŁUGA — sklep 2800 m nie dyskwalifikuje seniora (próg 3000)", () => {
  const sklep = dostepnoscA({ ...baza, odleglosciM2: { sklep: 2800 } } as DaneDzialki, "seniorzy");
  assert.equal(sklep.obsluzalny, true);
  assert.ok(sklep.mnoznik > 0.3 && sklep.mnoznik < 0.5, `sklep 2800 → mnożnik ${sklep.mnoznik}`);
});

test("kanał A: gradient 1,0 → 0,3 — POZ na środku (komfort 500, dyskw 5000) → f≈0,65", () => {
  const a = dostepnoscA({ ...baza, odleglosciM2: { poz: 2750 } } as DaneDzialki, "seniorzy"); // środek 500..5000
  assert.equal(a.obsluzalny, true);
  assert.ok(Math.abs(a.mnoznik - 0.65) < 0.02, `środek → ${a.mnoznik} (oczekiwane ≈0,65)`);
});

test("transport panel: NIE jest bramką kanału A — przystanek nie występuje w progach usług", () => {
  // Nawet ekstremalne dane transportu nie wpływają na dostepnoscA (transport = osobny modyfikator).
  const a = dostepnoscA({ ...baza, odleglosciM2: { poz: 300 }, transport: { jest: false, przystanki: [] } } as DaneDzialki, "seniorzy");
  assert.equal(a.obsluzalny, true);
  assert.equal(a.mnoznik, 1);
});

test("transport §6: usługi pieszo (POZ) bramkują niezależnie od transportu", () => {
  // „Nie ma" transportu, ale brak POZ w zasięgu nadal chroni seniora (osobna bramka).
  const a = dostepnoscA({ ...baza, odleglosciM2: { poz: 6000 }, transport: { jest: false, przystanki: [] } } as DaneDzialki, "seniorzy");
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

test("transport §3: modyfikator — dobry przystanek daje bonus; brak/nie ma = neutralny (1,0)", () => {
  const dobry = modyfikatorTransportu({ ...baza, transport: { jest: true, przystanki: [{ odlegloscM: 200, liczbaLinii: 8, kursyDzien: 60, kursyNoc: 10 }] } } as DaneDzialki, "mlodzi");
  assert.ok(dobry.mnoznik > 1, `dobry transport → bonus ${dobry.mnoznik}`);
  assert.ok(dobry.mnoznik <= 1.1, "bonus łagodny (≤ +10%)");
  assert.equal(modyfikatorTransportu({ ...baza, transport: { jest: false, przystanki: [] } } as DaneDzialki, "mlodzi").mnoznik, 1); // nie ma → neutralny
  assert.equal(modyfikatorTransportu({ ...baza, transport: null } as DaneDzialki, "seniorzy").mnoznik, 1); // pominięte → neutralny
});

test("transport §2.2: seniorzy ważą walkability mocniej — bliski przystanek daje im większy bonus", () => {
  const bliski = { ...baza, transport: { jest: true, przystanki: [{ odlegloscM: 200, liczbaLinii: 1, kursyDzien: 5, kursyNoc: 0 }] } } as DaneDzialki;
  const tS = modyfikatorTransportu(bliski, "seniorzy");
  const tM = modyfikatorTransportu(bliski, "mlodzi");
  assert.ok(tS.mnoznik >= tM.mnoznik, `senior ${tS.mnoznik} ≥ młodzi ${tM.mnoznik} przy bliskim, słabo obsłużonym przystanku`);
});

test("transport §2.1/§5: Nie ma → flaga, NIGDY nie obniża werdyktu; pominięte → bez flagi", () => {
  const niema = { ...baza, odleglosciM2: { poz: 300, apteka: 300, sklep: 300 }, transport: { jest: false, przystanki: [] } } as DaneDzialki;
  const pominiete = { ...baza, odleglosciM2: { poz: 300, apteka: 300, sklep: 300 }, transport: null } as DaneDzialki;
  const oN = ocenM2(niema, p1, "pass");
  const oP = ocenM2(pominiete, p1, "pass");
  assert.ok(oN.flagi.some((f) => /bez komunikacji zbiorowej/i.test(f))); // „Nie ma" → flaga
  assert.equal(oP.flagi.length, 0); // pominięte → brak flagi „bez"
  // „Nie ma" transportu NIE obniża werdyktu senioralnego względem pominięcia (neutralny, nie kara).
  assert.equal(oN.werdykty.seniorzy.score, oP.werdykty.seniorzy.score);
});

test("transport: dobra komunikacja PODNOSI werdykt vs brak (modyfikator jakości, nie bramka)", () => {
  const dobry = { ...baza, odleglosciM2: { poz: 300, apteka: 300, sklep: 300 }, transport: { jest: true, przystanki: [{ odlegloscM: 150, liczbaLinii: 10, kursyDzien: 80, kursyNoc: 12 }] } } as DaneDzialki;
  const niema = { ...baza, odleglosciM2: { poz: 300, apteka: 300, sklep: 300 }, transport: { jest: false, przystanki: [] } } as DaneDzialki;
  assert.ok(ocenM2(dobry, p1, "pass").werdykty.mlodzi.score >= ocenM2(niema, p1, "pass").werdykty.mlodzi.score);
});

test("transport §5: flagiTransportu tylko dla Nie ma (pominięte / jest → brak flagi)", () => {
  assert.equal(flagiTransportu({ ...baza, transport: { jest: false, przystanki: [] } } as DaneDzialki).length, 1);
  assert.equal(flagiTransportu({ ...baza, transport: { jest: true, przystanki: [] } } as DaneDzialki).length, 0);
  assert.equal(flagiTransportu({ ...baza } as DaneDzialki).length, 0); // pominięte → brak flagi
});
