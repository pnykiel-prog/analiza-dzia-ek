/**
 * Poziom 3 — model finansowy SIM (spięcie finansowe).
 * Zgodny z `model_ekonomiczny_SIM_czasowy.md` (domyślny — ujęcie czasowo-reżimowe)
 * oraz `model_ekonomiczny_SIM_poziom2.md` (algorytm domknięcia, scenariusz A).
 *
 * Zasada nadrzędna: wszystko liczone na DATĘ naboru/startu budowy i oddania,
 * nie na dziś. Domyślny reżim = program 2027+ (B), z jawną flagą niepewności.
 * Wynik podawany jako przedział: konserwatywny / oczekiwany / korzystny.
 */

import type {
  DaneDzialki,
  KosztPrzedsiewziecia,
  MontazFinansowy,
  OsCzasu,
  Rezim,
  Scenariusz,
  WariantZabudowy,
  WrazliwoscPozycja,
  WynikPoziom3,
  WynikScenariusza,
} from "../types";
import type { KonfiguracjaFinanse, ParametryRezimu } from "../config";
import { KONFIG_FINANSE } from "../config";
import { annuita, indeksuj } from "./utils";
import type { AnalizaFinansowa, ProfilFinansowy } from "../finanse/typy";
import { zlozMontaz } from "../finanse";

/**
 * Mapuje montaż z ankiety finansowej na parametry reżimu modelu P3 (grant %,
 * udział kredytu, oprocentowanie, okres, partycypacja). Dla wartości `tbc`
 * (przyszły reżim) bierze środek zakresu; ustawia flagę niepewności.
 */
function parametryRezimuZAnalizy(a: AnalizaFinansowa, bazowy: ParametryRezimu): ParametryRezimu {
  const grant = a.montaz.find((m) => m.klucz === "grant");
  const partyc = a.montaz.find((m) => m.klucz === "partycypacja");
  const srodek = (z: { min: number; max: number }) => (z.min + z.max) / 2;
  const k = a.kredyt;
  return {
    ...bazowy,
    nazwa: `Montaż z ankiety — ${a.rezim === "current" ? "reżim obecny" : "reżim nowy"}`,
    maxUdzialKredytuPct: k ? Math.round(k.maxUdzialCapexPct.max) : 0,
    oprocentowanie: k ? srodek(k.oprocentowanie) : bazowy.oprocentowanie,
    okresKredytuLata: k ? k.okresLat : bazowy.okresKredytuLata,
    prowizjaPct: k?.prowizjaPct ?? bazowy.prowizjaPct,
    maxGrantPct: grant ? Math.round(srodek(grant.udzialPct)) : 0,
    maxPartycypacjaNajemcowPct: partyc ? Math.round(partyc.udzialPct.max) : 0,
    flagaNiepewnosci: a.rezim === "future" || a.flagiTbc.length > 0,
    opis: a.traktowanieGruntu,
  };
}

function liczOsCzasu(cfg: KonfiguracjaFinanse): OsCzasu {
  const o = cfg.osCzasu;
  const miesiacyDoStartuBudowy = o.projektDecyzjeMies + o.naborFinansowaniaMies;
  const miesiacyDoOddania = miesiacyDoStartuBudowy + o.budowaMies;
  return {
    fazy: [
      { nazwa: "Nabycie + analiza (T0)", miesiace: 0 },
      { nazwa: "Projekt + decyzje planistyczne + PnB", miesiace: o.projektDecyzjeMies },
      { nazwa: "Nabór i umowa finansowania", miesiace: o.naborFinansowaniaMies },
      { nazwa: "Budowa", miesiace: o.budowaMies },
    ],
    miesiacyDoStartuBudowy,
    miesiacyDoOddania,
    rokStartuBudowy: cfg.rokBazowy + Math.round(miesiacyDoStartuBudowy / 12),
    rokOddania: cfg.rokBazowy + Math.round(miesiacyDoOddania / 12),
  };
}

function kosztBudowyM2(d: DaneDzialki): number {
  if (d.kosztBudowyM2 !== null) return d.kosztBudowyM2;
  if (d.cenaNowychM2 !== null) return d.cenaNowychM2 - 2000 + 1800; // korekta wykończenia
  return 9500; // domyślna stawka rynkowa pod klucz
}

function uzbrojenie(d: DaneDzialki): number {
  if (d.odlegloscDoSieciM === null) return 150_000;
  return Math.round(50_000 + d.odlegloscDoSieciM * 800); // proxy: bazowe + długość przyłączy
}

