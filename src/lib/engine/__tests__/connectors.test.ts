/** Testy offline: przyleganie geometrii, parsery konektorów, runner (bez sieci). */

import { test } from "node:test";
import assert from "node:assert/strict";
import { czyPrzylegaja, centroid } from "../../geo";
import { wybierzJednostke, wartoscZmiennej, pierwszaZmienna } from "../../data/connectors/gus";
import { dopasujPoNazwie } from "../../data/uldk";
import { rozpoznajPrzeznaczenie, parsujMpzpJson, parsujMpzpXml, czyPustyWynik, sygnalZTekstu } from "../../data/connectors/kimpzp";
import { uruchomKonektory } from "../../data/connectors";
import type { Teren } from "../../data/connectors/types";
import { DZIALKI_PRZYKLADOWE } from "../../data/sample";
import { ocenOdpowiedzWms, znajdzWarstwe } from "../../data/connectors/wms";
import { klasyfikujPoi } from "../../data/connectors/overpass";
import { terytGminy, powiaty } from "../../teryt";
import { wartoscOdtworzeniowaDla, medianaRynkowa, drabinaRynkowa, pewnoscOfert } from "../../config-rynek";

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

test("gus: pomija jednostkę archiwalną „…do 2001\" (Warszawa) i bierze aktualną", () => {
  // BDL zwraca dla „Warszawa" najpierw jednostkę historyczną — musimy ją pominąć.
  const json = {
    results: [
      { id: "071412831001", name: "M.st.Warszawa do 2001" },
      { id: "011412865011", name: "Warszawa" },
    ],
  };
  assert.equal(wybierzJednostke(json, "Warszawa")!.id, "011412865011");
  // Nazwa rozszerzona (np. „Powiat m.st. Warszawa") też łapana przez zawieranie.
  const json2 = { results: [{ id: "9", name: "M.st.Warszawa do 2001" }, { id: "10", name: "Powiat m.st. Warszawa" }] };
  assert.equal(wybierzJednostke(json2, "Warszawa")!.id, "10");
  // Gdy w odpowiedzi są SAME archiwalne — zwracamy null, aby konektor spróbował innego
  // wyszukiwania (bez filtra poziomu) i znalazł aktualną jednostkę.
  assert.equal(wybierzJednostke({ results: [{ id: "9", name: "M.st.Warszawa do 2001" }] }, "Warszawa"), null);
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

test("kimpzp: opisy wielowyrazowe i symbole (MU/MN) → mieszkaniowy; usługowe → null", () => {
  assert.equal(rozpoznajPrzeznaczenie("Zabudowa mieszkaniowo-usługowa (MU)"), "mpzp_mieszkaniowy");
  assert.equal(rozpoznajPrzeznaczenie("Teren zabudowy mieszkaniowej jednorodzinnej MN"), "mpzp_mieszkaniowy");
  assert.equal(rozpoznajPrzeznaczenie("budynki mieszkalne wielorodzinne"), "mpzp_mieszkaniowy");
  // Sam „tereny zabudowy usługowej" (bez funkcji mieszkaniowej) nie może udawać mieszkaniowego.
  assert.equal(rozpoznajPrzeznaczenie("Tereny zabudowy usługowej U"), null);
});

test("kimpzp: parsowanie metryki GeoJSON (Rzeszów — gmina wektorowa)", () => {
  const geojson = JSON.stringify({
    type: "FeatureCollection",
    features: [
      { properties: { SYMBOL: "11MWs", S_STANDARD: "MW", OPIS: "Tereny mieszkalnictwa wielorodzinnego", STAWKA: "30", UCHWALA: "XXVIII/6/2000" } },
      { properties: { NAZWA2: "Staromieście - Ogrody", D_WEJSCIA: "2000-08-25", DZIENNIK: "Dz. Urz. ..." } },
    ],
  });
  const r = parsujMpzpJson(geojson)!;
  assert.ok(r);
  assert.equal(r.status, "mpzp_mieszkaniowy");
  assert.equal(r.meta.symbol, "11MWs");
  assert.equal(r.meta.standard, "MW");
  assert.equal(r.meta.stawkaPct, 30);
  assert.equal(r.meta.uchwala, "XXVIII/6/2000");
  assert.equal(r.meta.nazwaPlanu, "Staromieście - Ogrody");
  assert.equal(r.meta.dataWejscia, "2000-08-25");
});

test("kimpzp: pusty wynik (Warszawa — XML z pustymi ROWSET) vs GeoJSON", () => {
  const xmlPusty = '<?xml version="1.0"?>\n<GetFeatureInfo_Result>\n  <ROWSET name="MPZP_PRZEZNACZENIE_TERENU"></ROWSET>\n</GetFeatureInfo_Result>';
  assert.equal(czyPustyWynik(xmlPusty), true);
  assert.equal(parsujMpzpJson(xmlPusty), null); // nie-JSON → brak metryki
  assert.equal(czyPustyWynik('{"type":"FeatureCollection","features":[]}'), true);
  assert.equal(czyPustyWynik('{"features":[{"properties":{"SYMBOL":"MW"}}]}'), false);
});

test("kimpzp: sygnał pokrycia — rozróżnia brak serwisu (dziura) od braku planu (pokryte)", () => {
  // Realne komunikaty z sondy pokrycia:
  assert.equal(sygnalZTekstu("brak serwisu dla wskazanego obszaru").sygnal, "brak_serwisu"); // Gdańsk → dziura
  assert.equal(sygnalZTekstu("m. Wrocław: brak wyniku dla wskazanego obszaru").sygnal, "serwis_bez_planu"); // Wrocław → pokryte
  assert.equal(
    sygnalZTekstu('<ServiceExceptionReport><ServiceException code="InvalidXslTemplate">Can\'t template xml document.</ServiceException></ServiceExceptionReport>').sygnal,
    "blad_serwisu"
  ); // Kraków → dziura funkcjonalna
  assert.equal(sygnalZTekstu('<GetFeatureInfo_Result><ROWSET name="MPZP_PRZEZNACZENIE_TERENU"></ROWSET></GetFeatureInfo_Result>').sygnal, "pusto"); // pusty ROWSET (bez wierszy)
  assert.equal(sygnalZTekstu('{"features":[{"properties":{"SYMBOL":"11MWs","S_STANDARD":"MW"}}]}').sygnal, "plan"); // Rzeszów (działka)
  // Pusty, poprawny GeoJSON = serwis wektorowy odpowiedział → POKRYTE (Rzeszów/Gorzów/Radom — centrum poza planem).
  assert.equal(sygnalZTekstu('{"features": [], "type": "FeatureCollection"}').sygnal, "serwis_bez_planu");
  assert.equal(sygnalZTekstu('{"type":"FeatureCollection","features":[],"numberReturned":0,"crs":null}').sygnal, "serwis_bez_planu");
  assert.equal(sygnalZTekstu(null).sygnal, "blad");
});

test("kimpzp: Warszawa — XML ROWSET z wierszem to PLAN (pokryte), nie pusto", () => {
  // Realna odpowiedź KIMPZP dla centrum Warszawy (schemat MPZP_PRZEZNACZENIE_TERENU).
  const warszawa =
    '<?xml version="1.0" encoding="UTF-8"?>\n<GetFeatureInfo_Result>\n  <ROWSET name="MPZP_PRZEZNACZENIE_TERENU">\n    <ROW num="1">\n      <INTEN_ZAB> </INTEN_ZAB>\n      <MAX_WYS>12</MAX_WYS>\n      <FUN_NAZWA>zabudowa mieszkaniowa wielorodzinna</FUN_NAZWA>\n      <FUN_SYMB>3.MW</FUN_SYMB>\n      <DZIELNICA>Śródmieście</DZIELNICA>\n      <NAZWA_PLAN>otoczenie PKiN</NAZWA_PLAN>\n      <WWW>../dane/plany/9.07.html</WWW>\n    </ROW>\n  </ROWSET>\n</GetFeatureInfo_Result>';
  assert.equal(czyPustyWynik(warszawa), false); // ROWSET z wierszem NIE jest pusty
  const r = parsujMpzpXml(warszawa)!;
  assert.ok(r);
  assert.equal(r.meta.symbol, "3.MW");
  assert.equal(r.meta.nazwaPlanu, "otoczenie PKiN");
  assert.equal(r.meta.maxWysokoscM, "12");
  assert.equal(r.meta.jednostka, "Śródmieście");
  assert.equal(r.status, "mpzp_mieszkaniowy"); // MW + „mieszkaniowa" → mieszkaniowy
  assert.equal(sygnalZTekstu(warszawa).sygnal, "plan"); // → POKRYTE

  // A „droga zbiorcza / 1.KDZ" (jak realny punkt PKiN) → sprzeczny, ale wciąż PLAN (pokryte).
  const droga = warszawa.replace("zabudowa mieszkaniowa wielorodzinna", "droga zbiorcza").replace("3.MW", "1.KDZ");
  assert.equal(parsujMpzpXml(droga)!.status, "sprzeczny");
  assert.equal(sygnalZTekstu(droga).sygnal, "plan"); // serwis odpowiada → pokryte
});

test("wms: ocena odpowiedzi GetFeatureInfo (obecny/pusty/błąd)", () => {
  assert.equal(ocenOdpowiedzWms('{"type":"FeatureCollection","features":[{"x":1}]}'), "obecny");
  assert.equal(ocenOdpowiedzWms('{"type":"FeatureCollection","features":[]}'), "pusty");
  assert.equal(ocenOdpowiedzWms("<ServiceExceptionReport><ServiceException>Layer not defined</ServiceException></ServiceExceptionReport>"), "blad");
  assert.equal(ocenOdpowiedzWms("<wfs:FeatureCollection><gml:featureMember/></wfs:FeatureCollection>"), "obecny");
  // Strona anti-bot (Incapsula) i HTML nie mogą udawać „pusto".
  assert.equal(ocenOdpowiedzWms('<html><head><script src="/_Incapsula_Resource?SWJIYLWA=x"></script></head></html>'), "blad");
  assert.equal(ocenOdpowiedzWms("<!doctype html><html><body>403</body></html>"), "blad");
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

test("wms: odkrycie warstwy z GetCapabilities po słowie kluczowym", () => {
  const caps = `<WMS_Capabilities><Layer><Name>warstwa_a</Name><Title>Coś innego</Title></Layer>
    <Layer><Name>osuwiska_sopo</Name><Title>Osuwiska (SOPO)</Title></Layer></WMS_Capabilities>`;
  assert.equal(znajdzWarstwe(caps, "osuwisk"), "osuwiska_sopo");
  assert.equal(znajdzWarstwe(caps, "natura 2000"), null);
});

test("teryt: pełny słownik — Głuchołazy (obszar wiejski) = 160701_5", () => {
  assert.equal(terytGminy("opolskie", "nyski", "Głuchołazy (obszar wiejski)"), "160701_5");
  assert.ok(powiaty("opolskie").includes("nyski"));
  assert.ok(powiaty("mazowieckie").length > 30); // pełny słownik, nie mini
});

test("M3: wartość odtworzeniowa — miasto wojewódzkie vs reszta", () => {
  const stolica = wartoscOdtworzeniowaDla("opolskie", "Opole");
  const wies = wartoscOdtworzeniowaDla("opolskie", "Głuchołazy (obszar wiejski)");
  assert.equal(stolica.obszar, "miasto wojewódzkie");
  assert.equal(wies.obszar, "reszta województwa");
  assert.ok(stolica.wartosc > wies.wartosc);
});

test("M3: mediana rynkowa zwraca czynsz i cenę dla województwa", () => {
  const m = medianaRynkowa("mazowieckie");
  assert.ok(m.czynsz > 0 && m.cenaNowych > 0);
});

test("rynek: drabina przestrzenna — brak ofert lokalnych → fallback wojewódzki (N=0)", () => {
  const d = drabinaRynkowa("mazowieckie", "Warszawa", "Warszawa");
  assert.equal(d.poziom, "wojewodztwo");
  assert.equal(d.n, 0);
  assert.equal(pewnoscOfert(d.n), 45); // niewystarczające
});

test("rynek: drabina schodzi do najniższego szczebla z wystarczającą próbą", () => {
  // Symulacja źródła ofert: gmina ma 12 ofert (szacunek), powiat 40 (wiarygodne).
  const proba = (poziom: string) =>
    poziom === "gmina" ? { czynsz: 55, cenaNowych: 12000, n: 12 } : poziom === "powiat" ? { czynsz: 50, cenaNowych: 11000, n: 40 } : null;
  const d = drabinaRynkowa("mazowieckie", "X", "Y", proba as never);
  assert.equal(d.poziom, "gmina"); // najniższy z N≥10 wygrywa
  assert.equal(d.n, 12);
  assert.equal(pewnoscOfert(40), 85); // ≥30 → wiarygodne
  assert.equal(pewnoscOfert(12), 60); // 10–29 → szacunek
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
