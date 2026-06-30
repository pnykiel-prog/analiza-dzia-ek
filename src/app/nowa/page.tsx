"use client";

import { useState } from "react";
import type { DaneDzialki, WynikAnalizy } from "@/lib/types";
import { Karta } from "@/components/ui";
import { WynikiPoziomow } from "@/components/WynikiPoziomow";

type Stan = Record<string, string>;

// Pola tekstowe/liczbowe startują puste (= biała plama). Sekcje grupują formularz.
const STAN_POCZATKOWY: Stan = {
  id: "",
  gmina: "",
  powiat: "",
  wojewodztwo: "",
  teryt: "",
  powierzchniaM2: "",
  frontM: "",
  proporcjaBokow: "",
  klasaUzytku: "",
  gruntLesny: "",
  gruntRolnyKlasaIdoIII: "",
  statusPlanistyczny: "brak_danych",
  w_intensywnosc: "",
  w_maxWysokoscM: "",
  w_maxKondygnacje: "",
  w_maxPowZabudowyPct: "",
  w_minPbcPct: "",
  w_normatywParkingowy: "",
  w_udzialUslugPct: "",
  zabudowaMieszkaniowaWSasiedztwie: "",
  przeznaczenieSprzeczneZMieszkaniowa: "",
  dostepDrogaPubliczna: "",
  sredniSpadekPct: "",
  ryzykoPowodzioweSzczegolne: "",
  osuwisko: "",
  terenGorniczy: "",
  odlegloscDoSieciM: "",
  odlegloscDoZabudowyM: "",
  czasDojazdAglomeracjaMin: "",
  przystanekZCzestotliwoscia: "",
  uslugiPodstawowePieszo: "",
  pozWZasiegu: "",
  zlobkiSzkolyWZasiegu: "",
  udzial2039Pct: "",
  mediana2039Woj: "",
  saldoMigracjiMlodzi: "",
  udzial65PlusPct: "",
  trend65Plus: "",
  populacjaStabilna: "",
  trendLudnosc: "",
  bezrobociePct: "",
  liczbaPodmiotowGosp: "",
  natura2000: "",
  ochronaWykluczajaca: "",
  strefaKonserwatorska: "",
  wartoscOdtworzeniowaM2: "",
  czynszRynkowyM2: "",
  cenaNowychM2: "",
  kosztBudowyM2: "",
  cenaGruntu: "",
  pustostanyPct: "",
  dochodyGospDomowe: "",
};

const PRZYKLAD: Stan = {
  ...STAN_POCZATKOWY,
  id: "999999_9.0001.10/1",
  gmina: "Przykładowa",
  powiat: "przykładowy",
  wojewodztwo: "mazowieckie",
  teryt: "999999_9",
  powierzchniaM2: "4000",
  frontM: "50",
  proporcjaBokow: "1.5",
  klasaUzytku: "B",
  gruntLesny: "nie",
  gruntRolnyKlasaIdoIII: "nie",
  statusPlanistyczny: "ouz",
  w_intensywnosc: "1.1",
  w_maxWysokoscM: "16",
  w_maxKondygnacje: "5",
  w_maxPowZabudowyPct: "40",
  w_minPbcPct: "30",
  w_normatywParkingowy: "0.8",
  w_udzialUslugPct: "20",
  zabudowaMieszkaniowaWSasiedztwie: "tak",
  przeznaczenieSprzeczneZMieszkaniowa: "nie",
  dostepDrogaPubliczna: "tak",
  sredniSpadekPct: "4",
  ryzykoPowodzioweSzczegolne: "nie",
  osuwisko: "nie",
  terenGorniczy: "nie",
  odlegloscDoSieciM: "70",
  odlegloscDoZabudowyM: "50",
  czasDojazdAglomeracjaMin: "35",
  przystanekZCzestotliwoscia: "tak",
  uslugiPodstawowePieszo: "tak",
  pozWZasiegu: "tak",
  zlobkiSzkolyWZasiegu: "tak",
  udzial2039Pct: "30",
  mediana2039Woj: "27",
  saldoMigracjiMlodzi: "6",
  udzial65PlusPct: "17",
  trend65Plus: "rosnacy",
  populacjaStabilna: "tak",
  trendLudnosc: "rosnaca",
  bezrobociePct: "3.5",
  liczbaPodmiotowGosp: "190",
  natura2000: "nie",
  ochronaWykluczajaca: "nie",
  strefaKonserwatorska: "nie",
  wartoscOdtworzeniowaM2: "7500",
  czynszRynkowyM2: "58",
  cenaNowychM2: "11000",
  kosztBudowyM2: "9500",
  cenaGruntu: "1800000",
  pustostanyPct: "3",
  dochodyGospDomowe: "7500",
};