interface KontekstScenariusza {
  scenariusz: Scenariusz;
  rezim: ParametryRezimu;
  rezimKod: Rezim;
  mnoznikKosztu: number;
  mnoznikWartOdtw: number;
  mnoznikStopy: number;
}

function liczScenariusz(
  d: DaneDzialki,
  wariant: WariantZabudowy,
  os: OsCzasu,
  ctx: KontekstScenariusza,
  cfg: KonfiguracjaFinanse
): WynikScenariusza {
  const latDoBudowy = os.miesiacyDoStartuBudowy / 12;
  const latDoOddania = os.miesiacyDoOddania / 12;
  const z = cfg.zalozenia;

  // Powierzchnie
  const pumMieszkalna = wariant.pumM2;
  const pumCalkowite = wariant.pumM2 + wariant.powWspolneUslugoweM2;

  // 1. Koszt przedsięwzięcia — zindeksowany do daty budowy
  const stawka = indeksuj(kosztBudowyM2(d) * ctx.mnoznikKosztu, cfg.indeksy.kosztBudowyRocznie, latDoBudowy);
  const budowa = Math.round(stawka * pumCalkowite);
  const grunt = Math.round(indeksuj(d.cenaGruntu ?? 0, cfg.indeksy.kosztBudowyRocznie, latDoBudowy));
  const uzbroj = Math.round(indeksuj(uzbrojenie(d), cfg.indeksy.kosztBudowyRocznie, latDoBudowy));
  const projekt = Math.round((budowa * z.kosztyProjektowePct) / 100);

  // Koszty finansowe okresu budowy — przybliżenie (zależą od kredytu, jeden przebieg)
  const kosztBezFin = grunt + budowa + uzbroj + projekt;
  const szacKredyt = (ctx.rezim.maxUdzialKredytuPct / 100) * kosztBezFin;
  const oprocentowanie = ctx.rezim.oprocentowanie * ctx.mnoznikStopy;
  const kosztyFinansowe = Math.round(
    szacKredyt * ctx.rezim.prowizjaPct + szacKredyt * oprocentowanie * (cfg.osCzasu.budowaMies / 12) * 0.5
  );
  const rezerwa = Math.round(((budowa + uzbroj) * z.rezerwaRyzykoPct) / 100);
  const razem = grunt + budowa + uzbroj + projekt + kosztyFinansowe + rezerwa;
  const koszt: KosztPrzedsiewziecia = { grunt, budowa, uzbrojenie: uzbroj, projektPrzygotowanie: projekt, kosztyFinansowe, rezerwa, razem };

  // 2. Pułap czynszu — zindeksowana wartość odtworzeniowa do daty oddania
  const wartOdtwBaza = (d.wartoscOdtworzeniowaM2 ?? 7000) * ctx.mnoznikWartOdtw;
  const wartOdtwOddanie = indeksuj(wartOdtwBaza, cfg.indeksy.wartoscOdtworzeniowaRocznie, latDoOddania);
  const pulapCzynszuM2 = (wartOdtwOddanie * ctx.rezim.stopaPulapuCzynszu) / 12;

  // 3–5. Domknięcie (algorytm z model_ekonomiczny_SIM_poziom2.md §6)
  const czynsz = pulapCzynszuM2; // czynsz = min(pokrywający koszty; pułap) → bierzemy pułap jako maksimum dozwolone
  const przychodRoczny = czynsz * pumMieszkalna * 12 * (1 - z.pustostanyPct / 100);
  const kosztyOperacyjne = z.kosztyOperacyjneM2Mc * pumMieszkalna * 12;
  const przychodNetto = przychodRoczny - kosztyOperacyjne;

  const okres = ctx.rezim.okresKredytuLata;
  const r = oprocentowanie;
  const annuityFactor = r > 0 ? (1 - Math.pow(1 + r, -okres)) / r : okres;

  // Maksymalny kredyt obsługiwalny czynszem ≤ pułap (DSCR = 1), ograniczony udziałem
  const kredytZObslugi = przychodNetto > 0 ? przychodNetto * annuityFactor : 0;
  const kredytLimit = (ctx.rezim.maxUdzialKredytuPct / 100) * razem;
  const kredyt = Math.max(0, Math.round(Math.min(kredytZObslugi, kredytLimit)));

  // Pokrycie reszty: grant (bezzwrotny) → partycypacja najemców → wkład gminy → luka
  const potrzeba = razem - kredyt;
  const grant = Math.round(Math.min((ctx.rezim.maxGrantPct / 100) * razem, Math.max(0, potrzeba)));
  const poGrancie = potrzeba - grant;
  const partycypacjaNajemcow = Math.round(
    Math.min((ctx.rezim.maxPartycypacjaNajemcowPct / 100) * razem, Math.max(0, poGrancie), (z.domyslnaPartycypacjaNajemcowPct / 100) * razem || (ctx.rezim.maxPartycypacjaNajemcowPct / 100) * razem)
  );
  const poPartycypacji = poGrancie - partycypacjaNajemcow;
  const wkladGminy = Math.round(Math.min((z.domyslnyWkladGminyPct / 100) * razem, Math.max(0, poPartycypacji)));
  const luka = Math.max(0, poPartycypacji - wkladGminy);
  const srodkiWlasne = luka; // niesfinansowana luka = środki własne / dodatkowa dotacja wymagana

  const domyka = luka <= razem * 0.005; // domyka, gdy luka znika w granicach źródeł
  const wymaganaDotacja = grant + wkladGminy + luka; // obciążenie sektora publicznego
  const wymaganaDotacjaPct = (wymaganaDotacja / razem) * 100;

  const rataRocznaKredytu = annuita(kredyt, r, okres);
  const dscr = rataRocznaKredytu > 0 ? przychodNetto / rataRocznaKredytu : przychodNetto > 0 ? 99 : 0;

  // Czy pułap czynszu wystarcza do samofinansowania (napięcie pułap vs koszt obsługi)
  const czynszSamofinansujacy =
    (annuita(kredytLimit, r, okres) + kosztyOperacyjne) / (pumMieszkalna * 12 * (1 - z.pustostanyPct / 100));
  const czynszPrzekraczaPulap = czynszSamofinansujacy > pulapCzynszuM2;

  const montaz: MontazFinansowy = {
    grant,
    kredyt,
    partycypacjaNajemcow,
    wkladGminy,
    srodkiWlasne,
    wymaganaDotacja: Math.round(wymaganaDotacja),
  };

  return {
    scenariusz: ctx.scenariusz,
    rezim: ctx.rezimKod,
    koszt,
    montaz,
    czynszWynikowyM2: Math.round(czynsz * 10) / 10,
    pulapCzynszuM2: Math.round(pulapCzynszuM2 * 10) / 10,
    czynszPrzekraczaPulap,
    dscr: Math.round(dscr * 100) / 100,
    domyka,
    wymaganaDotacjaPct: Math.round(wymaganaDotacjaPct * 10) / 10,
    rataRocznaKredytu: Math.round(rataRocznaKredytu),
  };
}

