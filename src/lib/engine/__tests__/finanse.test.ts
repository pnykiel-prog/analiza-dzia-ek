/** Testy ankiety finansowej: filtr zasobów, walidacja, reżim z daty, montaż, porównanie. */

import { test } from "node:test";
import assert from "node:assert/strict";
import {
  dostepneZasoby,
  sugerujRezim,
  walidujUprawnienia,
  zlozMontaz,
  porownajRezimy,
} from "../../finanse";
import type { ProfilFinansowy } from "../../finanse";

const profil = (p: Partial<ProfilFinansowy>): ProfilFinansowy => ({
  typInwestora: "SIM_GMINNY",
  typZasobu: "SPOLECZNY_CZYNSZOWY",
  rezim: "current",
  sposobWniesieniaDzialki: "APORT_GMINNY",
  wspolpracaGmina: "UMOWA_PARTNERSKA",
  efektywnoscEnergetyczna: false,
  mieszkanieNaStart: false,
  dataWniosku: "2026-06-01",
  ...p,
});

test("dostepneZasoby: SIM prywatny (current) — tylko społeczny czynszowy, reszta 'brak' ukryta", () => {
  const opcje = dostepneZasoby("current", "SIM_PRYWATNY");
  assert.deepEqual(opcje, [{ zasob: "SPOLECZNY_CZYNSZOWY", dostep: "pełen" }]);
});

test("dostepneZasoby: GMINA (current) — socjalny+komunalny 'pełen', bez społ. czynszowego", () => {
  const z = dostepneZasoby("current", "GMINA").map((o) => o.zasob);
  assert.ok(z.includes("SOCJALNY") && z.includes("KOMUNALNY"));
  assert.ok(!z.includes("SPOLECZNY_CZYNSZOWY"));
});

test("walidacja: 'brak' blokuje (SIM prywatny → komunalny)", () => {
  const w = walidujUprawnienia(profil({ typInwestora: "SIM_PRYWATNY", typZasobu: "KOMUNALNY" }));
  assert.equal(w.zablokowana, true);
  assert.equal(w.dostep, "brak");
  assert.ok(w.ostrzezenia[0].includes("nie może tworzyć"));
});

test("walidacja: 'ograniczony' przechodzi z ostrzeżeniem (SIM gminny → socjalny)", () => {
  const w = walidujUprawnienia(profil({ typInwestora: "SIM_GMINNY", typZasobu: "SOCJALNY" }));
  assert.equal(w.zablokowana, false);
  assert.equal(w.dostep, "ograniczony");
  assert.ok(w.ostrzezenia.length > 0);
});

test("sugerujRezim: data steruje reżimem i oknem przejściowym", () => {
  assert.equal(sugerujRezim("2026-05-01").rezim, "current");
  assert.equal(sugerujRezim("2026-05-01").oknoPrzejsciowe, false);
  assert.equal(sugerujRezim("2027-09-01").rezim, "current");
  assert.equal(sugerujRezim("2027-09-01").oknoPrzejsciowe, true);
  assert.equal(sugerujRezim("2030-01-01").rezim, "future");
});

test("montaż: zablokowany zasób → pusty montaż, flaga zablokowana", () => {
  const a = zlozMontaz(profil({ typInwestora: "SIM_PRYWATNY", typZasobu: "SOCJALNY" }));
  assert.equal(a.zablokowana, true);
  assert.equal(a.montaz.length, 0);
  assert.equal(a.kredyt, null);
});

test("montaż: SIM gminny społ. czynszowy (current) — grant BSK 20–35%, kredyt SBC 80% obejmuje grunt", () => {
  const a = zlozMontaz(profil({ typInwestora: "SIM_GMINNY", typZasobu: "SPOLECZNY_CZYNSZOWY", rezim: "current" }));
  const grant = a.montaz.find((m) => m.klucz === "grant")!;
  const kredyt = a.montaz.find((m) => m.klucz === "kredyt")!;
  assert.ok(grant.udzialPct.min >= 20 && grant.udzialPct.max <= 35);
  assert.equal(kredyt.udzialPct.max, 80);
  assert.equal(a.kredyt!.pokrywaGrunt, true);
  assert.equal(a.kredyt!.okresLat, 30);
  assert.equal(a.kredyt!.typStopy, "zmienne");
  // Reguła #1 zawsze obecna.
  assert.ok(a.ostrzezenia.some((o) => o.includes("Grant nie finansuje nabycia gruntu")));
});

