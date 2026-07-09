"use client";

import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import type { BramkaWielkosci, DaneDzialki, PojemnoscForma, WynikAnalizy, WynikPoziom1, KluczWerdyktu } from "@/lib/types";
import type { ProfilFinansowy } from "@/lib/finanse/typy";
import { domyslnaKonfiguracja, KONFIG_M2, KONFIG_FINANSE, type Konfiguracja } from "@/lib/config";
import { WOJEWODZTWA } from "@/lib/wojewodztwa";
import type { PozycjaDzialki } from "@/lib/teryt";
import { OPIS_TRYBU, trybRynkowy, type Tryb } from "@/lib/fieldModes";
import { Karta } from "@/components/ui";
import { Poziom1View } from "@/components/Poziom1View";
import { Poziom2View } from "@/components/Poziom2View";
import { PytaniaM2, type OdpowiedziM2 } from "@/components/PytaniaM2";
import { AnkietaFinansowa } from "@/components/AnkietaFinansowa";
import { MontazPrzekrojView } from "@/components/MontazPrzekrojView";
import { rolaZeSposobu } from "@/lib/finanse/montaz";
import { Stepper, BannerBramki } from "@/components/grunt";
import { SYMBOLE_MPZP, statusZeSymbolu } from "@/lib/mpzp";
import { PodgladTerenu, type TrybMapy, type WarstwyMapy } from "@/components/GruntMap";
import { RaportView } from "@/components/RaportView";
import { liczba, statusSlowny } from "@/lib/format";
import { zapiszWynik } from "@/lib/archiwum";

const ETYK_WERDYKT_KIER: Record<KluczWerdyktu, string> = {
  spolecznyMlodzi: "Społeczny — młodzi",
  spolecznySeniorzy: "Społeczny — seniorzy",
  komunalnyMlodzi: "Komunalny — młodzi",
  komunalnySeniorzy: "Komunalny — seniorzy",
};
const KOLOR_WERD: Record<string, string> = {
  zielony: "text-grunt-green",
  zolty: "text-grunt-amber",
  czerwony: "text-grunt-red",
};

interface MetaRozw {
  pozycje: { id: string; znaleziona: boolean; znanyTeryt: boolean; zrodlo: "demo" | "uldk" | "brak" }[];
  przylegajace: boolean;
  bledy: string[];
  poleAutomatyczne: string[];
  rynek: { czynszN: number; cenaNowychN: number };
  raportZrodel?: { klucz: string; zrodlo: string; status: string; debug?: string }[];
  ksztaltSvg?: string | null;
  ksztaltGeo?: string | null;
}

const pustaPozycja = (): PozycjaDzialki => ({ wojewodztwo: "", powiat: "", gmina: "", obreb: "", numer: "" });

/** Pobiera opcje kaskady z /api/teryt (ULDK z fallbackiem do mini-słownika). */
async function pobierzOpcjeTeryt(params: Record<string, string>): Promise<{ teryt: string; nazwa: string }[]> {
  try {
    const r = await fetch(`/api/teryt?${new URLSearchParams(params).toString()}`);
    const d = await r.json();
    return Array.isArray(d.pozycje) ? d.pozycje : [];
  } catch {
    return [];
  }
}

// „uzupelnianie" to osobny ekran między M1 a M2 (nie w stepperze — mapuje się na krok M2).
// „uzupelnianie" (M1→M2) i „ankieta" (M2→M3) to osobne ekrany poza stepperem —
// mapują się odpowiednio na krok M2 i M3.
type Ekran = "wejscie" | "poziom1" | "uzupelnianie" | "poziom2" | "ankieta" | "poziom3" | "raport";
type EkranStepper = Exclude<Ekran, "uzupelnianie" | "ankieta">;
const EKRANY: EkranStepper[] = ["wejscie", "poziom1", "poziom2", "poziom3", "raport"];
const EKRAN_STEP: Record<"uzupelnianie" | "ankieta", EkranStepper> = { uzupelnianie: "poziom2", ankieta: "poziom3" };

