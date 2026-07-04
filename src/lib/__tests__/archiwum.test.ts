/** Testy logiki archiwum (podsumowanie / upsert / usuwanie) — czyste, offline. */

import { test } from "node:test";
import assert from "node:assert/strict";
import { podsumujWynik, upsert, usun, type WpisArchiwum } from "../archiwum";
import { uruchomAnalize } from "../engine";
import { DZIALKI_PRZYKLADOWE } from "../data/sample";

const wynik = uruchomAnalize(DZIALKI_PRZYKLADOWE[0]);

test("podsumujWynik: przenosi kluczowe pola i zachowuje pełny wynik", () => {
  const w = podsumujWynik(wynik, "2026-07-04T10:00:00.000Z");
  assert.equal(w.id, wynik.dane.id);
  assert.equal(w.identyfikator, wynik.dane.id);
  assert.equal(w.gmina, wynik.dane.gmina);
  assert.equal(w.powierzchniaM2, wynik.dane.powierzchniaM2);
  assert.equal(w.profilP1, wynik.poziom1.profilRekomendowany);
  assert.equal(w.werdyktP1, wynik.poziom1.werdykt);
  assert.equal(w.rekomendacjaM2, wynik.poziom2.ocenaM2.rekomendacja);
  assert.equal(w.zapisano, "2026-07-04T10:00:00.000Z");
  assert.equal(w.wynik.dane.id, wynik.dane.id); // pełny wynik do ponownego renderu
});

test("upsert: nadpisuje wpis o tym samym id, nie duplikuje", () => {
  const a = podsumujWynik(wynik, "2026-07-01T00:00:00.000Z");
  const b = { ...podsumujWynik(wynik, "2026-07-02T00:00:00.000Z"), gmina: "Nowa" };
  const lista = upsert(upsert([], a), b);
  assert.equal(lista.length, 1);
  assert.equal(lista[0].gmina, "Nowa"); // nowszy nadpisał
  assert.equal(lista[0].zapisano, "2026-07-02T00:00:00.000Z");
});

test("upsert: sortuje najnowszymi na górze", () => {
  const stary: WpisArchiwum = { ...podsumujWynik(wynik, "2026-01-01T00:00:00.000Z"), id: "stary", identyfikator: "stary" };
  const nowy: WpisArchiwum = { ...podsumujWynik(wynik, "2026-06-01T00:00:00.000Z"), id: "nowy", identyfikator: "nowy" };
  const lista = upsert(upsert([], stary), nowy);
  assert.equal(lista[0].id, "nowy");
  assert.equal(lista[1].id, "stary");
});

test("usun: usuwa po id, resztę zostawia", () => {
  const a: WpisArchiwum = { ...podsumujWynik(wynik, "2026-01-01T00:00:00.000Z"), id: "a", identyfikator: "a" };
  const b: WpisArchiwum = { ...podsumujWynik(wynik, "2026-02-01T00:00:00.000Z"), id: "b", identyfikator: "b" };
  const lista = usun([a, b], "a");
  assert.equal(lista.length, 1);
  assert.equal(lista[0].id, "b");
});