test("montaż: SIM prywatny społ. czynszowy — reżim odwraca dostęp do grantu (current trudny → future bezpośredni)", () => {
  const teraz = zlozMontaz(profil({ typInwestora: "SIM_PRYWATNY", rezim: "current", wspolpracaGmina: "UMOWA_PARTNERSKA" }));
  const przyszly = zlozMontaz(profil({ typInwestora: "SIM_PRYWATNY", rezim: "future", dataWniosku: "2030-01-01" }));
  assert.ok(teraz.ostrzezenia.some((o) => o.includes("trudno dostępny")));
  // Przyszły reżim: kredyt 50 lat, stała stopa, flagi tbc.
  assert.equal(przyszly.kredyt!.okresLat, 50);
  assert.equal(przyszly.kredyt!.typStopy, "stałe");
  assert.ok(przyszly.flagiTbc.length > 0);
  assert.ok(przyszly.montaz.some((m) => m.klucz === "kredyt" && m.tbc));
});

test("montaż: partycypacja spada 30% (current) → 10% (future) dla społ. czynszowego", () => {
  const c = zlozMontaz(profil({ rezim: "current" }));
  const f = zlozMontaz(profil({ rezim: "future", dataWniosku: "2030-01-01" }));
  assert.equal(c.montaz.find((m) => m.klucz === "partycypacja")!.udzialPct.max, 30);
  assert.equal(f.montaz.find((m) => m.klucz === "partycypacja")!.udzialPct.max, 10);
});

test("montaż: Q1b nowy podmiot → gwarancja InvestEU, kredyt ≤70% CAPEX", () => {
  const a = zlozMontaz(profil({ typInwestora: "SIM_PRYWATNY", rezim: "current", nowyPodmiot: true }));
  assert.ok(a.instrumenty.some((i) => i.id === "INVESTEU_GWARANCJA"));
  assert.equal(a.kredyt!.maxUdzialCapexPct.max, 70);
});

test("montaż: efektywność energetyczna (Q6) dokłada FEnIKS+OZE do grantu", () => {
  const bez = zlozMontaz(profil({ typInwestora: "SIM_GMINNY", efektywnoscEnergetyczna: false }));
  const zEE = zlozMontaz(profil({ typInwestora: "SIM_GMINNY", efektywnoscEnergetyczna: true }));
  const gBez = bez.montaz.find((m) => m.klucz === "grant")!.udzialPct.max;
  const gEE = zEE.montaz.find((m) => m.klucz === "grant")!.udzialPct.max;
  assert.ok(gEE > gBez); // ~+22% FEnIKS +4,5% OZE
});

test("montaż: gmina komunalny (current) — brak kredytu, wymagany kapitał własny, grant 50–85%", () => {
  const a = zlozMontaz(profil({ typInwestora: "GMINA", typZasobu: "KOMUNALNY", rezim: "current", wspolpracaGmina: "BRAK" }));
  assert.equal(a.kredyt, null);
  assert.ok(a.montaz.some((m) => m.klucz === "kapital_wlasny"));
  const grant = a.montaz.find((m) => m.klucz === "grant")!;
  assert.ok(grant.udzialPct.min >= 50 && grant.udzialPct.max <= 85);
});

test("montaż: bez gotowego stacku (SPOLKA_GMINNA komunalny) — złożenie z instrumentów", () => {
  const a = zlozMontaz(profil({ typInwestora: "SPOLKA_GMINNA", typZasobu: "KOMUNALNY", rezim: "current" }));
  assert.equal(a.zablokowana, false);
  assert.ok(a.montaz.some((m) => m.klucz === "grant"));
});

test("montaż: aport gminny → ostrzeżenie, że grunt poza bazą finansowania", () => {
  const a = zlozMontaz(profil({ sposobWniesieniaDzialki: "APORT_GMINNY" }));
  assert.ok(a.traktowanieGruntu.toLowerCase().includes("aport"));
  assert.ok(a.ostrzezenia.some((o) => o.toLowerCase().includes("aport gminny")));
});

test("porównanie reżimów: obsługa długu spada, partycypacja i wykup w dół", () => {
  const p = porownajRezimy(profil({ typInwestora: "SIM_PRYWATNY" }));
  assert.ok(p.obslugaDluguNa1MlnPln.obecny > p.obslugaDluguNa1MlnPln.nowy2pct);
  assert.equal(p.roznice.okresKredytuLata.obecny, 30);
  assert.equal(p.roznice.okresKredytuLata.nowy, 50);
  assert.equal(p.roznice.wykupZGrantem.nowy, false);
  assert.ok(p.komentarz.length > 0);
});