export default function NowaAnalizaPage() {
  const [ekran, setEkran] = useState<Ekran>("wejscie");
  const [maxKrok, setMaxKrok] = useState(1);
  const [pozycje, setPozycje] = useState<PozycjaDzialki[]>([pustaPozycja()]);
  const [dane, setDane] = useState<DaneDzialki | null>(null);
  const [meta, setMeta] = useState<MetaRozw | null>(null);
  const [mediana, setMediana] = useState<{ czynsz: number; cenaNowych: number; wartoscOdtworzeniowa: number } | null>(null);
  const [wynik, setWynik] = useState<WynikAnalizy | null>(null);
  const [zapisanoDo, setZapisanoDo] = useState<string | null>(null);
  const [blad, setBlad] = useState<string | null>(null);
  const [licze, setLicze] = useState(false);
  const [recznaPow, setRecznaPow] = useState("");
  const [trybWejscia, setTrybWejscia] = useState<"kaskada" | "id">("kaskada");
  // Obecność MPZP — opcjonalna adnotacja do prognozy potencjału (P1, S3).
  // Pojemność liczy PROGNOZA (kształt + sąsiedztwo); wskaźniki nie są wprowadzane ręcznie.
  const [podstawaTyp, setPodstawaTyp] = useState<"" | "MPZP" | "BRAK">("");
  const [mpzpSymbol, setMpzpSymbol] = useState("");

  // Override P2 (A±/R) — wartości jako stringi + zbiór skorygowanych pól.
  const [p2, setP2] = useState<Record<string, string>>({});
  const [p2orig, setP2orig] = useState<Record<string, string>>({});
  // Override P3 — parametry reżimu/montażu.
  const [p3, setP3] = useState<Record<string, string>>({});
  // Profil finansowy z ankiety (brama P3).
  const [profilFin, setProfilFin] = useState<ProfilFinansowy | null>(null);
  // Interaktywne założenia M3 (suwak kosztu + WO + oprocentowanie) — WSPÓŁDZIELONE
  // przez przekrój i raport, żeby raport liczył na bieżąco to samo, co widać na M3.
  const [m3Koszt, setM3Koszt] = useState<number>(KONFIG_FINANSE.kosztBudowySuwak.domyslny);
  const [m3WO, setM3WO] = useState<number>(KONFIG_FINANSE.kosztBudowySuwak.domyslny);
  const [m3Oproc, setM3Oproc] = useState<number | null>(null); // % override, null = wg reżimu

  // ── Krok 1: identyfikacja → rozwiązanie → P1 ──────────────────────────────
  function patchPozycje(i: number, patch: Partial<PozycjaDzialki>) {
    setPozycje((ps) => ps.map((p, idx) => (idx === i ? { ...p, ...patch } : p)));
  }
  function dodajPozycje() {
    setPozycje((ps) => {
      const pierwsza = ps[0];
      return [
        ...ps,
        { ...pustaPozycja(), wojewodztwo: pierwsza.wojewodztwo, powiat: pierwsza.powiat, gmina: pierwsza.gmina, obreb: pierwsza.obreb, gminaTeryt: pierwsza.gminaTeryt },
      ];
    });
  }
  function usunPozycje(i: number) {
    setPozycje((ps) => (ps.length > 1 ? ps.filter((_, idx) => idx !== i) : ps));
  }
  // Jednostka administracyjna (TERYT) jest wspólna dla całego terenu inwestycji —
  // zmiana pola administracyjnego nakłada je na wszystkie pozycje (per-działka zostaje tylko numer).
  function patchAdminWszystkie(patch: Partial<PozycjaDzialki>) {
    setPozycje((ps) => ps.map((p) => ({ ...p, ...patch })));
  }

  // Nakłada opcjonalną adnotację o obecności MPZP na dane (przed analizą P1).
  // Pojemność zawsze liczy PROGNOZA potencjału (kształt + sąsiedztwo) — bez ręcznych wskaźników.
  function zastosujPodstawe(d: DaneDzialki | null): DaneDzialki | null {
    if (!d) return d;
    if (podstawaTyp === "MPZP") {
      // Symbol jest opcjonalny — służy wyłącznie do wykrycia przeznaczenia sprzecznego z mieszkaniowym.
      const ocena = mpzpSymbol ? statusZeSymbolu(mpzpSymbol) : null;
      return {
        ...d,
        statusPlanistyczny: ocena ? ocena.status : d.statusPlanistyczny,
        przeznaczenieSprzeczneZMieszkaniowa: ocena ? ocena.sprzeczne : d.przeznaczenieSprzeczneZMieszkaniowa,
        mpzpZadeklarowany: true,
        mpzpObecnosc: "jest",
        podstawa: { typ: "MPZP", symbol: mpzpSymbol || undefined, zrodlo: "ręczne" },
      };
    }
    if (podstawaTyp === "BRAK") {
      return { ...d, mpzpZadeklarowany: false, mpzpObecnosc: "brak", podstawa: { typ: "PROGNOZA", zrodlo: "prognoza" } };
    }
    // „Nie wiem" — prognoza z adnotacją „obecność MPZP nieznana".
    return { ...d, mpzpObecnosc: "nieznane", podstawa: { typ: "PROGNOZA", zrodlo: "prognoza" } };
  }

  async function analizujP1(e: React.FormEvent) {
    e.preventDefault();
    setBlad(null);
    if (trybWejscia === "id") {
      if (pozycje.some((p) => !p.idBezposredni?.trim())) return setBlad("Podaj pełny identyfikator ULDK dla każdej działki.");
    } else {
      if (pozycje.some((p) => !p.numer.trim())) return setBlad("Każda pozycja musi mieć numer działki.");
      if (!pozycje[0].wojewodztwo) return setBlad("Wybierz przynajmniej województwo pierwszej działki.");
    }
    setLicze(true);
    try {
      const r = await fetch("/api/rozwiaz-dzialki", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pozycje }),
      });
      const d = await r.json();
      if (!r.ok) {
        setBlad(d.blad ?? "Błąd pobierania danych.");
        return;
      }
      const dm = zastosujPodstawe(d.dane);
      setDane(dm);
      setMeta(d.meta);
      setMediana(d.medianaRegionalna);
      setRecznaPow("");
      // Jeśli pobrano geometrię (działka w ULDK) — liczymy i przechodzimy do wyniku P1.
      // W przeciwnym razie zostajemy na ekranie wejścia (ręczne podanie powierzchni).
      if (dm && dm.powierzchniaM2 > 0) {
        await przelicz(dm);
        setEkran("poziom1");
        setMaxKrok((m) => Math.max(m, 3));
      } else {
        setWynik(null);
      }
    } catch {
      setBlad("Nie udało się połączyć z serwerem.");
    } finally {
      setLicze(false);
    }
  }

  // Analiza, gdy geometria nie została pobrana automatycznie — powierzchnia ręczna.
  async function analizujZPowierzchnia() {
    if (!dane) return;
    const pow = Number(recznaPow);
    if (!(pow > 0)) {
      setBlad("Podaj powierzchnię działki (m²), aby kontynuować.");
      return;
    }
    setBlad(null);
    setLicze(true);
    const noweDane = zastosujPodstawe({ ...dane, powierzchniaM2: pow })!;
    setDane(noweDane);
    await przelicz(noweDane);
    setEkran("poziom1");
    setMaxKrok((m) => Math.max(m, 3));
    setLicze(false);
  }

  async function przelicz(daneDoLiczenia: DaneDzialki, konfiguracja?: Partial<Konfiguracja>, profil?: ProfilFinansowy | null) {
    const r = await fetch("/api/analiza-adhoc", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ dane: daneDoLiczenia, konfiguracja, profilFinansowy: profil ?? undefined }),
    });
    const d = await r.json();
    if (!r.ok) {
      setBlad(d.blad ?? "Błąd analizy.");
      setWynik(null);
    } else {
      setWynik(d);
    }
  }

  // ── „Przejdź do poziomu M2" (z M1) → OSOBNY ekran uzupełniania (nie wyniki M2). ─
  function wejdzP2() {
    if (!dane) return;
    setEkran("uzupelnianie");
    setMaxKrok((m) => Math.max(m, 3));
  }

  // Odpowiedzi z prostego formularza M2 → łata DaneDzialki + przeliczenie.
  async function przeliczZOdpowiedzi(o: OdpowiedziM2) {
    if (!dane) return;
    setLicze(true);
    const prog = KONFIG_M2.progPieszoM;
    // Odległości: zapisz metry + wyprowadź „w zasięgu pieszym" (nie nadpisuj na false przy braku danej).
    const odl = { ...(dane.odleglosciM2 ?? {}) };
    for (const [k, v] of Object.entries(o.odleglosci)) if (v != null) odl[k] = v;
    const wZasiegu = (klucz: string): boolean | null => {
      const v = odl[klucz];
      return v == null ? null : v <= prog;
    };
    const lubZasieg = (...klucze: string[]): boolean | null => {
      const znane = klucze.map(wZasiegu).filter((x) => x !== null) as boolean[];
      return znane.length === 0 ? null : znane.some(Boolean);
    };

    // Planistyka ręczna → surowe wskaźniki do KASKADY. Wchodzą do modelu tylko gdy
    // potwierdzone jako realne dane z MPZP (inaczej kaskada użyje prognozy/planu).
    const noweDane: DaneDzialki = {
      ...dane,
      odleglosciM2: Object.keys(odl).length ? odl : dane.odleglosciM2,
      dostepDrogaPubliczna: o.dostepDrogi ?? dane.dostepDrogaPubliczna,
      wysokoscOkolicyPieter: o.wysokoscOkolicyPieter ?? dane.wysokoscOkolicyPieter,
      transport: o.transport ?? dane.transport,
      uslugiPodstawowePieszo: lubZasieg("sklep", "apteka") ?? dane.uslugiPodstawowePieszo,
      pozWZasiegu: wZasiegu("poz") ?? dane.pozWZasiegu,
      zlobkiSzkolyWZasiegu: lubZasieg("szkola", "przedszkole") ?? dane.zlobkiSzkolyWZasiegu,
      wskaznikiReczne: o.planistyka
        ? {
            intensywnosc: o.planistyka.intensywnosc,
            maxWysokoscM: o.planistyka.maxWysokoscM,
            maxPowZabudowyPct: o.planistyka.maxPowZabudowyPct,
            minPbcPct: o.planistyka.minPbcPct,
          }
        : dane.wskaznikiReczne,
      wskaznikiPotwierdzone: o.planistykaPotwierdzona,
    };
    setDane(noweDane);
    await przelicz(noweDane);
    setLicze(false);
    // Po zebraniu danych i przeliczeniu → CZYSTA analiza M2 (wytyczne: przeliczenie przy wejściu do M2).
    setEkran("poziom2");
    setMaxKrok((m) => Math.max(m, 3));
  }

  // ── Przejście do P3: inicjalizacja parametrów reżimu z konfiguracji ────────
  function wejdzP3() {
    const k = domyslnaKonfiguracja().finanse;
    const b = k.rezimy.B_program_2027;
    setP3({
      oprocentowanie: String(b.oprocentowanie * 100),
      okresKredytuLata: String(b.okresKredytuLata),
      maxGrantPct: String(b.maxGrantPct),
      projektDecyzjeMies: String(k.osCzasu.projektDecyzjeMies),
      naborFinansowaniaMies: String(k.osCzasu.naborFinansowaniaMies),
      budowaMies: String(k.osCzasu.budowaMies),
      indeksKosztu: String(k.indeksy.kosztBudowyRocznie * 100),
      indeksWartOdtw: String(k.indeksy.wartoscOdtworzeniowaRocznie * 100),
      partycypacjaNajemcow: String(k.zalozenia.domyslnaPartycypacjaNajemcowPct),
      wkladGminy: String(k.zalozenia.domyslnyWkladGminyPct),
      wartoscOdtworzeniowaM2: s(dane?.wartoscOdtworzeniowaM2 ?? mediana?.wartoscOdtworzeniowa),
      kosztBudowyM2: s(dane?.kosztBudowyM2),
      cenaGruntu: s(dane?.cenaGruntu),
    });
    // „Przejdź do analizy finansowej" → OSOBNY ekran ankiety (bez montażu, jak M1→M2).
    setEkran("ankieta");
    setMaxKrok((m) => Math.max(m, 4));
  }

  // Zatwierdzenie ankiety = brama P3: zapis profilu, przeliczenie i przejście do WYNIKU M3.
  async function zatwierdzAnkiete(profil: ProfilFinansowy) {
    setProfilFin(profil);
    await przeliczP3(profil);
    // Punkt wyjścia suwaka kosztu = wartość odtworzeniowa z warstwy dla lokalizacji działki
    // (wskaźnik przeliczeniowy kosztu odtworzenia 1 m²), przycięta do zakresu suwaka.
    const s = KONFIG_FINANSE.kosztBudowySuwak;
    const wo = dane?.wartoscOdtworzeniowaM2 ?? mediana?.wartoscOdtworzeniowa ?? s.domyslny;
    setM3WO(Math.round(wo));
    setM3Koszt(Math.min(s.max, Math.max(s.min, Math.round(wo))));
    setM3Oproc(null);
    setEkran("poziom3");
    setMaxKrok((m) => Math.max(m, 4));
  }

  async function przeliczP3(profilOverride?: ProfilFinansowy) {
    if (!dane) return;
    const profil = profilOverride ?? profilFin;
    setLicze(true);
    const k = domyslnaKonfiguracja();
    const b = k.finanse.rezimy.B_program_2027;
    b.oprocentowanie = (n(p3.oprocentowanie) ?? 2) / 100;
    b.okresKredytuLata = n(p3.okresKredytuLata) ?? 50;
    b.maxGrantPct = n(p3.maxGrantPct) ?? 15;
    k.finanse.osCzasu.projektDecyzjeMies = n(p3.projektDecyzjeMies) ?? 9;
    k.finanse.osCzasu.naborFinansowaniaMies = n(p3.naborFinansowaniaMies) ?? 5;
    k.finanse.osCzasu.budowaMies = n(p3.budowaMies) ?? 24;
    k.finanse.indeksy.kosztBudowyRocznie = (n(p3.indeksKosztu) ?? 5) / 100;
    k.finanse.indeksy.wartoscOdtworzeniowaRocznie = (n(p3.indeksWartOdtw) ?? 4) / 100;
    k.finanse.zalozenia.domyslnaPartycypacjaNajemcowPct = n(p3.partycypacjaNajemcow) ?? 0;
    k.finanse.zalozenia.domyslnyWkladGminyPct = n(p3.wkladGminy) ?? 0;

    // Wartość działki z ankiety → cena gruntu w modelu (gdy zakup) — spójność z raportem.
    const rolaDz = profil ? rolaZeSposobu(profil.sposobWniesieniaDzialki) : "neutralna";
    const cenaGruntu = profil?.wartoscDzialkiPln != null && rolaDz === "koszt" ? profil.wartoscDzialkiPln : n(p3.cenaGruntu);
    const noweDane: DaneDzialki = {
      ...dane,
      wartoscOdtworzeniowaM2: n(p3.wartoscOdtworzeniowaM2),
      kosztBudowyM2: n(p3.kosztBudowyM2),
      cenaGruntu,
    };
    setDane(noweDane);
    await przelicz(noweDane, k, profil);
    setMaxKrok((m) => Math.max(m, 5));
    setLicze(false);
  }

  const korektyP2 = Object.keys(p2).filter((k) => p2orig[k] !== undefined && p2[k] !== p2orig[k]);
  // Ekrany poza stepperem mapują się na swój krok (uzupełnianie→M2, ankieta→M3).
  const stepAktywny =
    ekran === "uzupelnianie" || ekran === "ankieta"
      ? EKRANY.indexOf(EKRAN_STEP[ekran]) + 1
      : EKRANY.indexOf(ekran as EkranStepper) + 1;

  function cofnij() {
    if (ekran === "uzupelnianie") { setEkran("poziom1"); return; }
    if (ekran === "poziom2") { setEkran("uzupelnianie"); return; }
    if (ekran === "ankieta") { setEkran("poziom2"); return; }
    if (ekran === "poziom3") { setEkran("ankieta"); return; }
    const i = EKRANY.indexOf(ekran as EkranStepper);
    if (i > 0) setEkran(EKRANY[i - 1]);
  }
  function idzDoKroku(nr: number) {
    if (nr >= 1 && nr <= maxKrok) setEkran(EKRANY[nr - 1]);
  }

  return (
    <div className="space-y-5">
      <div className="-mx-4 sm:-mx-6 -mt-6">
        <Stepper aktywny={stepAktywny} maxOsiagniety={maxKrok} onKrok={idzDoKroku} />
        {dane && ekran !== "wejscie" && ekran !== "poziom1" && (
          <div className="bg-grunt-surface border-b border-grunt-border px-4 sm:px-6 py-2 flex flex-wrap items-center gap-x-4 sm:gap-x-6 gap-y-1">
            <span className="text-[10px] uppercase tracking-wider text-grunt-text-faint">Teren inwestycji</span>
            <span className="mono text-[12px] text-grunt-text">{dane.id}</span>
            {dane.powierzchniaM2 > 0 && <span className="mono text-[12px] text-grunt-text-muted">{liczba(dane.powierzchniaM2, " m²")}</span>}
            {dane.gmina && <span className="text-[12px] text-grunt-text-muted">{dane.gmina}</span>}
          </div>
        )}
      </div>

      {/* Pasek nawigacji: powrót do poprzedniego ekranu */}
      {ekran !== "wejscie" && (
        <div className="flex items-center justify-end gap-3">
          <button onClick={cofnij} className="btn-secondary">← Wstecz</button>
        </div>
      )}

      {blad && <p className="text-sm text-grunt-red bg-grunt-red-bg border border-grunt-red/25 rounded-md px-3 py-2">{blad}</p>}

      {/* EKRAN: RAPORT (studium) */}
      {ekran === "raport" && wynik && (
        <div className="space-y-4">
          <div className="brak-druku flex justify-end items-center gap-3">
            {zapisanoDo && (
              <span className="text-[12px] text-grunt-green">
                ✓ Zapisano w archiwum ·{" "}
                <a href="/archiwum" className="underline hover:text-grunt-ink">Przeanalizowane działki</a>
              </span>
            )}
            <button
              onClick={() => { zapiszWynik(wynik); setZapisanoDo(wynik.dane.id); }}
              className="btn-secondary"
              style={{ height: "var(--grunt-h-cta)" }}
            >
              {zapisanoDo === wynik.dane.id ? "Zaktualizuj w archiwum" : "Zapisz do archiwum"}
            </button>
            <button onClick={() => window.print()} className="btn-primary" style={{ height: "var(--grunt-h-cta)" }}>↓ Pobierz PDF (drukuj)</button>
          </div>
          <RaportView wynik={wynik} data={new Date().toLocaleDateString("pl-PL")} kosztBudowyM2={m3Koszt} wartoscOdtworzeniowaM2={m3WO} oprocPct={m3Oproc} />
        </div>
      )}

      {/* EKRAN STARTOWY (wejście) — pełnoekranowy ciemny hero + formularz „Wskaż działkę"
          wg wytycznych wizualnych. Renderowany jako nakładka (fixed) przykrywająca chrome. */}
      {ekran === "wejscie" && (
        <EkranWejscia
          trybWejscia={trybWejscia}
          setTrybWejscia={setTrybWejscia}
          pozycje={pozycje}
          patchNumer={(i, numer) => patchPozycje(i, { numer })}
          patchId={(i, idBezposredni) => patchPozycje(i, { idBezposredni })}
          patchAdmin={patchAdminWszystkie}
          dodajPozycje={dodajPozycje}
          usunPozycje={usunPozycje}
          analizuj={analizujP1}
          licze={licze}
          blad={blad}
          dane={dane}
          recznaPow={recznaPow}
          setRecznaPow={setRecznaPow}
          analizujZPowierzchnia={analizujZPowierzchnia}
        />
      )}

      {/* POZIOM 1 — potwierdzenie wczytania: teren, mapa, źródła (jeden ekran) */}
      {ekran === "poziom1" && dane && meta && (
        <PotwierdzenieDanych dane={dane} meta={meta} p1={wynik?.poziom1} />
      )}


      {/* EKRAN UZUPEŁNIANIA (osobny, między M1 a M2) — mapa + pytania; BEZ wyników M2. */}
      {ekran === "uzupelnianie" && dane && (
        <div className="space-y-4">
          <div className="grid lg:grid-cols-[minmax(0,430px)_1fr] gap-4 items-start">
            <div className="lg:sticky" style={{ top: "var(--grunt-sticky-top)" }}>
              <PodgladTerenu
                mode={meta?.przylegajace === false ? "nonadjacent" : "ok"}
                view="level2"
                height={340}
                layers={warstwyP2(dane, wynik?.poziom1.profilRekomendowany)}
                shape={meta?.ksztaltSvg ?? ""}
                geo={meta?.ksztaltGeo ?? ""}
              />
            </div>
            <PytaniaM2 dane={dane} onPrzelicz={przeliczZOdpowiedzi} licze={licze} />
          </div>
        </div>
      )}

      {/* POZIOM 2 — CZYSTA analiza (bez pytań); pytania są na ekranie uzupełniania. */}
      {ekran === "poziom2" && dane && (
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-3">
            <p className="text-[12px] text-grunt-text-muted2">Analiza na zebranych danych. Więcej danych → dokładniejsza ocena.</p>
            <button onClick={() => setEkran("uzupelnianie")} className="btn-secondary">Uzupełnij więcej danych</button>
          </div>
        </div>
      )}

      {/* EKRAN ANKIETY (osobny, między M2 a M3) — profil finansowy; BEZ montażu (motywacja). */}
      {ekran === "ankieta" && dane && (
        <AnkietaFinansowa
          onSubmit={zatwierdzAnkiete}
          licze={licze}
          wartoscDzialkiSugestia={dane.cenaGruntu ?? null}
        />
      )}

      {/* WYNIKI — jeden ekran = jeden poziom; szczegóły tylko dla administratora */}
      {wynik && wynik.poziom1 && (
        <div className="space-y-4">
          {ekran === "poziom1" && (
            <EkranM1
              key={wynik.poziom1.dzialkaId}
              p1={wynik.poziom1}
              onDalej={wejdzP2}
              onKoniec={() => { setWynik(null); setEkran("wejscie"); setMaxKrok(1); }}
            />
          )}
          {ekran === "poziom2" && (
            <>
              {/* Bez audytu braków na ekranie klienckim (wg wytycznych M2) — braki zostają w raporcie PDF. */}
              <Poziom2View p2={wynik.poziom2} profilRek={wynik.poziom1.profilRekomendowany} sygnaly={wynik.poziom2.sygnaly} />
              <BannerBramki
                tytul="Poziom 2 gotowy — czas na model finansowy"
                opis="Osobny ekran ankiety (kto pyta i jak finansuje), potem przekrój montażu w obu reżimach."
                akcja={wejdzP3}
                akcjaLabel="Przejdź do analizy finansowej"
              />
            </>
          )}
          {ekran === "poziom3" && profilFin && (() => {
            const warianty = wynik.poziom2.warianty;
            const idx = Math.max(0, warianty.findIndex((w) => wynik.poziom1.profilRekomendowany === "oba" || w.profil === wynik.poziom1.profilRekomendowany));
            const wariant = warianty[idx] ?? warianty[0];
            return (
              <>
                <MontazPrzekrojView
                  wariant={wariant}
                  woMeta={dane?.woMeta ?? null}
                  odlegloscDoSieciM={dane?.odlegloscDoSieciM ?? null}
                  profil={profilFin}
                  kosztBudowyM2={m3Koszt}
                  onKoszt={setM3Koszt}
                  wartoscOdtworzeniowaM2={m3WO}
                  onWO={setM3WO}
                  oprocPct={m3Oproc}
                  onOproc={setM3Oproc}
                />
                <BannerBramki
                  tytul="Studium gotowe — wygeneruj raport"
                  opis="Drukowalne podsumowanie: werdykt, pewność sekcji, model zabudowy i finansowy, prowenancja."
                  akcja={() => { setEkran("raport"); setMaxKrok((m) => Math.max(m, 5)); }}
                  akcjaLabel="Otwórz studium (raport)"
                />
              </>
            );
          })()}
        </div>
      )}
    </div>
  );
}

