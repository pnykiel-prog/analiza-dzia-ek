/**
 * Testy silników P1/P2/P3 na danych przykładowych.
 * Uruchom: `npm test`
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { DZIALKI_PRZYKLADOWE } from "../../data/sample";
import { uruchomAnalize } from "../index";
import { uruchomPoziom1 } from "../poziom1";
import { statusZeSymbolu } from "../../mpzp";

const [wzorcowa, senioralna, bialePlamy] = DZIALKI_PRZYKLADOWE;

test("P1: działka wzorcowa → rekomendacja młodzi, werdykt zielony/żółty", () => {
  const w = uruchomPoziom1(wzorcowa);
  assert.equal(w.bramki.status === "fail", false);
  assert.ok(w.scoreMlodzi >= w.scoreSeniorzy);
  assert.ok(["mlodzi", "oba"].includes(w.profilRekomendowany));
  assert.ok(w.pewnosc >= 80, `pewność powinna być wysoka, jest ${w.pewnosc}`);
  assert.ok(w.kluczoweLiczby.pulapCzynszuSimM2! > 30 && w.kluczoweLiczby.pulapCzynszuSimM2! < 35);
});

test("P1: działka senioralna → seniorzy nie gorsi niż młodzi", () => {
  const w = uruchomPoziom1(senioralna);
  assert.ok(w.scoreSeniorzy >= w.scoreMlodzi - 5);
  assert.notEqual(w.werdyktSeniorzy, undefined);
});

test("P1: białe plamy → Natura 2000 warunkowo, obniżona pewność, brak fail", () => {
  const w = uruchomPoziom1(bialePlamy);
  assert.ok(w.flagi.includes("Natura 2000"));
  assert.equal(w.bramki.status, "warunkowo"); // Natura 2000 → max żółty
  assert.notEqual(w.werdykt, "zielony");
  assert.ok(w.pewnosc < 90, `pewność powinna być obniżona przez braki, jest ${w.pewnosc}`);
});

test("P1: pułap czynszu = wartość odtworzeniowa × 5% ÷ 12", () => {
  const w = uruchomPoziom1(wzorcowa);
  const oczek = (wzorcowa.wartoscOdtworzeniowaM2! * 0.05) / 12;
  assert.ok(Math.abs(w.kluczoweLiczby.pulapCzynszuSimM2! - oczek) < 0.2);
});

test("P2: obwiednia z MPZP ma wyższą pewność niż fallback z sąsiedztwa", () => {
  const z = uruchomAnalize(senioralna); // MPZP
  const b = uruchomAnalize(bialePlamy); // brak MPZP → fallback
  assert.ok(z.poziom2.obwiednia.pewnoscObwiedni > b.poziom2.obwiednia.pewnoscObwiedni);
  assert.equal(b.poziom2.obwiednia.zrodloWskaznikow, "sasiedztwo_fallback");
  assert.ok(z.poziom2.warianty.length >= 1);
  assert.ok(z.poziom2.warianty.every((w) => w.liczbaMieszkan > 0));
});

test("P2: wariant senioralny zawsze ma windę", () => {
  const z = uruchomAnalize(senioralna);
  const senior = z.poziom2.warianty.find((w) => w.profil === "seniorzy");
  assert.ok(senior);
  assert.equal(senior!.windaWymagana, true);
});

test("P3: trzy scenariusze, reżim domyślny B, oś czasu sensowna", () => {
  const a = uruchomAnalize(wzorcowa);
  assert.equal(a.poziom3.scenariusze.length, 3);
  assert.equal(a.poziom3.rezimDomyslny, "B_program_2027");
  assert.ok(a.poziom3.osCzasu.rokOddania > a.poziom3.osCzasu.rokStartuBudowy);
  assert.ok(a.poziom3.osCzasu.rokStartuBudowy >= 2027);
});

test("P3: dłuższy okres kredytu obniża wymaganą dotację (50 vs 30 lat)", () => {
  const a = uruchomAnalize(wzorcowa);
  const poz = a.poziom3.wrazliwosc.find((x) => x.zmiana === "50 → 30 lat");
  assert.ok(poz);
  // skrócenie okresu z 50 do 30 lat zwiększa wymaganą dotację (dodatni wpływ pp)
  assert.ok(poz!.wplywNaDotacjePp >= 0, `skrócenie okresu powinno zwiększać dotację, jest ${poz!.wplywNaDotacjePp}`);
});

test("P3: koszt przedsięwzięcia = suma składników", () => {
  const a = uruchomAnalize(wzorcowa);
  const k = a.poziom3.scenariusze[1].koszt;
  const suma = k.grunt + k.budowa + k.uzbrojenie + k.projektPrzygotowanie + k.kosztyFinansowe + k.rezerwa;
  assert.equal(k.razem, suma);
});

test("P3+ankieta: profil finansowy steruje montażem i reżimem P3", () => {
  const bez = uruchomAnalize(wzorcowa);
  assert.equal(bez.poziom3.analizaFinansowa, null); // bez ankiety — kompatybilność wstecz

  const zAnkieta = uruchomAnalize(wzorcowa, undefined, {
    typInwestora: "SIM_GMINNY",
    typZasobu: "SPOLECZNY_CZYNSZOWY",
    rezim: "current",
    sposobWniesieniaDzialki: "APORT_GMINNY",
    wspolpracaGmina: "UMOWA_PARTNERSKA",
    efektywnoscEnergetyczna: false,
    mieszkanieNaStart: false,
    dataWniosku: "2026-05-01",
  });
  assert.ok(zAnkieta.poziom3.analizaFinansowa);
  assert.equal(zAnkieta.poziom3.analizaFinansowa!.zablokowana, false);
  // Reżim obecny → kredyt 30 lat mapowany na model P3.
  assert.equal(zAnkieta.poziom3.rezimDomyslny, "A_SBC_2026");
  assert.equal(zAnkieta.poziom3.scenariusze[1].rezim, "A_SBC_2026");
});

test("P1: flagi/sygnały i realne białe plamy", () => {
  const w = uruchomPoziom1(wzorcowa);
  // Komplet danych → brak białych plam; sygnały pozytywne (dostępność/rynek).
  assert.equal(w.braki.length, 0);
  assert.ok(w.sygnaly.some((s) => s.ton === "pozytyw"));

  const b = uruchomPoziom1(bialePlamy);
  // Brak MPZP i brak czynszu → realne braki; Natura 2000 → sygnał ostrzegawczy.
  assert.ok(b.braki.length >= 2, `braki=${b.braki.length}`);
  assert.ok(b.braki.some((x) => x.tytul.includes("MPZP")));
  assert.ok(b.braki.some((x) => x.tytul.toLowerCase().includes("najmu")));
  assert.ok(b.sygnaly.some((s) => s.ton === "ostrzezenie"));
});

test("MPZP: symbol → status planistyczny", () => {
  assert.equal(statusZeSymbolu("MW").status, "mpzp_mieszkaniowy");
  assert.equal(statusZeSymbolu("MW").sprzeczne, false);
  assert.equal(statusZeSymbolu("MW/U").status, "mpzp_mieszkaniowy");
  assert.equal(statusZeSymbolu("R").status, "sprzeczny");
  assert.equal(statusZeSymbolu("P").sprzeczne, true);
  assert.equal(statusZeSymbolu("U").status, "sprzeczny"); // usługi bez funkcji mieszkaniowej
});

test("MPZP: deklaracja wypełniającego zamyka brak planu (bez alertu)", () => {
  const bez = uruchomPoziom1(bialePlamy);
  assert.ok(bez.braki.some((b) => b.tytul.includes("MPZP"))); // przed deklaracją: brak

  const zadekl = uruchomPoziom1({ ...bialePlamy, przeznaczenieSprzeczneZMieszkaniowa: false, mpzpZadeklarowany: true });
  assert.ok(!zadekl.braki.some((b) => b.tytul.startsWith("MPZP /")));
  assert.ok(!zadekl.sygnaly.some((s) => s.tekst.includes("Brak MPZP")));
});

test("Pipeline: każdy poziom zasila następny (spójność id)", () => {
  for (const d of DZIALKI_PRZYKLADOWE) {
    const a = uruchomAnalize(d);
    assert.equal(a.poziom1.dzialkaId, d.id);
    assert.equal(a.poziom2.dzialkaId, d.id);
    assert.equal(a.poziom3.dzialkaId, d.id);
  }
});