function liczWrazliwosc(
  d: DaneDzialki,
  wariant: WariantZabudowy,
  os: OsCzasu,
  bazaCtx: KontekstScenariusza,
  cfg: KonfiguracjaFinanse
): WrazliwoscPozycja[] {
  const baza = liczScenariusz(d, wariant, os, bazaCtx, cfg).wymaganaDotacjaPct;
  const warianty: { parametr: string; zmiana: string; mod: (c: KontekstScenariusza) => KontekstScenariusza; cfgMod?: KonfiguracjaFinanse }[] = [
    { parametr: "Oprocentowanie", zmiana: "+1 pp", mod: (c) => ({ ...c, rezim: { ...c.rezim, oprocentowanie: c.rezim.oprocentowanie + 0.01 } }) },
    { parametr: "Koszt budowy", zmiana: "+10%", mod: (c) => ({ ...c, mnoznikKosztu: c.mnoznikKosztu * 1.1 }) },
    { parametr: "Wartość odtworzeniowa", zmiana: "+10%", mod: (c) => ({ ...c, mnoznikWartOdtw: c.mnoznikWartOdtw * 1.1 }) },
    { parametr: "Okres kredytu", zmiana: "30 → 50 lat", mod: (c) => ({ ...c, rezim: { ...c.rezim, okresKredytuLata: 50 } }) },
    { parametr: "Okres kredytu", zmiana: "50 → 30 lat", mod: (c) => ({ ...c, rezim: { ...c.rezim, okresKredytuLata: 30 } }) },
  ];
  return warianty.map((v) => {
    const wynik = liczScenariusz(d, wariant, os, v.mod(bazaCtx), cfg).wymaganaDotacjaPct;
    return { parametr: v.parametr, zmiana: v.zmiana, wplywNaDotacjePp: Math.round((wynik - baza) * 10) / 10 };
  });
}