// Warstwy mapy Poziomu 2 z danych działki i rekomendowanego profilu.
function warstwyP2(dane: DaneDzialki, profil?: string): WarstwyMapy {
  return {
    parcel: true,
    env: dane.natura2000 === true || dane.ochronaWykluczajaca === true,
    plan: dane.statusPlanistyczny === "brak_danych",
    iso_m: profil === "mlodzi" || profil === "oba",
    iso_s: profil === "seniorzy" || profil === "oba",
  };
}

// Panel kompletności oceny — udział wypełnionych pól ręcznych (R/R?).
function KompletnoscOceny({ p2 }: { p2: Record<string, string> }) {
  const pola = [
    { k: "wlasnoscKW", label: "Własność / KW / obciążenia" },
    { k: "warunkiPrzylaczenia", label: "Warunki i koszt przyłączenia" },
    { k: "geotechnika", label: "Geotechnika / nośność" },
  ];
  const wypelnione = pola.filter((p) => (p2[p.k] ?? "").trim() !== "").length;
  const pct = Math.round((wypelnione / pola.length) * 100);
  return (
    <Karta
      tytul="Pola ręczne — kompletność oceny"
      prawy={<span className="mono text-[13px] font-semibold text-grunt-text">{wypelnione}/{pola.length} · {pct}%</span>}
    >
      <div className="h-2 bg-grunt-surface-3 rounded-full overflow-hidden mb-3">
        <div className="h-full bg-grunt-ink rounded-full transition-all" style={{ width: `${pct}%` }} />
      </div>
      <div className="grid sm:grid-cols-2 gap-2">
        {pola.map((p) => {
          const done = (p2[p.k] ?? "").trim() !== "";
          return (
            <div key={p.k} className="flex items-start gap-2 text-[12.5px]">
              <span className={`mt-0.5 grid place-items-center w-4 h-4 rounded-full text-[10px] shrink-0 ${done ? "bg-grunt-green text-white" : "border border-grunt-border text-grunt-text-ghost"}`}>
                {done ? "✓" : ""}
              </span>
              <div>
                <div className="text-grunt-text-3">{p.label}</div>
                <div className={done ? "text-grunt-text font-medium" : "text-grunt-amber-text2"}>{done ? p2[p.k] : "Do uzupełnienia"}</div>
              </div>
            </div>
          );
        })}
      </div>
      <p className="text-[11px] text-grunt-text-faint2 mt-3">
        Pola ręczne (R) nie blokują analizy — sygnalizują braki obniżające pewność. Uzupełnij je niżej.
      </p>
    </Karta>
  );
}