export default function NowaAnalizaPage() {
  const [f, setF] = useState<Stan>(STAN_POCZATKOWY);
  const [wynik, setWynik] = useState<WynikAnalizy | null>(null);
  const [pokrycie, setPokrycie] = useState<{ pokryciePct: number; polaPuste: number } | null>(null);
  const [blad, setBlad] = useState<string | null>(null);
  const [licze, setLicze] = useState(false);

  const set = (k: string) => (v: string) => setF((s) => ({ ...s, [k]: v }));

  function zbudujDane(): DaneDzialki {
    const num = (k: string): number | null => (f[k].trim() === "" ? null : Number(f[k]));
    const tri = (k: string): boolean | null => (f[k] === "" ? null : f[k] === "tak");
    const txt = (k: string): string | null => (f[k].trim() === "" ? null : f[k].trim());

    const maZabudowe = f.w_intensywnosc.trim() !== "";
    const wskazniki = maZabudowe
      ? {
          intensywnosc: Number(f.w_intensywnosc),
          maxWysokoscM: num("w_maxWysokoscM") ?? 12,
          maxKondygnacje: num("w_maxKondygnacje") ?? 4,
          maxPowZabudowyPct: num("w_maxPowZabudowyPct") ?? 35,
          minPbcPct: num("w_minPbcPct") ?? 30,
          normatywParkingowy: num("w_normatywParkingowy") ?? 0.8,
          udzialUslugPct: num("w_udzialUslugPct") ?? 15,
        }
      : null;

    return {
      id: f.id.trim(),
      teryt: f.teryt.trim(),
      gmina: f.gmina.trim(),
      powiat: f.powiat.trim(),
      wojewodztwo: f.wojewodztwo.trim(),
      powierzchniaM2: Number(f.powierzchniaM2),
      frontM: num("frontM"),
      proporcjaBokow: num("proporcjaBokow"),
      budynkiIstniejace: null,
      klasaUzytku: txt("klasaUzytku"),
      gruntLesny: tri("gruntLesny"),
      gruntRolnyKlasaIdoIII: tri("gruntRolnyKlasaIdoIII"),
      statusPlanistyczny: f.statusPlanistyczny as DaneDzialki["statusPlanistyczny"],
      wskaznikiPlanistyczne: wskazniki,
      zabudowaMieszkaniowaWSasiedztwie: tri("zabudowaMieszkaniowaWSasiedztwie"),
      przeznaczenieSprzeczneZMieszkaniowa: tri("przeznaczenieSprzeczneZMieszkaniowa"),
      dostepDrogaPubliczna: tri("dostepDrogaPubliczna"),
      sredniSpadekPct: num("sredniSpadekPct"),
      ryzykoPowodzioweSzczegolne: tri("ryzykoPowodzioweSzczegolne"),
      osuwisko: tri("osuwisko"),
      terenGorniczy: tri("terenGorniczy"),
      odlegloscDoSieciM: num("odlegloscDoSieciM"),
      odlegloscDoZabudowyM: num("odlegloscDoZabudowyM"),
      czasDojazdAglomeracjaMin: num("czasDojazdAglomeracjaMin"),
      przystanekZCzestotliwoscia: tri("przystanekZCzestotliwoscia"),
      uslugiPodstawowePieszo: tri("uslugiPodstawowePieszo"),
      pozWZasiegu: tri("pozWZasiegu"),
      zlobkiSzkolyWZasiegu: tri("zlobkiSzkolyWZasiegu"),
      udzial2039Pct: num("udzial2039Pct"),
      mediana2039Woj: num("mediana2039Woj"),
      saldoMigracjiMlodzi: num("saldoMigracjiMlodzi"),
      udzial65PlusPct: num("udzial65PlusPct"),
      trend65Plus: (f.trend65Plus || null) as DaneDzialki["trend65Plus"],
      populacjaStabilna: tri("populacjaStabilna"),
      trendLudnosc: (f.trendLudnosc || null) as DaneDzialki["trendLudnosc"],
      bezrobociePct: num("bezrobociePct"),
      liczbaPodmiotowGosp: num("liczbaPodmiotowGosp"),
      natura2000: tri("natura2000"),
      ochronaWykluczajaca: tri("ochronaWykluczajaca"),
      strefaKonserwatorska: tri("strefaKonserwatorska"),
      wartoscOdtworzeniowaM2: num("wartoscOdtworzeniowaM2"),
      czynszRynkowyM2: num("czynszRynkowyM2"),
      cenaNowychM2: num("cenaNowychM2"),
      kosztBudowyM2: num("kosztBudowyM2"),
      cenaGruntu: num("cenaGruntu"),
      pustostanyPct: num("pustostanyPct"),
      dochodyGospDomowe: num("dochodyGospDomowe"),
    };
  }

  async function analizuj(e: React.FormEvent) {
    e.preventDefault();
    setBlad(null);
    if (!f.id.trim()) return setBlad("Podaj identyfikator działki.");
    if (!f.powierzchniaM2.trim() || Number(f.powierzchniaM2) <= 0) return setBlad("Podaj powierzchnię działki (m²).");
    setLicze(true);
    try {
      const r = await fetch("/api/analiza-adhoc", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dane: zbudujDane() }),
      });
      const d = await r.json();
      if (!r.ok) {
        setBlad(d.blad ?? "Błąd analizy.");
        setWynik(null);
      } else {
        setWynik(d);
        setPokrycie(d.pokrycie);
        setTimeout(() => document.getElementById("wyniki")?.scrollIntoView({ behavior: "smooth" }), 50);
      }
    } catch {
      setBlad("Nie udało się połączyć z serwerem analizy.");
    } finally {
      setLicze(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="card p-5">
        <h1 className="text-xl font-bold text-slate-800">Nowa analiza — wprowadź działkę</h1>
        <p className="text-slate-600 mt-1 text-sm max-w-3xl">
          Wypełnij parametry działki i uruchom pełną analizę 3 poziomów. Pola możesz zostawić puste — brak danej jest
          traktowany jako „biała plama" (neutralnie, obniża tylko wskaźnik pewności, nigdy nie daje „wykluczone").
          Wymagane są tylko <strong>identyfikator</strong> i <strong>powierzchnia</strong>.
        </p>
        <p className="text-xs text-slate-400 mt-2">
          Docelowo po podaniu numeru ewidencyjnego część pól (geometria, demografia, POI, ochrona) wypełni się
          automatycznie z ULDK/GUS/OSM. Na tym etapie dane wprowadzasz ręcznie.
        </p>
        <div className="flex gap-2 mt-3">
          <button onClick={() => setF(PRZYKLAD)} className="text-sm border border-slate-300 rounded px-3 py-1.5 hover:bg-slate-50">
            Wypełnij przykładowymi danymi
          </button>
          <button onClick={() => { setF(STAN_POCZATKOWY); setWynik(null); }} className="text-sm border border-slate-300 rounded px-3 py-1.5 hover:bg-slate-50">
            Wyczyść
          </button>
        </div>
      </div>

      <form onSubmit={analizuj} className="space-y-4">
        <Grupa tytul="A. Identyfikacja i geometria" opis="ULDK / EGiB — punkt startowy analizy">
          <Txt label="Identyfikator działki *" k="id" f={f} set={set} ph="TERYT.obręb.nr, np. 146509_8.0012.123/4" />
          <Txt label="Gmina" k="gmina" f={f} set={set} />
          <Txt label="Powiat" k="powiat" f={f} set={set} />
          <Txt label="Województwo" k="wojewodztwo" f={f} set={set} />
          <Num label="Powierzchnia *" k="powierzchniaM2" f={f} set={set} sufiks="m²" />
          <Num label="Front działki" k="frontM" f={f} set={set} sufiks="m" />
          <Num label="Proporcja boków" k="proporcjaBokow" f={f} set={set} krok="0.1" />
          <Txt label="Klasa użytku" k="klasaUzytku" f={f} set={set} ph="np. B, RIVa, Ls" />
          <Tri label="Grunt leśny (Ls)" k="gruntLesny" f={f} set={set} />
          <Tri label="Grunt rolny kl. I–III" k="gruntRolnyKlasaIdoIII" f={f} set={set} />
        </Grupa>

        <Grupa tytul="B. Status planistyczny i prawny" opis="MPZP / plan ogólny / OUZ; dostęp do drogi">
          <Sel
            label="Status planistyczny"
            k="statusPlanistyczny"
            f={f}
            set={set}
            opcje={[
              ["mpzp_mieszkaniowy", "MPZP mieszkaniowy"],
              ["plan_ogolny_sprzyjajacy", "Plan ogólny sprzyjający"],
              ["ouz", "Obszar Uzupełnienia Zabudowy (OUZ)"],
              ["sprzeczny", "Przeznaczenie sprzeczne (wykluczenie)"],
              ["brak_danych", "Brak danych (biała plama)"],
            ]}
          />
          <Tri label="Zabudowa mieszk. w sąsiedztwie" k="zabudowaMieszkaniowaWSasiedztwie" f={f} set={set} />
          <Tri label="Przeznaczenie sprzeczne z mieszk." k="przeznaczenieSprzeczneZMieszkaniowa" f={f} set={set} />
          <Tri label="Dostęp do drogi publicznej" k="dostepDrogaPubliczna" f={f} set={set} />
          <Num label="Intensywność zabudowy" k="w_intensywnosc" f={f} set={set} krok="0.1" ph="wypełnij, by aktywować wskaźniki" />
          <Num label="Max wysokość" k="w_maxWysokoscM" f={f} set={set} sufiks="m" />
          <Num label="Max kondygnacje" k="w_maxKondygnacje" f={f} set={set} />
          <Num label="Max pow. zabudowy" k="w_maxPowZabudowyPct" f={f} set={set} sufiks="%" />
          <Num label="Min pow. biol. czynna" k="w_minPbcPct" f={f} set={set} sufiks="%" />
          <Num label="Normatyw parkingowy" k="w_normatywParkingowy" f={f} set={set} krok="0.1" sufiks="/lok." />
          <Num label="Udział usług" k="w_udzialUslugPct" f={f} set={set} sufiks="%" />
        </Grupa>

        <Grupa tytul="C–D. Teren i uzbrojenie" opis="NMT / ISOK / SOPO / GESUT">
          <Num label="Średni spadek terenu" k="sredniSpadekPct" f={f} set={set} sufiks="%" />
          <Tri label="Szczególne zagrożenie powodzią" k="ryzykoPowodzioweSzczegolne" f={f} set={set} />
          <Tri label="Osuwisko" k="osuwisko" f={f} set={set} />
          <Tri label="Teren górniczy" k="terenGorniczy" f={f} set={set} />
          <Num label="Odległość do sieci" k="odlegloscDoSieciM" f={f} set={set} sufiks="m" />
          <Num label="Odległość do zabudowy" k="odlegloscDoZabudowyM" f={f} set={set} sufiks="m" />
        </Grupa>

        <Grupa tytul="E–G. Dostępność i usługi" opis="OSM / routing / GTFS / RSPO / RPWDL">
          <Num label="Czas dojazdu do aglomeracji" k="czasDojazdAglomeracjaMin" f={f} set={set} sufiks="min" />
          <Tri label="Przystanek z częstotliwością (≤800 m)" k="przystanekZCzestotliwoscia" f={f} set={set} />
          <Tri label="Usługi podstawowe pieszo" k="uslugiPodstawowePieszo" f={f} set={set} />
          <Tri label="POZ w zasięgu (seniorzy)" k="pozWZasiegu" f={f} set={set} />
          <Tri label="Żłobki/szkoły w zasięgu (młodzi)" k="zlobkiSzkolyWZasiegu" f={f} set={set} />
        </Grupa>

        <Grupa tytul="F. Demografia i rynek pracy" opis="GUS BDL">
          <Num label="Udział 20–39 lat" k="udzial2039Pct" f={f} set={set} sufiks="%" />
          <Num label="Mediana 20–39 woj." k="mediana2039Woj" f={f} set={set} sufiks="%" />
          <Num label="Saldo migracji młodych" k="saldoMigracjiMlodzi" f={f} set={set} />
          <Num label="Udział 65+" k="udzial65PlusPct" f={f} set={set} sufiks="%" />
          <Sel label="Trend 65+" k="trend65Plus" f={f} set={set} opcje={[["", "brak danych"], ["rosnacy", "rosnący"], ["stabilny", "stabilny"], ["malejacy", "malejący"]]} />
          <Tri label="Populacja stabilna (nie wymiera)" k="populacjaStabilna" f={f} set={set} />
          <Sel label="Trend liczby ludności" k="trendLudnosc" f={f} set={set} opcje={[["", "brak danych"], ["rosnaca", "rosnąca"], ["stabilna", "stabilna"], ["malejaca", "malejąca"]]} />
          <Num label="Bezrobocie" k="bezrobociePct" f={f} set={set} sufiks="%" krok="0.1" />
          <Num label="Podmioty gosp. / 1000 mieszk." k="liczbaPodmiotowGosp" f={f} set={set} />
        </Grupa>

        <Grupa tytul="H. Środowisko i ograniczenia" opis="GDOŚ / NID">
          <Tri label="Natura 2000" k="natura2000" f={f} set={set} />
          <Tri label="Wykluczająca forma ochrony" k="ochronaWykluczajaca" f={f} set={set} />
          <Tri label="Strefa konserwatorska" k="strefaKonserwatorska" f={f} set={set} />
        </Grupa>

        <Grupa tytul="I–J. Rynek i ekonomia" opis="BGK / RCiWN / GUS — wejście do W5 i Poziomu 3">
          <Num label="Wartość odtworzeniowa" k="wartoscOdtworzeniowaM2" f={f} set={set} sufiks="zł/m²" />
          <Num label="Czynsz rynkowy" k="czynszRynkowyM2" f={f} set={set} sufiks="zł/m²" />
          <Num label="Cena nowych mieszkań" k="cenaNowychM2" f={f} set={set} sufiks="zł/m²" />
          <Num label="Koszt budowy (pod klucz)" k="kosztBudowyM2" f={f} set={set} sufiks="zł/m²" />
          <Num label="Cena gruntu (całość)" k="cenaGruntu" f={f} set={set} sufiks="zł" />
          <Num label="Pustostany" k="pustostanyPct" f={f} set={set} sufiks="%" />
          <Num label="Dochody gosp. domowych" k="dochodyGospDomowe" f={f} set={set} sufiks="zł/mc" />
        </Grupa>

        {blad && <p className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{blad}</p>}

        <div className="flex items-center gap-3 sticky bottom-0 bg-[#f8fafc] py-3">
          <button type="submit" disabled={licze} className="bg-slate-900 text-white px-5 py-2.5 rounded-lg hover:bg-slate-700 disabled:opacity-50">
            {licze ? "Analizuję…" : "Uruchom analizę"}
          </button>
          {pokrycie && wynik && (
            <span className="text-xs text-slate-500">
              Pokrycie danych: <strong>{pokrycie.pokryciePct}%</strong> · białe plamy: {pokrycie.polaPuste}
            </span>
          )}
        </div>
      </form>

      {wynik && wynik.poziom1 && (
        <div id="wyniki" className="pt-2">
          <h2 className="text-lg font-bold text-slate-800 mb-2">Wyniki analizy — {wynik.dane.gmina || wynik.dane.id}</h2>
          <WynikiPoziomow p1={wynik.poziom1} p2={wynik.poziom2} p3={wynik.poziom3} />
        </div>
      )}
    </div>
  );
}