export function uruchomPoziom3(
  d: DaneDzialki,
  wariant: WariantZabudowy,
  cfg: KonfiguracjaFinanse = KONFIG_FINANSE,
  profilFinansowy?: ProfilFinansowy
): WynikPoziom3 {
  const os = liczOsCzasu(cfg);

  // Gdy przekazano profil z ankiety — montaż steruje parametrami reżimu bazowego.
  const analizaFinansowa: AnalizaFinansowa | null = profilFinansowy ? zlozMontaz(profilFinansowy) : null;
  const rezimDomKod: Rezim = analizaFinansowa ? (analizaFinansowa.rezim === "current" ? "A_SBC_2026" : "B_program_2027") : cfg.rezimDomyslny;
  const rezimDom = analizaFinansowa
    ? parametryRezimuZAnalizy(analizaFinansowa, cfg.rezimy[rezimDomKod])
    : cfg.rezimy[cfg.rezimDomyslny];

  const konteksty: KontekstScenariusza[] = [
    {
      scenariusz: "konserwatywny",
      rezim: rezimDom,
      rezimKod: rezimDomKod,
      mnoznikKosztu: cfg.scenariusze.konserwatywny.mnoznikKosztu,
      mnoznikWartOdtw: cfg.scenariusze.konserwatywny.mnoznikWartOdtw,
      mnoznikStopy: cfg.scenariusze.konserwatywny.mnoznikStopy,
    },
    {
      scenariusz: "oczekiwany",
      rezim: rezimDom,
      rezimKod: rezimDomKod,
      mnoznikKosztu: cfg.scenariusze.oczekiwany.mnoznikKosztu,
      mnoznikWartOdtw: cfg.scenariusze.oczekiwany.mnoznikWartOdtw,
      mnoznikStopy: cfg.scenariusze.oczekiwany.mnoznikStopy,
    },
    {
      scenariusz: "korzystny",
      rezim: cfg.rezimy.C_upside_unijny,
      rezimKod: "C_upside_unijny",
      mnoznikKosztu: cfg.scenariusze.korzystny.mnoznikKosztu,
      mnoznikWartOdtw: cfg.scenariusze.korzystny.mnoznikWartOdtw,
      mnoznikStopy: cfg.scenariusze.korzystny.mnoznikStopy,
    },
  ];

  const scenariusze = konteksty.map((c) => liczScenariusz(d, wariant, os, c, cfg));
  const oczekiwany = scenariusze.find((s) => s.scenariusz === "oczekiwany")!;
  const petlaZwrotna = !oczekiwany.domyka;

  const flagi: string[] = [];
  if (analizaFinansowa?.zablokowana)
    flagi.push(
      `PROFIL ZABLOKOWANY: ${analizaFinansowa.ostrzezenia[0]} — model finansowy ma charakter poglądowy do czasu zmiany profilu.`
    );
  if (rezimDom.flagaNiepewnosci)
    flagi.push(
      analizaFinansowa
        ? `Reżim ${analizaFinansowa.rezim === "future" ? "nowy (2027+)" : "obecny"} — część parametrów orientacyjna (tbc), szczegóły rozporządzeń niepotwierdzone.`
        : "Reżim B (program 2027+) — parametry orientacyjne, szczegóły rozporządzeń niepotwierdzone."
    );
  if (petlaZwrotna)
    flagi.push("Program nie domyka się finansowo w scenariuszu oczekiwanym → pętla zwrotna do P2 po inny wariant zabudowy.");
  if (oczekiwany.czynszPrzekraczaPulap)
    flagi.push("Czynsz samofinansujący przekracza pułap SIM — domknięcie wymaga grantu/partycypacji.");
  if (d.czynszRynkowyM2 === null)
    flagi.push("Brak lokalnego czynszu rynkowego — odniesienie szacunkowe, obniżona pewność (najsłabsze ogniwo).");
  // Ostrzeżenia z ankiety (montaż, grunt, reguły szczególne) — bez duplikatów.
  if (analizaFinansowa) for (const o of analizaFinansowa.ostrzezenia) if (!flagi.includes(o)) flagi.push(o);

  const wrazliwosc = liczWrazliwosc(d, wariant, os, konteksty[1], cfg);

  return {
    dzialkaId: d.id,
    wariantNazwa: wariant.nazwa,
    rezimDomyslny: rezimDomKod,
    osCzasu: os,
    scenariusze,
    petlaZwrotna,
    wrazliwosc,
    flagi,
    analizaFinansowa,
  };
}
