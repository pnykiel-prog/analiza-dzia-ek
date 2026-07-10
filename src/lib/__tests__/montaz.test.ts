/** Testy jednego silnika montażu M3 (grant wg zasobu, wkład domykający) — offline. */

import { test } from "node:test";
import assert from "node:assert/strict";
import { zlozKolumne, przekrojMontazu, rolaZeSposobu, type WejscieMontazu } from "../finanse/montaz";
import type { ProfilFinansowy, TypZasobu, TypInwestora, SposobWniesieniaDzialki } from "../finanse/typy";

function profil(over: Partial<ProfilFinansowy> = {}): ProfilFinansowy {
  return {
    typInwestora: "SIM_GMINNY" as TypInwestora,
    typZasobu: "KOMUNALNY" as TypZasobu,
    rezim: "current",
    sposobWniesieniaDzialki: "JUZ_POSIADANA" as SposobWniesieniaDzialki,
    wspolpracaGmina: "UMOWA_PARTNERSKA",
    efektywnoscEnergetyczna: false,
    mieszkanieNaStart: false,
    dataWniosku: "2026-06-01",
    ...over,
  };
}

function wej(over: Partial<WejscieMontazu> = {}): WejscieMontazu {
  return {
    kosztBudowyM2: 9500,
    powierzchniaBudowyM2: 60000,
    pumMieszkalnaM2: 44000,
    wartoscOdtworzeniowaM2: 7000,
    wartoscDzialkiPln: 2_000_000,
    rolaDzialki: "neutralna",
    uzbrojeniePln: 150_000,
    ...over,
  };
}

test("montaż: komunalny (SIM gminny) → grant wg zasobu ~68%, wkład własny kilka % (nie 39%)", () => {
  const k = zlozKolumne(profil(), "current", wej());
  assert.ok(k.dostepny);
  assert.ok(k.zalozenia.grantPct >= 55 && k.zalozenia.grantPct <= 80, `grant komunalny ~68%, jest ${k.zalozenia.grantPct}`);
  const udzialWklad = k.zrodla.wkladWlasny / k.koszt.razem;
  assert.ok(udzialWklad < 0.15, `wkład własny komunalnego powinien być kilka %, jest ${Math.round(udzialWklad * 100)}%`);
});

test("montaż: społeczny czynszowy → grant niski (~20–35%), partycypacja przysługuje (>0)", () => {
  const k = zlozKolumne(profil({ typZasobu: "SPOLECZNY_CZYNSZOWY" }), "current", wej());
  assert.ok(k.zalozenia.grantPct <= 40, `grant społ. czynszowego niski, jest ${k.zalozenia.grantPct}`);
  assert.ok(k.zrodla.partycypacjaNajemcow > 0, "partycypacja przysługuje przy społecznym czynszowym");
});

test("montaż: prywatny SIM + społ. czynszowy + umowa z gminą → grant 20% baza (nie 10%)", () => {
  const k = zlozKolumne(
    profil({ typInwestora: "SIM_PRYWATNY", typZasobu: "SPOLECZNY_CZYNSZOWY", wspolpracaGmina: "UMOWA_PARTNERSKA", efektywnoscEnergetyczna: false }),
    "current",
    wej()
  );
  assert.equal(Math.round(k.zalozenia.grantPct), 20, `dotacja przez gminę = baza 20%, jest ${k.zalozenia.grantPct}`);
});

test("montaż: prywatny SIM + społ. czynszowy + umowa + efektywność → grant do 35%", () => {
  const k = zlozKolumne(
    profil({ typInwestora: "SIM_PRYWATNY", typZasobu: "SPOLECZNY_CZYNSZOWY", wspolpracaGmina: "UMOWA_PARTNERSKA", efektywnoscEnergetyczna: true }),
    "current",
    wej()
  );
  assert.equal(Math.round(k.zalozenia.grantPct), 35, `warunki efektywności → 35%, jest ${k.zalozenia.grantPct}`);
});

test("montaż: prywatny SIM + społ. czynszowy BEZ umowy z gminą → niższy dostęp (< 20%)", () => {
  const zUmowa = zlozKolumne(
    profil({ typInwestora: "SIM_PRYWATNY", typZasobu: "SPOLECZNY_CZYNSZOWY", wspolpracaGmina: "UMOWA_PARTNERSKA" }),
    "current",
    wej()
  );
  const bezUmowy = zlozKolumne(
    profil({ typInwestora: "SIM_PRYWATNY", typZasobu: "SPOLECZNY_CZYNSZOWY", wspolpracaGmina: "BRAK" }),
    "current",
    wej()
  );
  assert.ok(bezUmowy.zalozenia.grantPct < 20, `bez umowy zostaje przy niższym dostępie, jest ${bezUmowy.zalozenia.grantPct}`);
  assert.ok(bezUmowy.zalozenia.grantPct < zUmowa.zalozenia.grantPct, "umowa z gminą podnosi stawkę");
});