// ── Pomocnicze konwersje ─────────────────────────────────────────────────────
const s = (v: number | null | undefined): string => (v === null || v === undefined ? "" : String(v));
const n = (v: string): number | null => (v.trim() === "" ? null : Number(v));
const fmtv = (v: number | null, suf = ""): string => (v === null ? "brak" : `${v}${suf}`);
const tak = (v: boolean | null): string => (v === null ? "brak" : v ? "tak" : "nie");

// ── Komponenty ───────────────────────────────────────────────────────────────

function TrybBadge({ tryb }: { tryb: Tryb }) {
  const o = OPIS_TRYBU[tryb];
  return <span className={`badge ${o.klasa}`} title={o.opis}>{o.nazwa}</span>;
}

/** Ekran startowy (wejście) — pełnoekranowy ciemny hero + formularz „Wskaż działkę". */
function EkranWejscia({
  trybWejscia, setTrybWejscia, pozycje, patchNumer, patchId, patchAdmin,
  dodajPozycje, usunPozycje, analizuj, licze, blad, dane, recznaPow, setRecznaPow, analizujZPowierzchnia,
}: {
  trybWejscia: "kaskada" | "id";
  setTrybWejscia: (t: "kaskada" | "id") => void;
  pozycje: PozycjaDzialki[];
  patchNumer: (i: number, numer: string) => void;
  patchId: (i: number, id: string) => void;
  patchAdmin: (patch: Partial<PozycjaDzialki>) => void;
  dodajPozycje: () => void;
  usunPozycje: (i: number) => void;
  analizuj: (e: React.FormEvent) => void;
  licze: boolean;
  blad: string | null;
  dane: DaneDzialki | null;
  recznaPow: string;
  setRecznaPow: (v: string) => void;
  analizujZPowierzchnia: () => void;
}) {
  const p0 = pozycje[0];
  type OT = { teryt: string; nazwa: string };
  const [wojOpts, setWojOpts] = useState<OT[]>(WOJEWODZTWA.map((w) => ({ teryt: w.kod, nazwa: w.nazwa })));
  const [powOpts, setPowOpts] = useState<OT[]>([]);
  const [gmOpts, setGmOpts] = useState<OT[]>([]);
  const [obrOpts, setObrOpts] = useState<OT[]>([]);
  useEffect(() => { pobierzOpcjeTeryt({ poziom: "wojewodztwa" }).then((o) => o.length && setWojOpts(o)); }, []);
  useEffect(() => { if (!p0.wojewodztwo) { setPowOpts([]); return; } pobierzOpcjeTeryt({ poziom: "powiaty", wojNazwa: p0.wojewodztwo }).then(setPowOpts); }, [p0.wojewodztwo]);
  useEffect(() => { if (!p0.wojewodztwo || !p0.powiat) { setGmOpts([]); return; } pobierzOpcjeTeryt({ poziom: "gminy", wojNazwa: p0.wojewodztwo, powiatNazwa: p0.powiat }).then(setGmOpts); }, [p0.wojewodztwo, p0.powiat]);
  useEffect(() => { if (!p0.wojewodztwo || !p0.powiat || !p0.gmina) { setObrOpts([]); return; } pobierzOpcjeTeryt({ poziom: "obreby", wojNazwa: p0.wojewodztwo, powiatNazwa: p0.powiat, gminaNazwa: p0.gmina }).then(setObrOpts); }, [p0.wojewodztwo, p0.powiat, p0.gmina]);

  const n = pozycje.length;
  const slowoDzialka = n === 1 ? "działka" : n % 10 >= 2 && n % 10 <= 4 && (n % 100 < 10 || n % 100 >= 20) ? "działki" : "działek";
  const brakGeometrii = dane != null && dane.powierzchniaM2 === 0;

  // Portal do <body>: nakładka jako bezpośrednie dziecko body — pewne pełne przykrycie
  // chrome aplikacji (niezależnie od kontekstów pozycjonowania w drzewie).
  const [zamontowano, setZamontowano] = useState(false);
  useEffect(() => setZamontowano(true), []);
  if (!zamontowano) return null;

  return createPortal(
    <div className="fixed inset-0 z-50 overflow-y-auto text-white" style={{ background: "linear-gradient(155deg,#0B1524 0%,#0F2036 52%,#123049 100%)" }}>
      {/* Dekoracja: wireframe działki + poświata */}
      <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute" style={{ top: -80, right: 40, width: 520, height: 420, background: "radial-gradient(50% 50% at 60% 40%, rgba(111,227,196,.10) 0%, rgba(111,227,196,0) 70%)" }} />
        <svg className="absolute" style={{ top: 30, right: 120, opacity: 0.5 }} width="360" height="230" viewBox="0 0 360 230" fill="none">
          <polygon points="40,150 150,40 320,70 300,210 90,200" stroke="#3FE0BE" strokeWidth="1.4" fill="rgba(63,224,190,.05)" />
          <circle cx="150" cy="40" r="3" fill="#3FE0BE" /><circle cx="320" cy="70" r="3" fill="#3FE0BE" /><circle cx="300" cy="210" r="3" fill="#3FE0BE" />
        </svg>
      </div>

      {/* Pasek startowy: logo + użytkownik */}
      <header className="relative flex items-center justify-between px-4 sm:px-6 lg:px-10" style={{ height: 66 }}>
        <div className="flex items-center gap-2.5">
          <span className="grid place-items-center w-[34px] h-[34px] rounded-md bg-white/10">
            <span className="block w-3 h-3 rounded-[3px] bg-grunt-mint" />
          </span>
          <span className="flex flex-col leading-none">
            <span className="text-[17px] font-bold text-white" style={{ letterSpacing: "0.10em" }}>GRUNT</span>
            <span className="text-[9.5px] uppercase mt-0.5 text-white/55" style={{ letterSpacing: "0.11em" }}>Studium potencjału działki</span>
          </span>
        </div>
        <div className="flex items-center gap-2.5">
          <span className="grid place-items-center w-9 h-9 rounded-full text-[12px] font-semibold text-grunt-ink" style={{ background: "#3FE0BE" }}>ML</span>
          <span className="hidden sm:flex flex-col leading-tight">
            <span className="text-[13px] font-medium text-white">M. Lewandowska</span>
            <span className="text-[11px] text-white/55">Gmina Lesznowola</span>
          </span>
        </div>
      </header>

      {/* Treść: dwa panele */}
      <div className="relative mx-auto px-4 sm:px-6 lg:px-10 pb-16" style={{ maxWidth: 1360 }}>
        <div className="grid lg:grid-cols-[1fr_minmax(0,560px)] gap-8 lg:gap-14 items-start lg:items-center lg:min-h-[calc(100vh-140px)]">
          {/* Lewy hero */}
          <div>
            <span className="inline-flex items-center gap-2 rounded-full px-3.5 py-1.5 text-[12.5px] font-medium" style={{ background: "rgba(255,255,255,.06)", border: "1px solid rgba(255,255,255,.12)", color: "#CBD8E8" }}>
              <span className="w-2 h-2 rounded-full" style={{ background: "#3FE0BE" }} />
              Nowa analiza działki
            </span>
            <h1 className="mt-6 font-semibold text-white text-[32px] sm:text-[40px] lg:text-[46px]" style={{ lineHeight: 1.08, letterSpacing: "-0.02em" }}>
              Zacznij od jednej<br />działki. Resztę<br /><span style={{ color: "#3FE0BE" }}>policzymy za Ciebie.</span>
            </h1>
            <p className="mt-6 max-w-[460px] text-[15.5px] leading-relaxed" style={{ color: "#A9BBD2" }}>
              Wpisz numer działki, a GRUNT zbierze dane publiczne, planistykę i reżimy finansowania — i przygotuje
              kompletne studium potencjału inwestycyjnego pod mieszkalnictwo.
            </p>
            <div className="mt-8 space-y-4 max-w-[460px]">
              <PunktWejscia ikona="check" tytul="Werdykt w kilka minut" opis="Czy działka nadaje się pod mieszkalnictwo — osobno dla młodych i seniorów." />
              <PunktWejscia ikona="dot" tytul="Pełne studium działki" opis="Planistyka, uzbrojenie, środowisko i rynek — zebrane z rejestrów publicznych." />
              <PunktWejscia ikona="sigma" tytul="Model finansowy" opis="Montaż finansowania i odpowiedź, czy inwestycja się spina w danym reżimie." />
            </div>
          </div>

          {/* Prawy formularz */}
          <form onSubmit={analizuj} className="rounded-[18px] bg-white text-grunt-text p-6 lg:p-7" style={{ boxShadow: "0 30px 70px rgba(6,14,26,.45)" }}>
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-[18px] font-semibold text-grunt-text">Wskaż działkę</h2>
              <div className="inline-flex p-0.5 rounded-[9px] text-[12.5px] font-medium" style={{ background: "#F1F4F8" }}>
                <button type="button" onClick={() => setTrybWejscia("kaskada")} className="px-3 py-1.5 rounded-[7px]" style={trybWejscia === "kaskada" ? { background: "#fff", color: "#16263F", boxShadow: "0 1px 2px rgba(20,38,63,.08)" } : { color: "#6B7A92" }}>TERYT</button>
                <button type="button" onClick={() => setTrybWejscia("id")} className="px-3 py-1.5 rounded-[7px]" style={trybWejscia === "id" ? { background: "#fff", color: "#16263F", boxShadow: "0 1px 2px rgba(20,38,63,.08)" } : { color: "#6B7A92" }}>Identyfikator działki</button>
              </div>
            </div>

            {trybWejscia === "kaskada" ? (
              <>
                <p className="mt-3 text-[12.5px]" style={{ color: "#6B7A92" }}>Wybierz jednostkę administracyjną (TERYT), a następnie podaj numer działki w obrębie.</p>
                <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <Lab label="Województwo">
                    <select value={p0.wojewodztwo} onChange={(e) => patchAdmin({ wojewodztwo: e.target.value, powiat: "", gmina: "", obreb: "", gminaTeryt: undefined })} className="inp bg-white">
                      <option value="">—</option>
                      {wojOpts.map((w) => <option key={w.teryt} value={w.nazwa}>{w.nazwa}</option>)}
                    </select>
                  </Lab>
                  <Lab label="Powiat">
                    <input list="ew-pow" value={p0.powiat} onChange={(e) => patchAdmin({ powiat: e.target.value, gmina: "", obreb: "", gminaTeryt: undefined })} className="inp" />
                    <datalist id="ew-pow">{powOpts.map((x) => <option key={x.teryt} value={x.nazwa} />)}</datalist>
                  </Lab>
                  <Lab label="Gmina">
                    <input list="ew-gm" value={p0.gmina} onChange={(e) => { const opt = gmOpts.find((o) => o.nazwa === e.target.value); patchAdmin({ gmina: e.target.value, obreb: "", gminaTeryt: opt?.teryt }); }} className="inp" />
                    <datalist id="ew-gm">{gmOpts.map((x) => <option key={x.teryt} value={x.nazwa} />)}</datalist>
                  </Lab>
                  <Lab label="Obręb">
                    <input list="ew-ob" value={p0.obreb} onChange={(e) => patchAdmin({ obreb: e.target.value })} className="inp" placeholder="np. 0010" />
                    <datalist id="ew-ob">{obrOpts.map((x) => <option key={x.teryt} value={x.teryt}>{x.nazwa}</option>)}</datalist>
                  </Lab>
                </div>

                <div className="mt-5">
                  <div className="text-[12px] font-medium" style={{ color: "#6B7A92" }}>Numery działek · {n} {slowoDzialka}</div>
                  <div className="mt-2 space-y-2">
                    {pozycje.map((p, i) => (
                      <div key={i} className="flex items-center gap-2">
                        <span className="grid place-items-center w-8 h-9 rounded-[8px] mono text-[12px] shrink-0" style={{ background: "#F1F4F8", color: "#6B7A92" }}>{i + 1}</span>
                        <input value={p.numer} onChange={(e) => patchNumer(i, e.target.value)} className="inp flex-1" placeholder="np. 142/7" />
                        {pozycje.length > 1 && (
                          <button type="button" onClick={() => usunPozycje(i)} className="text-[12px] px-2 py-2 rounded-[8px]" style={{ color: "#C0392B" }}>Usuń</button>
                        )}
                      </div>
                    ))}
                  </div>
                  <button type="button" onClick={dodajPozycje} className="mt-2 text-[13px] rounded-[9px] px-3 py-2" style={{ border: "1px solid #DDE3EB", color: "#3A4D6B" }}>+ Dodaj działkę</button>
                </div>
              </>
            ) : (
              <>
                <p className="mt-3 text-[12.5px]" style={{ color: "#6B7A92" }}>Podaj pełny identyfikator ULDK działki (TERYT_gminy.obręb.numer).</p>
                <div className="mt-4 space-y-2">
                  {pozycje.map((p, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <span className="grid place-items-center w-8 h-9 rounded-[8px] mono text-[12px] shrink-0" style={{ background: "#F1F4F8", color: "#6B7A92" }}>{i + 1}</span>
                      <input value={p.idBezposredni ?? ""} onChange={(e) => patchId(i, e.target.value)} className="inp flex-1 font-mono" placeholder="np. 160707_3.0006.51/2" />
                      {pozycje.length > 1 && (
                        <button type="button" onClick={() => usunPozycje(i)} className="text-[12px] px-2 py-2 rounded-[8px]" style={{ color: "#C0392B" }}>Usuń</button>
                      )}
                    </div>
                  ))}
                </div>
                <button type="button" onClick={dodajPozycje} className="mt-2 text-[13px] rounded-[9px] px-3 py-2" style={{ border: "1px solid #DDE3EB", color: "#3A4D6B" }}>+ Dodaj działkę</button>
              </>
            )}

            {blad && <p className="mt-4 text-[13px] rounded-[9px] px-3 py-2" style={{ background: "#FBE7E4", color: "#C0392B", border: "1px solid rgba(192,57,43,.25)" }}>{blad}</p>}

            {brakGeometrii && (
              <div className="mt-4 rounded-[10px] px-3 py-3" style={{ background: "#FBF0DA", border: "1px solid rgba(181,121,11,.25)" }}>
                <p className="text-[12.5px]" style={{ color: "#8A5C08" }}>Nie pobrano geometrii dla podanego identyfikatora. Podaj powierzchnię ręcznie, aby uruchomić analizę.</p>
                <div className="mt-2 flex items-end gap-2">
                  <input type="number" value={recznaPow} onChange={(e) => setRecznaPow(e.target.value)} className="inp w-40" placeholder="Powierzchnia (m²)" />
                  <button type="button" onClick={analizujZPowierzchnia} disabled={licze} className="btn-secondary" style={{ height: "var(--grunt-h-input)" }}>{licze ? "Liczę…" : "Analizuj z powierzchnią"}</button>
                </div>
              </div>
            )}

            <button type="submit" disabled={licze} className="mt-5 w-full inline-flex items-center justify-center gap-2 rounded-[11px] bg-grunt-ink text-white text-[15px] font-semibold" style={{ height: 52 }}>
              {licze ? "Pobieram dane i liczę…" : <>Analizuj działkę <span aria-hidden>→</span></>}
            </button>
            <p className="mt-3 flex items-center gap-2 text-[12px]" style={{ color: "#6B7A92" }}>
              <span className="w-2 h-2 rounded-full" style={{ background: "#1C8A5A" }} />
              Kilka przylegających działek scalimy w jeden teren inwestycji.
            </p>
          </form>
        </div>
      </div>
    </div>,
    document.body
  );
}