// ── Komponenty pól ──────────────────────────────────────────────────────────

function Grupa({ tytul, opis, children }: { tytul: string; opis: string; children: React.ReactNode }) {
  return (
    <Karta tytul={tytul} podtytul={opis}>
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">{children}</div>
    </Karta>
  );
}

type PoleProps = { label: string; k: string; f: Stan; set: (k: string) => (v: string) => void };

function Txt({ label, k, f, set, ph }: PoleProps & { ph?: string }) {
  return (
    <label className="text-sm">
      <span className="text-xs text-slate-500">{label}</span>
      <input
        type="text"
        value={f[k]}
        placeholder={ph}
        onChange={(e) => set(k)(e.target.value)}
        className="w-full border border-slate-200 rounded px-2 py-1.5 mt-0.5 text-sm"
      />
    </label>
  );
}

function Num({ label, k, f, set, sufiks, krok, ph }: PoleProps & { sufiks?: string; krok?: string; ph?: string }) {
  return (
    <label className="text-sm">
      <span className="text-xs text-slate-500">
        {label} {sufiks && <span className="text-slate-400">({sufiks})</span>}
      </span>
      <input
        type="number"
        step={krok ?? "any"}
        value={f[k]}
        placeholder={ph}
        onChange={(e) => set(k)(e.target.value)}
        className="w-full border border-slate-200 rounded px-2 py-1.5 mt-0.5 text-sm"
      />
    </label>
  );
}

function Tri({ label, k, f, set }: PoleProps) {
  return (
    <label className="text-sm">
      <span className="text-xs text-slate-500">{label}</span>
      <select value={f[k]} onChange={(e) => set(k)(e.target.value)} className="w-full border border-slate-200 rounded px-2 py-1.5 mt-0.5 text-sm bg-white">
        <option value="">brak danych</option>
        <option value="tak">tak</option>
        <option value="nie">nie</option>
      </select>
    </label>
  );
}

function Sel({ label, k, f, set, opcje }: PoleProps & { opcje: [string, string][] }) {
  return (
    <label className="text-sm">
      <span className="text-xs text-slate-500">{label}</span>
      <select value={f[k]} onChange={(e) => set(k)(e.target.value)} className="w-full border border-slate-200 rounded px-2 py-1.5 mt-0.5 text-sm bg-white">
        {opcje.map(([v, t]) => (
          <option key={v} value={v}>
            {t}
          </option>
        ))}
      </select>
    </label>
  );
}
