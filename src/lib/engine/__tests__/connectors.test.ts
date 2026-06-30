/** Testy offline: przyleganie geometrii, parsery konektorów, runner (bez sieci). */

import { test } from "node:test";
import assert from "node:assert/strict";
import { czyPrzylegaja, centroid } from "../../geo";
import { wybierzJednostke, wartoscZmiennej, pierwszaZmienna } from "../../data/connectors/gus";
import { dopasujPoNazwie } from "../../data/uldk";
import { rozpoznajPrzeznaczenie } from "../../data/connectors/kimpzp";
import { uruchomKonektory } from "../../data/connectors";
import type { Teren } from "../../data/connectors/types";
import { DZIALKI_PRZYKLADOWE } from "../../data/sample";
import { ocenOdpowiedzWms } from "../../data/connectors/wms";
import { klasyfikujPoi } from "../../data/connectors/overpass";

const KW = (x0: number, y0: number, b: number) =>
  `POLYGON((${x0} ${y0},${x0 + b} ${y0},${x0 + b} ${y0 + b},${x0} ${y0 + b},${x0} ${y0}))`;

test("geo: przyleganie — dwa stykające się kwadraty = spójny blok", () => {
  assert.equal(czyPrzylegaja([KW(0, 0, 100), KW(100, 0, 100)]), true);
});

test("geo: przyleganie — trzy w rzędzie spójne; jeden odległy niespójny", () => {
  assert.equal(czyPrzylegaja([KW(0, 0, 100), KW(100, 0, 100), KW(200, 0, 100)]), true);
  assert.equal(czyPrzylegaja([KW(0, 0, 100), KW(100, 0, 100), KW(5000, 5000, 100)]), false);
});

test("geo: centroid kwadratu", () => {
  const c = centroid(KW(0, 0, 100))!;
  assert.ok(Math.abs(c[0] - 50) < 1 && Math.abs(c[1] - 50) < 1);
});

test("gus: wybór jednostki po nazwie (dokładne dopasowanie)", () => {
  const json = { results: [{ id: "1", name: "Kórnik" }, { id: "2", name: "Kórnik - obszar wiejski" }] };
  assert.equal(wybierzJednostke(json, "Kórnik")!.id, "1");
  assert.equal(wybierzJednostke({ results: [] }, "X"), null);
});

test("gus: wartość zmiennej (rok lub najnowsza)", () => {
  const json = { results: [{ values: [{ year: 2021, val: 10 }, { year: 2023, val: 12 }] }] };
  assert.equal(wartoscZmiennej(json, 2021), 10);
  assert.equal(wartoscZmiennej(json), 12); // najnowsza
  assert.equal(wartoscZmiennej({}), null);
});

test("gus: pierwsza zmienna z variables/search", () => {
  assert.equal(pierwszaZmienna({ results: [{ id: 4321 }, { id: 9 }] }), "4321");
  assert.equal(pierwszaZmienna({ results: [] }), null);
});

test("uldk: dopasowanie po nazwie bez wielkości liter (głuchołazy → Głuchołazy)", () => {
  const opcje = [{ teryt: "160707_3", nazwa: "Głuchołazy" }, { teryt: "160701_1", nazwa: "Nysa" }];
  assert.equal(dopasujPoNazwie(opcje, "głuchołazy")!.teryt, "160707_3");
  assert.equal(dopasujPoNazwie(opcje, "nys")!.teryt, "160701_1");
  assert.equal(dopasujPoNazwie(opcje, "xxx"), null);
});

test("kimpzp: rozpoznanie przeznaczenia z tekstu", () => {
  assert.equal(rozpoznajPrzeznaczenie("Teren zabudowy mieszkaniowej MW"), "mpzp_mieszkaniowy");
  assert.equal(rozpoznajPrzeznaczenie("Tereny przemysłowe"), "sprzeczny");
  assert.equal(rozpoznajPrzeznaczenie(""), null);
});

test("wms: ocena odpowiedzi GetFeatureInfo (obecny/pusty/błąd)", () => {
  assert.equal(ocenOdpowiedzWms('{"type":"FeatureCollection","features":[{"x":1}]}'), "obecny");
  assert.equal(ocenOdpowiedzWms('{"type":"FeatureCollection","features":[]}'), "pusty");
  assert.equal(ocenOdpowiedzWms("<ServiceExceptionReport><ServiceException>Layer not defined</ServiceException></ServiceExceptionReport>"), "blad");
  assert.equal(ocenOdpowiedzWms("<wfs:FeatureCollection><gml:featureMember/></wfs:FeatureCollection>"), "obecny");
});

test("overpass: klasyfikacja POI do proxy W3", () => {
  const k = klasyfikujPoi([
    { tags: { highway: "bus_stop" } },
    { tags: { shop: "supermarket" } },
    { tags: { amenity: "pharmacy" } },
    { tags: { amenity: "school" } },
  ]);
  assert.deepEqual(k, { przystanek: true, uslugi: true, poz: true, szkola: true });
  assert.deepEqual(klasyfikujPoi([{ tags: { building: "yes" } }]), { przystanek: false, uslugi: false, poz: false, szkola: false });
});

test("runner: brak konfiguracji/geometrii → status brak, raport pełny, bez wyjątku", async () => {
  const teren: Teren = {
    id: "X.1", teryt: "", wojewodztwo: "mazowieckie", powiat: "p", gmina: "g",
    centroid2180: null, centroid4326: null, wktList: [], powierzchniaM2: 1000,
  };
  const r = await uruchomKonektory(teren, DZIALKI_PRZYKLADOWE[0]);
  assert.equal(r.raport.length >= 4, true); // GUS + KIMPZP + WMS + Overpass
  assert.deepEqual(r.dane, {}); // brak geometrii/konfiguracji → nic nie wypełniono
});
