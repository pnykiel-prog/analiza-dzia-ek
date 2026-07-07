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

test("montaż: rola działki ze sposobu wniesienia", () => {
  assert.equal(rolaZeSposobu("ZAKUP_KREDYT"), "koszt");
  assert.equal(rolaZeSposobu("APORT_GMINNY"), "zrodlo");
  assert.equal(rolaZeSposobu("JUZ_POSIADANA"), "neutralna");
});