function PunktWejscia({ ikona, tytul, opis }: { ikona: "check" | "dot" | "sigma"; tytul: string; opis: string }) {
  const glif: Record<string, React.ReactNode> = {
    check: <path d="M5 12l4.5 4.5L19 7" />,
    dot: <circle cx="12" cy="12" r="4.5" />,
    sigma: <path d="M17 5H7l6 7-6 7h10" />,
  };
  return (
    <div className="flex gap-3.5">
      <span className="grid place-items-center shrink-0 w-9 h-9 rounded-[9px]" style={{ background: "rgba(63,224,190,.12)", border: "1px solid rgba(63,224,190,.25)" }}>
        <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#3FE0BE" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">{glif[ikona]}</svg>
      </span>
      <div>
        <div className="text-[14.5px] font-semibold text-white">{tytul}</div>
        <div className="text-[12.5px] mt-0.5 leading-relaxed" style={{ color: "#A9BBD2" }}>{opis}</div>
      </div>
    </div>
  );
}

// ── Ekran M1 z bramką wielkości/kształtu (fizyczna wykonalność + forma + próg opłacalności) ──
// M1 = CZYSTY wynik przesiewu. Bramka rozstrzyga, czy w ogóle pokazać werdykty:
//  • nieprzydatna/scalenie → sam komunikat (bez werdyktów, bez przejścia do M2);
//  • niższa opłacalność/konflikt → punkt decyzyjny (obserwacja + „analizować dalej?");
//  • ok → model zabudowy + werdykty + przejście do M2.
function EkranM1({ p1, onDalej, onKoniec }: { p1: WynikPoziom1; onDalej: () => void; onKoniec: () => void }) {
  const br = p1.bramkaWielkosci;
  const [skalaOk, setSkalaOk] = useState(false);
  const blokuje = br.wynik === "nieprzydatna" || br.wynik === "scalenie";
  const pytanie = (br.wynik === "nizsza_oplacalnosc" || br.wynik === "konflikt") && !skalaOk;

  if (blokuje) {
    return (
      <div className="space-y-4">
        <KomunikatBramki bramka={br} />
        <BannerBramki
          tytul="Analiza wstępna zatrzymana"
          opis="Sprawdź inną działkę albo teren po scaleniu z sąsiednimi."
          secondary={onKoniec}
          secondaryLabel="Nowa analiza"
        />
      </div>
    );
  }

  // Punkt decyzyjny opłacalności = MODAL (osobne okno) nad modelem zabudowy; zatrzymuje
  // przed pełną analizą i pyta „analizować dalej?". Bez stałej etykiety/noty w widoku.
  if (pytanie) {
    return (
      <div className="space-y-4">
        <KartaFormy bramka={br} />
        <ModalOplacalnosc bramka={br} onTak={() => setSkalaOk(true)} onKoniec={onKoniec} />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <KartaFormy bramka={br} />
      <Poziom1View p1={p1} pelny pokazRekomendacje={false} />
      <BannerBramki
        tytul="Poziom 1 zaliczony — przejdź do oceny działki"
        opis="Poziom 2 odsłania model zabudowy i warianty."
        akcja={onDalej}
        akcjaLabel="Przejdź do Poziomu 2"
      />
    </div>
  );
}

function KomunikatBramki({ bramka }: { bramka: BramkaWielkosci }) {
  const scalenie = bramka.wynik === "scalenie";
  return (
    <div className={`flex items-start gap-3 rounded-md border px-3.5 py-3 ${scalenie ? "border-grunt-amber/30 bg-grunt-amber-bg" : "border-grunt-red/25 bg-grunt-red-bg"}`}>
      <span className={`mono grid place-items-center shrink-0 w-6 h-6 rounded-full text-white text-[13px] font-bold ${scalenie ? "bg-grunt-amber" : "bg-grunt-red"}`}>{scalenie ? "⚑" : "✕"}</span>
      <div>
        <div className={`text-[13px] font-semibold ${scalenie ? "text-grunt-amber-text" : "text-grunt-red"}`}>{scalenie ? "Działka zbyt mała samodzielnie" : "Działka nie nadaje się pod zabudowę"}</div>
        <div className="text-[12px] text-grunt-text-muted mt-0.5">{bramka.komunikat}</div>
      </div>
    </div>
  );
}

function KartaFormy({ bramka }: { bramka: BramkaWielkosci }) {
  return (
    <Karta tytul="Model zabudowy — orientacyjna skala" podtytul="Dwie formy liczone tym samym łańcuchem; rekomendowana daje najwięcej lokali">
      <div className="grid sm:grid-cols-2 gap-3">
        <FormaBox etykieta="Zabudowa niska (do 2 kond.)" f={bramka.niska} rekomendowana={bramka.formaRekomendowana === "niska"} />
        <FormaBox etykieta="Zabudowa wysoka (powyżej 2 kond.)" f={bramka.wysoka} rekomendowana={bramka.formaRekomendowana === "wysoka"} />
      </div>
      <p className="text-[11px] text-grunt-text-faint2 mt-2">Skala orientacyjna z kształtu działki i zabudowy sąsiedztwa — nie zastępuje ustaleń MPZP/WZ (potwierdzenie na Poziomie 2).</p>
    </Karta>
  );
}

// Etykieta „w progu opłacalności" USUNIĘTA ze stałego widoku — próg opłacalności
// ujawnia się WYŁĄCZNIE jako modal (osobne okno), gdy skala < próg (wytyczne §2.2/§5).
function FormaBox({ etykieta, f, rekomendowana }: { etykieta: string; f: PojemnoscForma; rekomendowana: boolean }) {
  return (
    <div className={`rounded-card border p-3 ${rekomendowana ? "border-grunt-ink shadow-raised" : "border-grunt-border"}`}>
      <div className="flex items-center justify-between gap-2">
        <span className="text-[12px] font-semibold text-grunt-text">{etykieta}</span>
        {rekomendowana && <span className="badge bg-grunt-ink text-white text-[10px] shrink-0">★ REKOMENDOWANA</span>}
      </div>
      <div className="flex items-end gap-1 mt-2">
        <span className="mono text-[28px] font-semibold leading-none text-grunt-text">{f.lokali}</span>
        <span className="text-[12px] text-grunt-text-faint2 mb-0.5">lokali</span>
      </div>
      <div className="text-[11px] text-grunt-text-muted2 mt-1">{f.kondygnacje} kond. · PUM ~{liczba(f.pumM2, " m²")}</div>
      {!rekomendowana && <div className="text-[11px] mt-1 text-grunt-text-faint2">forma alternatywna</div>}
    </div>
  );
}

// Modal (osobne okno) punktu decyzyjnego opłacalności — pojawia się RAZ, gdy skala
// < próg. Obserwacja z zaproszeniem, nie wyrok. Po „Tak" analiza toczy się dalej.
function ModalOplacalnosc({ bramka, onTak, onKoniec }: { bramka: BramkaWielkosci; onTak: () => void; onKoniec: () => void }) {
  return (
    <div className="fixed inset-0 z-50 grid place-items-center p-4 bg-black/40" role="dialog" aria-modal="true">
      <div className="w-full max-w-md rounded-panel bg-grunt-surface shadow-sheet border border-grunt-border p-5">
        <div className="text-[14px] font-semibold text-grunt-text mb-1">
          {bramka.konfliktProgow ? "Kierunek zabudowy — Twoja decyzja" : "Zwróć uwagę na skalę"}
        </div>
        <p className="text-[13px] text-grunt-text-muted leading-relaxed">{bramka.komunikat}</p>
        <div className="flex flex-wrap gap-2 justify-end mt-5">
          <button onClick={onKoniec} className="px-3.5 py-2 rounded-md text-[13px] border border-grunt-border text-grunt-text-muted hover:bg-grunt-surface-3">
            Zakończ
          </button>
          <button onClick={onTak} className="px-3.5 py-2 rounded-md text-[13px] bg-grunt-ink text-white font-medium hover:opacity-90">
            Tak, analizuj dalej
          </button>
        </div>
      </div>
    </div>
  );
}

function PotwierdzenieDanych({ dane, meta, p1 }: { dane: DaneDzialki; meta: MetaRozw; p1?: WynikPoziom1 }) {
  const trybMapy: TrybMapy = dane.powierzchniaM2 === 0 ? "notfound" : meta.przylegajace === false ? "nonadjacent" : "ok";
  const ocena = p1?.ocenaPopytu;
  const rek = ocena ? ocena.werdykty[ocena.rekomendowanyKierunek] : null;
  return (
    <div className="grid lg:grid-cols-2 gap-4 items-start">
    <Karta tytul="Teren inwestycji (A°, potwierdzenie wczytania)" podtytul="Scalona geometria z ULDK — dane automatyczne pobrane w tle">
      {/* Identyfikacja terenu (konsolidacja górnego paska) */}
      <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1 mb-3 pb-3 border-b border-grunt-divider">
        <span className="text-[10px] uppercase tracking-wider text-grunt-text-faint">Teren inwestycji</span>
        <span className="mono text-[13px] text-grunt-text">{dane.id}</span>
        {dane.powierzchniaM2 > 0 && <span className="mono text-[12px] text-grunt-text-muted">{liczba(dane.powierzchniaM2, " m²")}</span>}
        {dane.gmina && <span className="text-[12px] text-grunt-text-muted">{dane.gmina}</span>}
      </div>
      {/* Rekomendowany kierunek — ukryty, gdy bramka wielkości zatrzymuje działkę (bez werdyktów). */}
      {rek && ocena && p1?.bramkaWielkosci?.fizycznieWykonalna !== false && (
        <div className="flex items-center justify-between gap-3 mb-3 rounded-md border border-grunt-ink/15 bg-grunt-surface-3 px-3.5 py-2.5">
          <div className="text-[13px] text-grunt-text-muted">
            Rekomendowany kierunek: <strong className="text-grunt-text">{ETYK_WERDYKT_KIER[ocena.rekomendowanyKierunek]}</strong>
            <span className={`ml-2 font-semibold ${KOLOR_WERD[rek.werdykt]}`}>{statusSlowny[rek.werdykt]} · {rek.score}/100</span>
          </div>
          <span className="text-[11px] text-grunt-text-faint2 whitespace-nowrap">pewność ogólna {ocena.pewnoscOgolna}%</span>
        </div>
      )}
      <div className="flex flex-wrap gap-2 mb-3 text-xs">
        {meta.pozycje.map((p, i) => (
          <span key={i} className={`badge ${p.znaleziona ? "bg-green-100 text-green-700" : "bg-amber-100 text-amber-700"}`}>
            {p.id} {p.zrodlo === "uldk" ? "✓ ULDK" : p.zrodlo === "demo" ? "✓ demo" : "· nie znaleziono"}
          </span>
        ))}
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
        <Odczyt e="Powierzchnia (scalona)" v={dane.powierzchniaM2 ? liczba(dane.powierzchniaM2, " m²") : "—"} />
        <Odczyt e="Front" v={fmtv(dane.frontM, " m")} />
        <Odczyt e="Gmina" v={dane.gmina || "—"} />
        <Odczyt e="Pola automatyczne" v={`${meta.poleAutomatyczne.length} wypełnionych`} />
      </div>
      {meta.raportZrodel && meta.raportZrodel.length > 0 && (
        <div className="mt-3">
          <div className="text-xs font-medium text-slate-500 mb-1">Raport źródeł danych</div>
          <div className="flex flex-wrap gap-2">
            {meta.raportZrodel.map((r, i) => {
              const kolor = r.status === "ok" ? "bg-green-100 text-green-700" : r.status === "blad" ? "bg-red-100 text-red-700" : "bg-slate-100 text-slate-500";
              const ikona = r.status === "ok" ? "✓" : r.status === "blad" ? "✕" : "–";
              return (
                <span key={i} className={`badge ${kolor}`} title={r.debug ?? ""}>
                  {ikona} {r.zrodlo} {r.status !== "ok" && `(${r.status})`}
                </span>
              );
            })}
          </div>
          {/* Powody „brak"/„błąd" wprost w UI — diagnostyka bez logów serwera. */}
          {meta.raportZrodel.some((r) => r.status !== "ok" && r.debug) && (
            <ul className="mt-2 space-y-1">
              {meta.raportZrodel
                .filter((r) => r.status !== "ok" && r.debug)
                .map((r, i) => (
                  <li key={i} className="text-[11px] text-slate-500 break-all">
                    <span className="font-medium text-slate-600">{r.zrodlo}:</span> {r.debug}
                  </li>
                ))}
            </ul>
          )}
        </div>
      )}
      {dane.mpzpMeta && (dane.mpzpMeta.symbol || dane.mpzpMeta.standard || dane.mpzpMeta.nazwaPlanu) && (
        <div className="mt-3 rounded-md border border-grunt-green/25 bg-grunt-green-bg/50 px-3 py-2.5">
          <div className="text-xs font-semibold text-grunt-green mb-1">Metryka MPZP (KIMPZP)</div>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-x-4 gap-y-1 text-[12px] text-grunt-text-muted">
            {dane.mpzpMeta.symbol && <div><span className="text-grunt-text-faint">Symbol:</span> <span className="mono text-grunt-text">{dane.mpzpMeta.symbol}</span></div>}
            {dane.mpzpMeta.standard && <div><span className="text-grunt-text-faint">Przeznaczenie:</span> <span className="text-grunt-text">{dane.mpzpMeta.standard}</span></div>}
            {dane.mpzpMeta.maxWysokoscM && <div><span className="text-grunt-text-faint">Maks. wys.:</span> <span className="text-grunt-text">{dane.mpzpMeta.maxWysokoscM}</span></div>}
            {dane.mpzpMeta.intensywnoscZabudowy && <div><span className="text-grunt-text-faint">Intensywność:</span> <span className="text-grunt-text">{dane.mpzpMeta.intensywnoscZabudowy}</span></div>}
            {dane.mpzpMeta.stawkaPct != null && <div><span className="text-grunt-text-faint">Renta plan.:</span> {dane.mpzpMeta.stawkaPct}%</div>}
            {dane.mpzpMeta.jednostka && <div><span className="text-grunt-text-faint">Jednostka:</span> {dane.mpzpMeta.jednostka}</div>}
            {dane.mpzpMeta.uchwala && <div><span className="text-grunt-text-faint">Uchwała:</span> {dane.mpzpMeta.uchwala}</div>}
            {dane.mpzpMeta.dataWejscia && <div><span className="text-grunt-text-faint">W życie od:</span> {dane.mpzpMeta.dataWejscia}</div>}
          </div>
          {dane.mpzpMeta.nazwaPlanu && <div className="text-[11px] text-grunt-text-faint2 mt-1">Plan: {dane.mpzpMeta.nazwaPlanu}</div>}
          {dane.mpzpMeta.opis && <div className="text-[11px] text-grunt-text-faint2">{dane.mpzpMeta.opis}</div>}
        </div>
      )}
      {meta.bledy.length > 0 && (
        <ul className="mt-3 space-y-1">
          {meta.bledy.map((b, i) => (
            <li key={i} className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded px-2 py-1.5">⚑ {b}</li>
          ))}
        </ul>
      )}
    </Karta>
    <div className="lg:sticky" style={{ top: "var(--grunt-sticky-top)" }}>
      <PodgladTerenu mode={trybMapy} view="start" layers={{ parcel: true }} shape={meta.ksztaltSvg ?? ""} geo={meta.ksztaltGeo ?? ""} kwadrat />
    </div>
    </div>
  );
}

// Pola formularzowe ────────────────────────────────────────────────────────

type P2Props = { label: string; k: string; p2: Record<string, string>; setP2: (f: (s: Record<string, string>) => Record<string, string>) => void; orig: Record<string, string> };

function Lab({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="text-sm block">
      <span className="text-xs text-slate-500">{label}</span>
      <div className="mt-0.5">{children}</div>
    </label>
  );
}

function naglowekPola(label: string, tryb: Tryb, skor: boolean) {
  return (
    <span className="text-xs text-slate-500 flex items-center gap-1.5">
      {label} <TrybBadge tryb={tryb} /> {skor && <span className="text-violet-600" title="skorygowane ręcznie">✎</span>}
    </span>
  );
}

function NumPole({ label, tryb, k, p2, setP2, orig, sufiks, krok }: P2Props & { tryb: Tryb; sufiks?: string; krok?: string }) {
  const skor = orig[k] !== undefined && p2[k] !== orig[k];
  return (
    <label className="text-sm block">
      {naglowekPola(`${label}${sufiks ? ` (${sufiks})` : ""}`, tryb, skor)}
      <input type="number" step={krok ?? "any"} value={p2[k] ?? ""} onChange={(e) => setP2((s) => ({ ...s, [k]: e.target.value }))} className="inp mt-0.5" />
    </label>
  );
}

function SelPole({ label, tryb, k, p2, setP2, orig, opcje }: P2Props & { tryb: Tryb; opcje: [string, string][] }) {
  const skor = orig[k] !== undefined && p2[k] !== orig[k];
  return (
    <label className="text-sm block">
      {naglowekPola(label, tryb, skor)}
      <select value={p2[k] ?? ""} onChange={(e) => setP2((s) => ({ ...s, [k]: e.target.value }))} className="inp bg-white mt-0.5">
        {opcje.map(([v, t]) => <option key={v} value={v}>{t}</option>)}
      </select>
    </label>
  );
}

function TxtPole({ label, tryb, k, p2, setP2, orig }: P2Props & { tryb: Tryb }) {
  const skor = orig[k] !== undefined && p2[k] !== orig[k];
  return (
    <label className="text-sm block">
      {naglowekPola(label, tryb, skor)}
      <input type="text" value={p2[k] ?? ""} onChange={(e) => setP2((s) => ({ ...s, [k]: e.target.value }))} className="inp mt-0.5" placeholder={tryb === "R" ? "wymagane (wąskie gardło)" : "opcjonalne"} />
    </label>
  );
}

function PoleRynkowe({ label, k, p2, setP2, orig, N, sufiks }: P2Props & { N: number; sufiks?: string }) {
  const { tryb, status, etykietaZrodla } = trybRynkowy(N, 2);
  const skor = orig[k] !== undefined && p2[k] !== orig[k];
  const kolorStatus = status === "wiarygodne" ? "text-green-600" : status === "szacunek" ? "text-amber-600" : "text-red-600";
  return (
    <label className="text-sm block">
      {naglowekPola(`${label}${sufiks ? ` (${sufiks})` : ""}`, tryb, skor)}
      <input type="number" value={p2[k] ?? ""} onChange={(e) => setP2((s) => ({ ...s, [k]: e.target.value }))} className="inp mt-0.5" />
      <span className={`text-[11px] ${kolorStatus}`}>N={N} · {status} · {etykietaZrodla}</span>
    </label>
  );
}

function Odczyt({ e, v }: { e: string; v: string }) {
  return (
    <div className="bg-slate-50 rounded px-2.5 py-1.5">
      <div className="text-slate-400">{e}</div>
      <div className="text-slate-700 font-medium">{v}</div>
    </div>
  );
}