test("montaż: reżim przyszły + społ. czynszowy → droga do 35% (efektywność podnosi z 20)", () => {
  const bez = zlozKolumne(profil({ typZasobu: "SPOLECZNY_CZYNSZOWY", rezim: "future", efektywnoscEnergetyczna: false }), "future", wej());
  const zEf = zlozKolumne(profil({ typZasobu: "SPOLECZNY_CZYNSZOWY", rezim: "future", efektywnoscEnergetyczna: true }), "future", wej());
  assert.equal(Math.round(bez.zalozenia.grantPct), 20, `przyszły baza 20%, jest ${bez.zalozenia.grantPct}`);
  assert.equal(Math.round(zEf.zalozenia.grantPct), 35, `przyszły z efektywnością → 35%, jest ${zEf.zalozenia.grantPct}`);
});

test("montaż: partycypacja auto = 0 dla komunalnego (nie przysługuje)", () => {
  const k = zlozKolumne(profil({ typZasobu: "KOMUNALNY" }), "current", wej());
  assert.equal(k.zrodla.partycypacjaNajemcow, 0);
});

test("montaż: źródła sumują się do kosztu, wkład własny ≥ 0", () => {
  const k = zlozKolumne(profil(), "current", wej());
  const s = k.zrodla;
  const suma = s.grant + s.kredyt + s.aport + s.partycypacjaNajemcow + s.wkladWlasny;
  assert.equal(suma, k.koszt.razem);
  assert.ok(s.wkladWlasny >= 0);
});

test("montaż: aport → działka po stronie źródeł, obniża wkład własny", () => {
  const bez = zlozKolumne(profil(), "current", wej({ rolaDzialki: "neutralna" }));
  const zAportem = zlozKolumne(profil({ sposobWniesieniaDzialki: "APORT_GMINNY" }), "current", wej({ rolaDzialki: "zrodlo" }));
  assert.equal(zAportem.zrodla.aport, 2_000_000);
  assert.ok(zAportem.zrodla.wkladWlasny <= bez.zrodla.wkladWlasny);
});

test("montaż: przekrój obu reżimów — komunalny ma wysoki grant w obu (nie 35/15)", () => {
  const p = przekrojMontazu(profil(), wej());
  assert.ok(p.obecny.zalozenia.grantPct >= 55, `obecny komunalny grant, jest ${p.obecny.zalozenia.grantPct}`);
  assert.ok(p.przyszly.zalozenia.grantPct >= 55, `przyszły komunalny grant, jest ${p.przyszly.zalozenia.grantPct}`);
});

test("montaż: zdolność kredytowa TYLKO z czynszu (bez kosztów operacyjnych) + wyższa WO → wyższy kredyt", () => {
  // Społeczny czynszowy: grant niski → luka duża → kredyt wiąże zdolność, nie luka (widać wrażliwość na WO).
  const niska = zlozKolumne(profil({ typZasobu: "SPOLECZNY_CZYNSZOWY" }), "current", wej({ wartoscOdtworzeniowaM2: 5000 }));
  const wysoka = zlozKolumne(profil({ typZasobu: "SPOLECZNY_CZYNSZOWY" }), "current", wej({ wartoscOdtworzeniowaM2: 9000 }));
  assert.ok(wysoka.zrodla.kredyt > niska.zrodla.kredyt, "wyższa WO → wyższa zdolność czynszowa → wyższy kredyt");
});

test("montaż: kredyt maksymalizowany — komunalny grant+kredyt domykają koszt, wkład ~0", () => {
  const k = zlozKolumne(profil({ typZasobu: "KOMUNALNY" }), "current", wej({ wartoscOdtworzeniowaM2: 7018 }));
  const pokrycie = (k.zrodla.grant + k.zrodla.kredyt) / k.koszt.razem;
  assert.ok(pokrycie > 0.95, `grant+kredyt powinny domknąć koszt, jest ${Math.round(pokrycie * 100)}%`);
});

test("montaż: override oprocentowania obniża kredyt (niższa stopa = wyższa rata? nie — wyższa stopa niższy kredyt)", () => {
  const tanie = zlozKolumne(profil({ typZasobu: "SPOLECZNY_CZYNSZOWY" }), "current", wej({ wartoscOdtworzeniowaM2: 9000, oprocOverride: 0.02 }));
  const drogie = zlozKolumne(profil({ typZasobu: "SPOLECZNY_CZYNSZOWY" }), "current", wej({ wartoscOdtworzeniowaM2: 9000, oprocOverride: 0.05 }));
  assert.ok(tanie.zrodla.kredyt >= drogie.zrodla.kredyt, "niższe oprocentowanie → większa zdolność kredytowa");
});

