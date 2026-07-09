/**
 * Testy silników P1/P2/P3 na danych przykładowych.
 * Uruchom: `npm test`
 *
 * Po rewizji Poziomu 1: P1 ocenia tylko podstawę planistyczną → pojemność ↔ popyt.
 * Uwarunkowania (bramki/sygnały/braki/kluczowe liczby) przeniesiono do Poziomu 2.
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { DZIALKI_PRZYKLADOWE } from "../../data/sample";
import { uruchomAnalize } from "../index";
import { uruchomPoziom1 } from "../poziom1";
import { uruchomPoziom2 } from "../poziom2";
import { statusZeSymbolu } from "../../mpzp";

const [wzorcowa, senioralna, bialePlamy] = DZIALKI_PRZYKLADOWE;

test("P1: działka wzorcowa → tryb pełny, funkcja dozwolona, oba profile ocenione", () => {
  const w = uruchomPoziom1(wzorcowa);
  assert.equal(w.funkcjaMieszkaniowaDozwolona, true);
  assert.equal(w.tryb, "pelny");
  // Po rozprzęgnięciu progów od WO i rozkładzie dochodu per profil rekomendacja
  // nie jest już zaszyta w „młodzi" — sprawdzamy, że oba profile są ocenione
  // i wskazano poprawny, dozwolony kierunek.
  assert.ok(w.scoreMlodzi > 0 && w.scoreSeniorzy > 0);
  assert.ok(["mlodzi", "seniorzy", "oba"].includes(w.profilRekomendowany));
  // Pewność obniżana świadomie przez estymację podziału dochodowego (q) — wytyczne §8.
  assert.ok(w.pewnosc >= 65, `pewność powinna być rozsądna, jest ${w.pewnosc}`);
  // Pojemność wyliczona z prognozy potencjału (kształt + sąsiedztwo).
  assert.ok(w.pojemnosc.pumM2 !== null && w.pojemnosc.pumM2! > 0);
  assert.ok(w.pojemnosc.szacLiczbaMieszkanMlodzi! >= 15);
});

test("P1: działka senioralna → prognoza potencjału, tryb pełny, oba profile ocenione", () => {
  // Po rewizji P1 pojemność liczy PROGNOZA (kształt + sąsiedztwo), nie ręczne wskaźniki;
  // domyślna podstawa to „PROGNOZA". Mnożnik usług (POZ) ujawnia się dopiero na P2.
  const w = uruchomPoziom1(senioralna);
  assert.equal(w.podstawa.typ, "PROGNOZA");
  assert.equal(w.tryb, "pelny");
  assert.equal(w.funkcjaMieszkaniowaDozwolona, true);
  assert.notEqual(w.werdyktSeniorzy, undefined);
  assert.notEqual(w.werdyktMlodzi, undefined);
  assert.ok(w.prognoza.pumM2 > 0);
  assert.ok(w.pojemnosc.szacLiczbaMieszkanSeniorzy! > 0);
});

test("P1: białe plamy → prognoza z powierzchni daje pojemność, funkcja nieprzesądzona, obniżona pewność", () => {
  const w = uruchomPoziom1(bialePlamy);
  // Prognoza działa z samej powierzchni i kształtu — pojemność jest oznaczona (tryb pełny),
  // ale braki demografii/geometrii obniżają pewność.
  assert.equal(w.tryb, "pelny");
  assert.equal(w.funkcjaMieszkaniowaDozwolona, true); // brak deklaracji → nie blokujemy
  assert.ok(w.pojemnosc.pumM2 !== null && w.pojemnosc.pumM2! > 0);
  assert.equal(w.prognoza.flagaMpzp, "nieznane");
  assert.ok(w.pewnosc < 90, `pewność powinna być obniżona przez braki, jest ${w.pewnosc}`);
});

test("P2: pułap czynszu = wartość odtworzeniowa × 5% ÷ 12", () => {
  const a = uruchomAnalize(wzorcowa);
  const oczek = (wzorcowa.wartoscOdtworzeniowaM2! * 0.05) / 12;
  assert.ok(Math.abs(a.poziom2.kluczoweLiczby.pulapCzynszuSimM2! - oczek) < 0.2);
  assert.ok(a.poziom2.kluczoweLiczby.pulapCzynszuSimM2! > 30 && a.poziom2.kluczoweLiczby.pulapCzynszuSimM2! < 35);
});

test("P2 (warstwy srd. 2 par.4): niezweryfikowane srodowisko (stan null, brak warstwy) -> do weryfikacji, nie blokuje", () => {
  // Brak MPZP i brak danej środowiskowej (null) — warstwy niezassane w teście → do weryfikacji.
  const d = { ...bialePlamy, statusPlanistyczny: "brak_danych" as const, ryzykoPowodzioweSzczegolne: null, osuwisko: null, natura2000: null };
  const a = uruchomAnalize(d);
  const env = a.poziom2.bramki.szczegoly.filter((s) => /powodz|ochron|osuwisk/i.test(s.nazwa));
  assert.ok(env.length >= 3);
  assert.ok(env.every((s) => s.status === "do_weryfikacji"), "każda niezweryfikowana warstwa → do_weryfikacji");
  // Brak weryfikacji NIE robi bramki „warunkowo" (nie blokuje) — to naprawa CAP.
  assert.ok(!env.some((s) => s.status === "warunkowo"));
});

test("P2 (warstwy srd. 2 par.4): wykryte/zadeklarowane zagrozenie (stan true) -> warunkowo (CAP)", () => {
  const d = { ...bialePlamy, statusPlanistyczny: "brak_danych" as const, ryzykoPowodzioweSzczegolne: true, osuwisko: null, natura2000: null };
  const a = uruchomAnalize(d);
  const powodz = a.poziom2.bramki.szczegoly.find((s) => /powodz/i.test(s.nazwa));
  assert.equal(powodz?.status, "warunkowo"); // deklaracja „tak" → warunkowo, nawet bez warstwy WFS
  assert.ok(a.poziom2.bramki.flagi.some((f) => /powodz/i.test(f)));
});

test("P2 (warstwy srd. 2 par.4): potwierdzony brak zagrozenia (stan false) -> pass, odblokowuje zielony", () => {
  const d = { ...bialePlamy, statusPlanistyczny: "brak_danych" as const, ryzykoPowodzioweSzczegolne: false, osuwisko: false, natura2000: false };
  const a = uruchomAnalize(d);
  const env = a.poziom2.bramki.szczegoly.filter((s) => /powodz|ochron|osuwisk/i.test(s.nazwa));
  assert.ok(env.every((s) => s.status === "pass"), "stan false → pass (czysto)");
});

test("P2: potwierdzone wskaźniki z ankiety schodzą z listy do weryfikacji i podnoszą pewność", () => {
  // bialePlamy: brak MPZP + brak wskaźników planistycznych → obie pozycje na liście „do weryfikacji".
  const bazowy = uruchomAnalize(bialePlamy);
  const zDeklaracja = uruchomAnalize({
    ...bialePlamy,
    wskaznikiReczne: { intensywnosc: 1.2, maxWysokoscM: 12, maxPowZabudowyPct: 40, minPbcPct: 25 },
    wskaznikiPotwierdzone: true,
  });
  const maBrak = (braki: { tytul: string }[], re: RegExp) => braki.some((b) => re.test(b.tytul));

  // Baseline: plan/WZ oraz wskaźniki widnieją jako „do weryfikacji".
  assert.ok(maBrak(bazowy.poziom2.braki, /Przeznaczenie w planie/i));
  assert.ok(maBrak(bazowy.poziom2.braki, /Wskaźniki zabudowy/i));

  // Po potwierdzonej deklaracji klienta obie pozycje schodzą z listy (dana zweryfikowana przez klienta).
  assert.ok(!maBrak(zDeklaracja.poziom2.braki, /Przeznaczenie w planie/i));
  assert.ok(!maBrak(zDeklaracja.poziom2.braki, /Wskaźniki zabudowy/i));

  // Ten sam korzeń: mniej braków → wyższa pewność M2 (8 pkt za pozycję).
  assert.ok(zDeklaracja.poziom2.braki.length < bazowy.poziom2.braki.length);
  assert.ok(zDeklaracja.poziom2.ocenaM2.pewnoscM2 > bazowy.poziom2.ocenaM2.pewnoscM2);
});

test("P2: obwiednia z MPZP ma wyższą pewność niż fallback z sąsiedztwa", () => {
  const z = uruchomAnalize(senioralna); // MPZP
  const b = uruchomAnalize(bialePlamy); // brak MPZP → fallback
  assert.ok(z.poziom2.obwiednia.pewnoscObwiedni > b.poziom2.obwiednia.pewnoscObwiedni);
  assert.equal(b.poziom2.obwiednia.zrodloWskaznikow, "sasiedztwo_fallback");
  assert.ok(z.poziom2.warianty.length >= 1);
  assert.ok(z.poziom2.warianty.every((w) => w.liczbaMieszkan > 0));
});

test("P2: obwiednia honoruje wysokość — niska intensywność NIE zeruje kondygnacji", () => {
  // Scenariusz błędu: MPZP 12 m (≈4 kond.), ale intensywność = % zabudowy/100 (0.35).
  // Dawniej liczba kondygnacji spadała do 1; teraz = limit z wysokości (4).
  const d = {
    ...wzorcowa,
    powierzchniaM2: 11860,
    statusPlanistyczny: "plan_ogolny_sprzyjajacy" as const,
    wskaznikiPlanistyczne: { intensywnosc: 0.35, maxWysokoscM: 12, maxKondygnacje: 4, maxPowZabudowyPct: 35, minPbcPct: 30, normatywParkingowy: 0.8, udzialUslugPct: 15 },
  };
  const p1 = uruchomPoziom1(d);
  const o = uruchomPoziom2(d, p1).obwiednia;
  assert.equal(o.maxKondygnacje, 4);
  assert.ok(o.pumM2 > 0);
});

test("P2: fallback z sąsiedztwa — wysokość okolicy steruje liczbą kondygnacji", () => {
  const d = { ...bialePlamy, wskaznikiPlanistyczne: null, wysokoscOkolicyPieter: 4 };
  const p1 = uruchomPoziom1(d);
  const o = uruchomPoziom2(d, p1).obwiednia;
  assert.equal(o.zrodloWskaznikow, "sasiedztwo_fallback");
  assert.equal(o.maxKondygnacje, 4); // z sąsiadów (4 piętra), nie ze stałej
});

test("P2: dwa kierunki × 3 warianty (6) — oba profile; profil wiodący pierwszy", () => {
  const p1 = { ...uruchomPoziom1(senioralna), profilRekomendowany: "seniorzy" as const };
  const p2 = uruchomPoziom2(senioralna, p1);
  assert.equal(p2.warianty.length, 6);
  assert.equal(p2.warianty.filter((w) => w.profil === "seniorzy").length, 3);
  assert.equal(p2.warianty.filter((w) => w.profil === "mlodzi").length, 3);
  // Profil wiodący (rekomendacja M2 lub — gdy brak — wyższy score) jest pierwszy.
  const om2 = p2.ocenaM2;
  const wiodacy = om2.rekomendacja !== "brak" ? om2.rekomendacja : om2.werdykty.seniorzy.score >= om2.werdykty.mlodzi.score ? "seniorzy" : "mlodzi";
  assert.equal(p2.warianty[0].profil, wiodacy);
  assert.ok(p2.warianty.every((w) => w.liczbaMieszkan > 0));
});

test("P2: wariant senioralny zawsze ma windę", () => {
  // Wymuszamy rekomendację senioralną, by P2 zbudował wariant senioralny.
  const p1 = { ...uruchomPoziom1(senioralna), profilRekomendowany: "seniorzy" as const };
  const p2 = uruchomPoziom2(senioralna, p1);
  const senior = p2.warianty.find((w) => w.profil === "seniorzy");
  assert.ok(senior);
  assert.equal(senior!.windaWymagana, true);
});

test("P2: sygnały i realne białe plamy", () => {
  const a = uruchomAnalize(wzorcowa);
  // Komplet danych „miękkich"; lista „do weryfikacji" obejmuje niezassane warstwy
  // środowiskowe (powódź/ochrona/osuwiska) ORAZ podstawę planistyczną (plan/WZ), gdy
  // działka nie ma MPZP mieszkaniowego (warstwy śrd. 2 §4a — jedno miejsce ze wszystkimi lukami).
  assert.ok(a.poziom2.braki.every((x) => /powodz|ochron|osuwisk|środowisk|plan|przeznacz|wskaźnik|zabudow/i.test(x.tytul)), `nieoczekiwane braki: ${a.poziom2.braki.map((x) => x.tytul).join(", ")}`);
  assert.ok(a.poziom2.sygnaly.some((s) => s.ton === "pozytyw"));

  const b = uruchomAnalize(bialePlamy);
  // Brak czynszu → biała plama rynku najmu. Natura 2000 = true w danych → bramka „warunkowo"
  // + sygnał ostrzegawczy (wykryte ograniczenie, zgodnie z naprawą CAP).
  assert.ok(b.poziom2.braki.length >= 1, `braki=${b.poziom2.braki.length}`);
  assert.ok(b.poziom2.braki.some((x) => x.tytul.toLowerCase().includes("najmu")));
  assert.ok(b.poziom2.sygnaly.some((s) => /natura|ochron/i.test(s.tekst)));
});

test("P3: trzy scenariusze, reżim domyślny kotwiczony w OBECNYM (5.3), oś czasu sensowna", () => {
  const a = uruchomAnalize(wzorcowa);
  assert.equal(a.poziom3.scenariusze.length, 3);
  // 5.3 Rekomendacja kotwiczona w reżimie obecnym (pewne dane); przyszły = scenariusz.
  assert.equal(a.poziom3.rezimDomyslny, "A_SBC_2026");
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

test("MPZP: symbol → status planistyczny", () => {
  assert.equal(statusZeSymbolu("MW").status, "mpzp_mieszkaniowy");
  assert.equal(statusZeSymbolu("MW").sprzeczne, false);
  assert.equal(statusZeSymbolu("MW/U").status, "mpzp_mieszkaniowy");
  assert.equal(statusZeSymbolu("R").status, "sprzeczny");
  assert.equal(statusZeSymbolu("P").sprzeczne, true);
  assert.equal(statusZeSymbolu("U").status, "sprzeczny"); // usługi bez funkcji mieszkaniowej
});

test("P1: podstawa z symbolem mieszkaniowym → funkcja dozwolona", () => {
  const d = { ...bialePlamy, podstawa: { typ: "MPZP" as const, symbol: "MW", zrodlo: "ręczne" as const } };
  const w = uruchomPoziom1(d);
  assert.equal(w.funkcjaMieszkaniowaDozwolona, true);
  assert.equal(w.podstawa.symbol, "MW");
});

test("P1: podstawa ze sprzecznym symbolem → funkcja niedozwolona, werdykt czerwony", () => {
  const d = { ...bialePlamy, podstawa: { typ: "MPZP" as const, symbol: "R", zrodlo: "ręczne" as const } };
  const w = uruchomPoziom1(d);
  assert.equal(w.funkcjaMieszkaniowaDozwolona, false);
  assert.equal(w.werdykt, "czerwony");
  assert.equal(w.profilRekomendowany, "zaden");
});

test("MPZP budowlany wyłącza bramki środowiskowe/formalne z braków (przesądzone w planie)", () => {
  const d = {
    ...wzorcowa,
    statusPlanistyczny: "mpzp_mieszkaniowy" as const,
    dostepDrogaPubliczna: null,
    ryzykoPowodzioweSzczegolne: null,
    natura2000: null,
    ochronaWykluczajaca: null,
    terenGorniczy: null,
    osuwisko: null,
    gruntLesny: null,
    gruntRolnyKlasaIdoIII: null,
    przeznaczenieSprzeczneZMieszkaniowa: null,
    zabudowaMieszkaniowaWSasiedztwie: null,
  };
  const a = uruchomAnalize(d);
  // Żadna bramka nie jest „do weryfikacji" — plan je przesądza.
  assert.ok(a.poziom2.bramki.szczegoly.every((b) => b.status !== "do_weryfikacji"));
  // Te pozycje nie pojawiają się w „Czego nie pobrano".
  assert.ok(!a.poziom2.braki.some((b) => /powodzi|natura|osuwisk|drogi|leśny|rolny|przeznaczenie|sąsiedztw/i.test(b.tytul)));
});

test("Pipeline: każdy poziom zasila następny (spójność id)", () => {
  for (const d of DZIALKI_PRZYKLADOWE) {
    const a = uruchomAnalize(d);
    assert.equal(a.poziom1.dzialkaId, d.id);
    assert.equal(a.poziom2.dzialkaId, d.id);
    assert.equal(a.poziom3.dzialkaId, d.id);
  }
});