test("montaż: forma współpracy neutralna dla wyniku (ZAPORA) — poza LzG/ZPI nie rusza liczb", () => {
  // SIM gminny komunalny: dozwolone współprace to aport/udział/brak — żadna nie jest LzG/ZPI,
  // a podmiot jest gminny (dostęp do grantu niezależny od współpracy) → montaż identyczny.
  const wariacje: Array<ProfilFinansowy["wspolpracaGmina"]> = ["APORT", "UDZIAL_KAPITALOWY", "BRAK"];
  const zrodla = wariacje.map((w) => JSON.stringify(zlozKolumne(profil({ typZasobu: "KOMUNALNY", wspolpracaGmina: w }), "current", wej()).zrodla));
  for (const s of zrodla) assert.equal(s, zrodla[0], "przełączenie współpracy nie rusza źródeł montażu");
});

test("montaż: LzG/ZPI podnoszą grant komunalny w reżimie przyszłym (jedyny dozwolony wpływ)", () => {
  const bez = zlozKolumne(profil({ typZasobu: "KOMUNALNY", wspolpracaGmina: "BRAK", sposobWniesieniaDzialki: "JUZ_POSIADANA" }), "future", wej());
  const zpi = zlozKolumne(profil({ typZasobu: "KOMUNALNY", wspolpracaGmina: "ZPI", sposobWniesieniaDzialki: "JUZ_POSIADANA" }), "future", wej());
  assert.ok(zpi.zalozenia.grantPct >= bez.zalozenia.grantPct, "ZPI odblokowuje max grant komunalny (przyszły)");
});

test("montaż: rola działki ze sposobu wniesienia", () => {
  assert.equal(rolaZeSposobu("ZAKUP_KREDYT"), "koszt");
  assert.equal(rolaZeSposobu("APORT_GMINNY"), "zrodlo");
  assert.equal(rolaZeSposobu("JUZ_POSIADANA"), "neutralna");
});

test("montaz (6): skrajnie wysoki wklad wlasny daje flage (miekkie sprzezenie, bez tworzenia komunikatu odrzucenia)", () => {
  // Społeczny czynszowy, zakup gruntu na kredyt, niska WO → duża luka, wysoki wkład.
  const k = zlozKolumne(
    profil({ typZasobu: "SPOLECZNY_CZYNSZOWY", typInwestora: "SIM_PRYWATNY", sposobWniesieniaDzialki: "ZAKUP_KREDYT" }),
    "current",
    wej({ rolaDzialki: "koszt", wartoscDzialkiPln: 6_000_000, wartoscOdtworzeniowaM2: 4000 })
  );
  const udzial = k.zrodla.wkladWlasny / k.koszt.razem;
  if (udzial > 0.45) {
    assert.ok(k.flagi.some((f) => f.includes("wysokiego wkładu")), `oczekiwano flagi wkładu przy udziale ${Math.round(udzial * 100)}%`);
    // Miękkie sprzężenie: flaga mówi wprost „rekomendacja warunkowa", a montaż i tak się liczy (dostępny).
    assert.ok(k.dostepny && k.zrodla.wkladWlasny >= 0);
  }
});

test("montaż (5.1): grant liczony od kosztów BEZ gruntu — zakup nie zawyża dotacji", () => {
  // Zakup na kredyt: grunt = koszt. Grant NIE finansuje gruntu → baza = RAZEM − grunt.
  const zakup = zlozKolumne(profil({ typZasobu: "KOMUNALNY", sposobWniesieniaDzialki: "ZAKUP_KREDYT" }), "current", wej({ rolaDzialki: "koszt", wartoscDzialkiPln: 2_000_000 }));
  assert.ok(zakup.koszt.grunt > 0, "grunt w koszcie przy zakupie");
  const grantPct = zakup.zalozenia.grantPct / 100;
  const bazaKwal = zakup.koszt.razem - zakup.koszt.grunt;
  // Grant ≤ grant% × (RAZEM − grunt) (koszty kwalifikowane), z tolerancją zaokrągleń.
  assert.ok(zakup.zrodla.grant <= Math.round(grantPct * bazaKwal) + 1, `grant ${zakup.zrodla.grant} ≤ ${Math.round(grantPct * bazaKwal)}`);
  // Reguła realnie działa: grant jest MNIEJSZY niż gdyby liczyć od pełnego RAZEM (z gruntem).
  assert.ok(zakup.zrodla.grant < Math.round(grantPct * zakup.koszt.razem), "grunt wyłączony z bazy grantu realnie obniża dotację");
});
