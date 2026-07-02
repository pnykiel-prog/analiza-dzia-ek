"use client";

import { useState, useEffect } from "react";
import type { DaneDzialki, WynikAnalizy } from "@/lib/types";
import type { ProfilFinansowy } from "@/lib/finanse/typy";
import { domyslnaKonfiguracja, type Konfiguracja } from "@/lib/config";
import { WOJEWODZTWA } from "@/lib/wojewodztwa";
import type { PozycjaDzialki } from "@/lib/teryt";
import { OPIS_TRYBU, trybRynkowy, type Tryb } from "@/lib/fieldModes";
import { Karta } from "@/components/ui";
import { Poziom1View } from "@/components/Poziom1View";
import { Poziom2View } from "@/components/Poziom2View";
import { Poziom3View } from "@/components/Poziom3View";
import { AnkietaFinansowa } from "@/components/AnkietaFinansowa";
import { Stepper, BannerBramki, Chip } from "@/components/grunt";
import { SYMBOLE_MPZP, statusZeSymbolu } from "@/lib/mpzp";
import { PodgladTerenu, type TrybMapy, type WarstwyMapy } from "@/components/GruntMap";
import { RaportView } from "@/components/RaportView";
import { liczba } from "@/lib/format";

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

/** Działki demonstracyjne (z mini-słownika; gminaTeryt zapewnia trafienie w provider demo). */
const DZIALKI_DEMO: { label: string; p: PozycjaDzialki }[] = [
  { label: "Lesznowola (wzorcowa, młodzi)", p: { wojewodztwo: "mazowieckie", powiat: "piaseczyński", gmina: "Lesznowola", obreb: "0012", numer: "123/4", gminaTeryt: "146509_8" } },
  { label: "Kórnik (senioralna)", p: { wojewodztwo: "wielkopolskie", powiat: "poznański", gmina: "Kórnik", obreb: "0005", numer: "88/2", gminaTeryt: "300108_4" } },
  { label: "Janów Podlaski (białe plamy)", p: { wojewodztwo: "lubelskie", powiat: "bialski", gmina: "Janów Podlaski", obreb: "0011", numer: "45", gminaTeryt: "061702_2" } },
];

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

type Ekran = "wejscie" | "poziom1" | "poziom2" | "poziom3" | "raport";
type Rola = "klient" | "administrator";
const EKRANY: Ekran[] = ["wejscie", "poziom1", "poziom2", "poziom3", "raport"];

export default function NowaAnalizaPage() {
  const [ekran, setEkran] = useState<Ekran>("wejscie");
  const [rola, setRola] = useState<Rola>("klient");
  const [maxKrok, setMaxKrok] = useState(1);
  const [pozycje, setPozycje] = useState<PozycjaDzialki[]>([pustaPozycja()]);
  const [dane, setDane] = useState<DaneDzialki | null>(null);
  const [meta, setMeta] = useState<MetaRozw | null>(null);
  const [mediana, setMediana] = useState<{ czynsz: number; cenaNowych: number; wartoscOdtworzeniowa: number } | null>(null);
  const [wynik, setWynik] = useState<WynikAnalizy | null>(null);
  const [blad, setBlad] = useState<string | null>(null);
  const [licze, setLicze] = useState(false);
  const [recznaPow, setRecznaPow] = useState("");
  const [trybWejscia, setTrybWejscia] = useState<"kaskada" | "id">("id");
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

  // ── Przejście do P2: inicjalizacja pól z danych auto / fallbacku ───────────
  function wejdzP2() {
    if (!dane) return;
    const init: Record<string, string> = {
      statusPlanistyczny: dane.statusPlanistyczny,
      w_intensywnosc: s(dane.wskaznikiPlanistyczne?.intensywnosc),
      w_maxKondygnacje: s(dane.wskaznikiPlanistyczne?.maxKondygnacje),
      w_maxPowZabudowyPct: s(dane.wskaznikiPlanistyczne?.maxPowZabudowyPct),
      w_minPbcPct: s(dane.wskaznikiPlanistyczne?.minPbcPct),
      w_normatywParkingowy: s(dane.wskaznikiPlanistyczne?.normatywParkingowy),
      w_udzialUslugPct: s(dane.wskaznikiPlanistyczne?.udzialUslugPct),
      pustostanyPct: s(dane.pustostanyPct),
      // Rynek — dynamiczny tryb: brak danych → fallback regionalny jako podpowiedź
      czynszRynkowyM2: s(dane.czynszRynkowyM2 ?? mediana?.czynsz),
      cenaNowychM2: s(dane.cenaNowychM2 ?? mediana?.cenaNowych),
      // R — wąskie gardła (informacyjne)
      wlasnoscKW: "",
      warunkiPrzylaczenia: "",
      geotechnika: "",
    };
    setP2(init);
    setP2orig(init);
    setEkran("poziom2");
    setMaxKrok((m) => Math.max(m, 3));
  }

  async function przeliczP2() {
    if (!dane) return;
    setLicze(true);
    const maZab = p2.w_intensywnosc.trim() !== "";
    const noweDane: DaneDzialki = {
      ...dane,
      statusPlanistyczny: p2.statusPlanistyczny as DaneDzialki["statusPlanistyczny"],
      wskaznikiPlanistyczne: maZab
        ? {
            intensywnosc: n(p2.w_intensywnosc) ?? 1,
            maxWysokoscM: dane.wskaznikiPlanistyczne?.maxWysokoscM ?? 12,
            maxKondygnacje: n(p2.w_maxKondygnacje) ?? 4,
            maxPowZabudowyPct: n(p2.w_maxPowZabudowyPct) ?? 35,
            minPbcPct: n(p2.w_minPbcPct) ?? 30,
            normatywParkingowy: n(p2.w_normatywParkingowy) ?? 0.8,
            udzialUslugPct: n(p2.w_udzialUslugPct) ?? 15,
          }
        : null,
      pustostanyPct: n(p2.pustostanyPct),
      czynszRynkowyM2: n(p2.czynszRynkowyM2),
      cenaNowychM2: n(p2.cenaNowychM2),
    };
    setDane(noweDane);
    await przelicz(noweDane);
    setLicze(false);
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
    setEkran("poziom3");
    setMaxKrok((m) => Math.max(m, 4));
  }

  // Zatwierdzenie ankiety = brama P3: zapis profilu i przeliczenie z montażem.
  async function zatwierdzAnkiete(profil: ProfilFinansowy) {
    setProfilFin(profil);
    await przeliczP3(profil);
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

    const noweDane: DaneDzialki = {
      ...dane,
      wartoscOdtworzeniowaM2: n(p3.wartoscOdtworzeniowaM2),
      kosztBudowyM2: n(p3.kosztBudowyM2),
      cenaGruntu: n(p3.cenaGruntu),
    };
    setDane(noweDane);
    await przelicz(noweDane, k, profil);
    setMaxKrok((m) => Math.max(m, 5));
    setLicze(false);
  }

  const korektyP2 = Object.keys(p2).filter((k) => p2orig[k] !== undefined && p2[k] !== p2orig[k]);
  const rolaAdmin = rola === "administrator";
  const stepAktywny = EKRANY.indexOf(ekran) + 1;

  function cofnij() {
    const i = EKRANY.indexOf(ekran);
    if (i > 0) setEkran(EKRANY[i - 1]);
  }
  function idzDoKroku(nr: number) {
    if (nr >= 1 && nr <= maxKrok) setEkran(EKRANY[nr - 1]);
  }

  return (
    <div className="space-y-5">
      <div className="-mx-6 -mt-6">
        <Stepper aktywny={stepAktywny} maxOsiagniety={maxKrok} onKrok={idzDoKroku} />
        {dane && ekran !== "wejscie" && (
          <div className="bg-grunt-surface border-b border-grunt-border px-6 py-2 flex flex-wrap items-center gap-x-6 gap-y-1">
            <span className="text-[10px] uppercase tracking-wider text-grunt-text-faint">Teren inwestycji</span>
            <span className="mono text-[12px] text-grunt-text">{dane.id}</span>
            {dane.powierzchniaM2 > 0 && <span className="mono text-[12px] text-grunt-text-muted">{liczba(dane.powierzchniaM2, " m²")}</span>}
            {dane.gmina && <span className="text-[12px] text-grunt-text-muted">{dane.gmina}</span>}
          </div>
        )}
      </div>

      {/* Pasek: rola (klient/administrator) + powrót do poprzedniego ekranu */}
      <div className="flex items-center justify-between gap-3">
        <div className="inline-flex rounded-input border border-grunt-border-input overflow-hidden text-[13px]">
          <button onClick={() => setRola("klient")} className={`px-3.5 py-1.5 ${rola === "klient" ? "bg-grunt-ink text-white" : "bg-grunt-surface text-grunt-text-3"}`}>Klient</button>
          <button onClick={() => setRola("administrator")} className={`px-3.5 py-1.5 ${rola === "administrator" ? "bg-grunt-ink text-white" : "bg-grunt-surface text-grunt-text-3"}`}>Administrator</button>
        </div>
        {ekran !== "wejscie" && (
          <button onClick={cofnij} className="btn-secondary">← Wstecz</button>
        )}
      </div>

      {blad && <p className="text-sm text-grunt-red bg-grunt-red-bg border border-grunt-red/25 rounded-md px-3 py-2">{blad}</p>}

      {/* EKRAN: RAPORT (studium) */}
      {ekran === "raport" && wynik && (
        <div className="space-y-4">
          <div className="brak-druku flex justify-end">
            <button onClick={() => window.print()} className="btn-primary" style={{ height: "var(--grunt-h-cta)" }}>↓ Pobierz PDF (drukuj)</button>
          </div>
          <RaportView wynik={wynik} data={new Date().toLocaleDateString("pl-PL")} />
        </div>
      )}

      {/* EKRAN: WEJŚCIE — wyłącznie identyfikacja działki */}
      {ekran === "wejscie" && (
        <div className="card p-[18px]">
          <h1 className="text-[25px] font-semibold text-grunt-text tracking-[-0.01em]">Wprowadzenie danych działki</h1>
          <p className="text-grunt-text-muted mt-1 text-[13px] max-w-3xl">
            Podaj identyfikator działki (lub kaskadę TERYT). Poziom 1 zaciąga dane automatycznie i liczy przesiew —
            wynik pojawi się na kolejnym ekranie. Brakujące źródła są uzupełniane założeniami i obniżają pewność.
          </p>
          <Legenda />
        </div>
      )}

      {/* EKRAN: WEJŚCIE — formularz identyfikacji */}
      {ekran === "wejscie" && (
        <form onSubmit={analizujP1} className="space-y-4">
          <Karta tytul="Poziom 1 — identyfikacja działek" podtytul="Jedyne widoczne pola do wprowadzenia. Z TERYT składany jest identyfikator ULDK.">
            {/* Wybór trybu wejścia */}
            <div className="mb-3 flex flex-wrap items-center gap-3">
              <div className="inline-flex rounded-lg border border-slate-300 overflow-hidden text-sm">
                <button type="button" onClick={() => setTrybWejscia("kaskada")} className={`px-3 py-1.5 ${trybWejscia === "kaskada" ? "bg-slate-900 text-white" : "bg-white text-slate-600"}`}>
                  Kaskada TERYT
                </button>
                <button type="button" onClick={() => setTrybWejscia("id")} className={`px-3 py-1.5 ${trybWejscia === "id" ? "bg-slate-900 text-white" : "bg-white text-slate-600"}`}>
                  Identyfikator ULDK
                </button>
              </div>
              {trybWejscia === "kaskada" && (
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xs text-slate-500">Przykłady:</span>
                  {DZIALKI_DEMO.map((d) => (
                    <button key={d.label} type="button" onClick={() => setPozycje([{ ...d.p }])} className="text-xs border border-slate-300 rounded px-2 py-1 hover:bg-slate-50">
                      {d.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <div className="space-y-3">
              {pozycje.map((p, i) =>
                trybWejscia === "id" ? (
                  <IdWiersz key={i} i={i} p={p} onPatch={patchPozycje} onUsun={() => usunPozycje(i)} mozeUsunac={pozycje.length > 1} />
                ) : (
                  <PozycjaWiersz
                    key={i}
                    i={i}
                    p={p}
                    pierwsza={i === 0}
                    onPatch={patchPozycje}
                    onUsun={() => usunPozycje(i)}
                    mozeUsunac={pozycje.length > 1}
                  />
                )
              )}
            </div>
            <button type="button" onClick={dodajPozycje} className="mt-3 text-sm border border-slate-300 rounded px-3 py-1.5 hover:bg-slate-50">
              ＋ Dodaj działkę
            </button>
            <p className="text-xs text-slate-400 mt-2">
              Wiele działek tworzy jeden „teren inwestycji" (scalenie geometrii). Części administracyjne pierwszej działki
              pre-wypełniają kolejne. Tylko numer jest wymagany dla każdej kolejnej pozycji.
            </p>
          </Karta>

          {/* Co można zbudować — PROGNOZA potencjału (zastępuje ręczne wskaźniki MPZP/WZ/PnB) */}
          <Karta
            tytul="Co można zbudować — prognoza potencjału"
            podtytul="Poziom 1 automatycznie szacuje orientacyjny potencjał zabudowy z kształtu i lokalizacji działki oraz zabudowy sąsiedztwa — bez ręcznego wprowadzania wskaźników MPZP/WZ/PnB. Poniższe pytanie jest opcjonalne i służy tylko adnotacji."
          >
            <div className="rounded-md bg-grunt-green-bg/60 border border-grunt-green/20 px-3 py-2 text-[12px] text-grunt-text-muted2">
              <span className="font-semibold text-grunt-text">Prognoza automatyczna:</span> pojemność (pow. zabudowy, PUM,
              liczba mieszkań) liczona z powierzchni i kształtu działki, typowej zabudowy w otoczeniu oraz spadku terenu.
              Wynik jest <em>orientacyjny</em> i wymaga potwierdzenia w planie/decyzji na Poziomie 2.
            </div>

            <div className="flex flex-wrap items-center gap-2 mt-3">
              <span className="text-[12px] text-grunt-text-muted2 mr-1">Czy dla działki obowiązuje MPZP?</span>
              <Chip selected={podstawaTyp === ""} onClick={() => setPodstawaTyp("")}>Nie wiem</Chip>
              <Chip selected={podstawaTyp === "MPZP"} onClick={() => setPodstawaTyp("MPZP")}>MPZP obowiązuje</Chip>
              <Chip selected={podstawaTyp === "BRAK"} onClick={() => setPodstawaTyp("BRAK")}>Brak MPZP</Chip>
            </div>

            {podstawaTyp === "MPZP" && (
              <label className="text-sm block mt-3 max-w-md">
                <span className="text-[11px] font-medium text-grunt-text-muted2">Symbol przeznaczenia z MPZP (opcjonalnie)</span>
                <select value={mpzpSymbol} onChange={(e) => setMpzpSymbol(e.target.value)} className="inp bg-white mt-1">
                  <option value="">— nie podaję / nie wiem —</option>
                  {SYMBOLE_MPZP.map((sm) => (
                    <option key={sm.symbol} value={sm.symbol}>{sm.symbol} — {sm.opis}</option>
                  ))}
                </select>
                {mpzpSymbol && (
                  <span className={`text-[11px] mt-1 block ${statusZeSymbolu(mpzpSymbol).sprzeczne ? "text-grunt-red" : "text-grunt-green"}`}>
                    {statusZeSymbolu(mpzpSymbol).sprzeczne
                      ? "Przeznaczenie sprzeczne z funkcją mieszkaniową — działka nieprzydatna pod budownictwo społeczne."
                      : "MPZP mieszkaniowy — zgodny z zabudową społeczną."}
                  </span>
                )}
                <span className="text-[11px] text-grunt-text-faint2 mt-1 block">
                  Symbol służy tylko wykryciu przeznaczenia sprzecznego z mieszkaniowym. Pojemność i tak liczy prognoza.
                </span>
              </label>
            )}

            {podstawaTyp === "MPZP" && (
              <p className="text-[11px] text-grunt-amber-text2 mt-3 bg-grunt-amber-bg border border-grunt-amber/25 rounded-md px-3 py-2">
                Obowiązuje MPZP — prognoza pozostaje orientacyjna i wymaga potwierdzenia wskaźnikami z planu (Poziom 2).
              </p>
            )}
          </Karta>

          <button type="submit" disabled={licze} className="btn-primary" style={{ height: "var(--grunt-h-cta)" }}>
            {licze ? "Pobieram dane i liczę…" : "Pobierz dane i analizuj (Poziom 1)"}
          </button>
        </form>
      )}

      {/* POZIOM 1 (administrator) — potwierdzenie wczytania: teren, mapa, źródła */}
      {ekran === "poziom1" && rolaAdmin && dane && meta && (
        <PotwierdzenieDanych dane={dane} meta={meta} />
      )}

      {/* Działka spoza ULDK demo — brak geometrii, powierzchnia ręczna (na ekranie wejścia) */}
      {ekran === "wejscie" && dane && dane.powierzchniaM2 === 0 && (
        <Karta tytul="Działka spoza przykładowego ULDK — podaj powierzchnię" podtytul="Provider demonstracyjny obejmuje 3 działki; dla pozostałych geometria nie jest pobierana automatycznie">
          <p className="text-sm text-slate-600 mb-3">
            Nie pobrano geometrii dla podanego identyfikatora. Po podłączeniu realnego ULDK powierzchnia i kształt
            uzupełnią się automatycznie. Na razie podaj powierzchnię ręcznie, aby uruchomić analizę — albo skorzystaj z
            działek przykładowych powyżej.
          </p>
          <div className="flex flex-wrap items-end gap-3">
            <label className="text-sm">
              <span className="text-xs text-slate-500">Powierzchnia (m²)</span>
              <input
                type="number"
                value={recznaPow}
                onChange={(e) => setRecznaPow(e.target.value)}
                className="inp mt-0.5 w-40"
                placeholder="np. 4000"
              />
            </label>
            <button onClick={analizujZPowierzchnia} disabled={licze} className="btn-primary" style={{ height: "var(--grunt-h-cta)" }}>
              {licze ? "Liczę…" : "Analizuj z podaną powierzchnią"}
            </button>
          </div>
        </Karta>
      )}

      {/* POZIOM 2 (klient) — tylko podgląd terenu; wynik poniżej */}
      {ekran === "poziom2" && !rolaAdmin && dane && (
        <PodgladTerenu
          mode={meta?.przylegajace === false ? "nonadjacent" : "ok"}
          view="level2"
          height={340}
          layers={warstwyP2(dane, wynik?.poziom1.profilRekomendowany)}
          shape={meta?.ksztaltSvg ?? ""}
          geo={meta?.ksztaltGeo ?? ""}
        />
      )}

      {/* POZIOM 2 (administrator) — ocena działki: dane, korekty, przelicz */}
      {ekran === "poziom2" && rolaAdmin && dane && (
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
            <KompletnoscOceny p2={p2} />
          </div>
          <Karta tytul="Poziom 2 — planistyka (A±)" podtytul="Uzupełnione automatycznie, profesjonalista koryguje wg wypisu (override)">
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
              <SelPole label="Status planistyczny" tryb="A±" k="statusPlanistyczny" p2={p2} setP2={setP2} orig={p2orig}
                opcje={[["mpzp_mieszkaniowy","MPZP mieszkaniowy"],["plan_ogolny_sprzyjajacy","Plan ogólny sprzyjający"],["ouz","OUZ"],["sprzeczny","Sprzeczny (wykluczenie)"],["brak_danych","Brak danych"]]} />
              <NumPole label="Intensywność zabudowy" tryb="A±" k="w_intensywnosc" p2={p2} setP2={setP2} orig={p2orig} krok="0.1" />
              <NumPole label="Max kondygnacje" tryb="A±" k="w_maxKondygnacje" p2={p2} setP2={setP2} orig={p2orig} />
              <NumPole label="Max pow. zabudowy" tryb="A±" k="w_maxPowZabudowyPct" p2={p2} setP2={setP2} orig={p2orig} sufiks="%" />
              <NumPole label="Min pow. biol. czynna" tryb="A±" k="w_minPbcPct" p2={p2} setP2={setP2} orig={p2orig} sufiks="%" />
              <NumPole label="Normatyw parkingowy" tryb="A±" k="w_normatywParkingowy" p2={p2} setP2={setP2} orig={p2orig} krok="0.1" sufiks="/lok." />
              <NumPole label="Udział usług" tryb="A±" k="w_udzialUslugPct" p2={p2} setP2={setP2} orig={p2orig} sufiks="%" />
            </div>
          </Karta>

          <Karta tytul="Poziom 2 — rynek (A± → R dynamicznie)" podtytul="Tryb zależy od liczby ofert N po drabinie przestrzennej (sek. 7)">
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
              <PoleRynkowe label="Czynsz rynkowy" k="czynszRynkowyM2" p2={p2} setP2={setP2} orig={p2orig} N={meta?.rynek.czynszN ?? 0} sufiks="zł/m²" />
              <PoleRynkowe label="Cena nowych lokali" k="cenaNowychM2" p2={p2} setP2={setP2} orig={p2orig} N={meta?.rynek.cenaNowychN ?? 0} sufiks="zł/m²" />
              <NumPole label="Pustostany" tryb="A±" k="pustostanyPct" p2={p2} setP2={setP2} orig={p2orig} sufiks="%" />
            </div>
          </Karta>

          <Karta tytul="Poziom 2 — uwarunkowania (A°, tylko odczyt)" podtytul="Pobrane automatycznie z NMT / ISOK / OSM / GDOŚ">
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-2 text-xs">
              <Odczyt e="Średni spadek" v={fmtv(dane.sredniSpadekPct, "%")} />
              <Odczyt e="Powódź szczególna" v={tak(dane.ryzykoPowodzioweSzczegolne)} />
              <Odczyt e="Osuwisko" v={tak(dane.osuwisko)} />
              <Odczyt e="Natura 2000" v={tak(dane.natura2000)} />
              <Odczyt e="Dojazd do aglomeracji" v={fmtv(dane.czasDojazdAglomeracjaMin, " min")} />
              <Odczyt e="Przystanek (częstotliwość)" v={tak(dane.przystanekZCzestotliwoscia)} />
              <Odczyt e="Usługi pieszo" v={tak(dane.uslugiPodstawowePieszo)} />
              <Odczyt e="POZ w zasięgu" v={tak(dane.pozWZasiegu)} />
              <Odczyt e="Odległość do sieci" v={fmtv(dane.odlegloscDoSieciM, " m")} />
              <Odczyt e="Ochrona wykluczająca" v={tak(dane.ochronaWykluczajaca)} />
              <Odczyt e="Strefa konserwatorska" v={tak(dane.strefaKonserwatorska)} />
              <Odczyt e="Dostęp do drogi" v={tak(dane.dostepDrogaPubliczna)} />
            </div>
          </Karta>

          <Karta tytul="Poziom 2 — dane ręczne / wąskie gardła (R, R?)" podtytul="Brak API — wprowadzenie ręczne; nie wpływa na obliczenia na tym etapie, sygnalizuje braki">
            <div className="grid sm:grid-cols-3 gap-3">
              <TxtPole label="Własność / KW / obciążenia" tryb="R" k="wlasnoscKW" p2={p2} setP2={setP2} orig={p2orig} />
              <TxtPole label="Warunki i koszt przyłączenia" tryb="R" k="warunkiPrzylaczenia" p2={p2} setP2={setP2} orig={p2orig} />
              <TxtPole label="Geotechnika / nośność" tryb="R?" k="geotechnika" p2={p2} setP2={setP2} orig={p2orig} />
            </div>
          </Karta>

          {korektyP2.length > 0 && (
            <p className="text-xs text-violet-700 bg-violet-50 border border-violet-200 rounded-lg px-3 py-2">
              ✎ Pola skorygowane ręcznie ({korektyP2.length}): {korektyP2.join(", ")} — wartości oryginalne zachowane (ślad audytowy).
            </p>
          )}

          <div className="flex gap-3">
            <button onClick={przeliczP2} disabled={licze} className="btn-primary" style={{ height: "var(--grunt-h-cta)" }}>
              {licze ? "Liczę…" : "Przelicz Poziom 2 (uwzględnij korekty)"}
            </button>
          </div>
        </div>
      )}

      {/* POZIOM 3 — ankieta finansowa (brama) → montaż finansowy */}
      {ekran === "poziom3" && dane && (
        <div className="space-y-4">
          <AnkietaFinansowa onSubmit={zatwierdzAnkiete} licze={licze} />
          {!profilFin && (
            <p className="text-xs text-slate-500 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2">
              Wypełnij ankietę i zatwierdź profil — dopiero wtedy odsłonią się parametry montażu i wynik finansowy.
            </p>
          )}
        </div>
      )}

      {/* POZIOM 3 (administrator) — edytowalne parametry reżimu/montażu */}
      {ekran === "poziom3" && rolaAdmin && dane && profilFin && (
        <div className="space-y-4">
          <Karta tytul="Poziom 3 — parametry reżimu i montażu (A±)" podtytul="Bazowo z konfiguracji reżimu B (program 2027+); modyfikowalne dla scenariuszy">
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
              <NumP3 label="Oprocentowanie" k="oprocentowanie" p3={p3} setP3={setP3} sufiks="%" krok="0.25" />
              <NumP3 label="Okres kredytu" k="okresKredytuLata" p3={p3} setP3={setP3} sufiks="lat" />
              <NumP3 label="Grant" k="maxGrantPct" p3={p3} setP3={setP3} sufiks="%" />
              <NumP3 label="Faza: projekt + PnB" k="projektDecyzjeMies" p3={p3} setP3={setP3} sufiks="mies." />
              <NumP3 label="Faza: nabór finansowania" k="naborFinansowaniaMies" p3={p3} setP3={setP3} sufiks="mies." />
              <NumP3 label="Faza: budowa" k="budowaMies" p3={p3} setP3={setP3} sufiks="mies." />
              <NumP3 label="Indeks kosztu budowy" k="indeksKosztu" p3={p3} setP3={setP3} sufiks="%/rok" krok="0.5" />
              <NumP3 label="Indeks wart. odtworzeniowej" k="indeksWartOdtw" p3={p3} setP3={setP3} sufiks="%/rok" krok="0.5" />
            </div>
          </Karta>

          <Karta tytul="Poziom 3 — koszty i partycypacje (A± / R)" podtytul="Wartość odtworzeniowa A°; koszt budowy A±; cena gruntu i partycypacje R">
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
              <NumP3 label="Wartość odtworzeniowa" tryb="A°" k="wartoscOdtworzeniowaM2" p3={p3} setP3={setP3} sufiks="zł/m²" />
              <NumP3 label="Koszt budowy (pod klucz)" k="kosztBudowyM2" p3={p3} setP3={setP3} sufiks="zł/m²" />
              <NumP3 label="Cena gruntu (całość)" tryb="R" k="cenaGruntu" p3={p3} setP3={setP3} sufiks="zł" />
              <NumP3 label="Partycypacja najemców" tryb="R" k="partycypacjaNajemcow" p3={p3} setP3={setP3} sufiks="% kosztu" />
              <NumP3 label="Wkład gminy" tryb="R" k="wkladGminy" p3={p3} setP3={setP3} sufiks="% kosztu" />
            </div>
          </Karta>

          <div className="flex gap-3">
            <button onClick={() => przeliczP3()} disabled={licze} className="btn-primary" style={{ height: "var(--grunt-h-cta)" }}>
              {licze ? "Liczę…" : "Przelicz Poziom 3 (uwzględnij parametry)"}
            </button>
          </div>
        </div>
      )}

      {/* WYNIKI — jeden ekran = jeden poziom; szczegóły tylko dla administratora */}
      {wynik && wynik.poziom1 && (
        <div className="space-y-4">
          {ekran === "poziom1" && (
            <>
              <Poziom1View p1={wynik.poziom1} pelny={rolaAdmin} />
              <BannerBramki
                tytul="Poziom 1 zaliczony — przejdź do oceny działki"
                opis="Poziom 2 odsłania model zabudowy i warianty."
                akcja={wejdzP2}
                akcjaLabel="Przejdź do Poziomu 2"
              />
            </>
          )}
          {ekran === "poziom2" && (
            <>
              <Poziom2View p2={wynik.poziom2} profilRek={wynik.poziom1.profilRekomendowany} sygnaly={wynik.poziom2.sygnaly} braki={wynik.poziom2.braki} />
              <BannerBramki
                tytul="Poziom 2 gotowy — czas na model finansowy"
                opis="Najpierw ankieta finansowa (kto pyta i jak finansuje), potem montaż i domknięcie Poziomu 3."
                akcja={wejdzP3}
                akcjaLabel="Przejdź do ankiety i Poziomu 3"
              />
            </>
          )}
          {ekran === "poziom3" && profilFin && (
            <>
              <Poziom3View p3={wynik.poziom3} />
              <BannerBramki
                tytul="Studium gotowe — wygeneruj raport"
                opis="Drukowalne podsumowanie: werdykt, pewność sekcji, model zabudowy i finansowy, prowenancja."
                akcja={() => { setEkran("raport"); setMaxKrok((m) => Math.max(m, 5)); }}
                akcjaLabel="Otwórz studium (raport)"
              />
            </>
          )}
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

function Legenda() {
  return (
    <div className="flex flex-wrap gap-2 mt-3 text-xs">
      {(["R", "R?", "A°", "A±", "A"] as Tryb[]).map((t) => (
        <span key={t} className="flex items-center gap-1">
          <TrybBadge tryb={t} /> <span className="text-slate-500">{OPIS_TRYBU[t].opis}</span>
        </span>
      ))}
    </div>
  );
}

function IdWiersz({
  i,
  p,
  onPatch,
  onUsun,
  mozeUsunac,
}: {
  i: number;
  p: PozycjaDzialki;
  onPatch: (i: number, patch: Partial<PozycjaDzialki>) => void;
  onUsun: () => void;
  mozeUsunac: boolean;
}) {
  return (
    <div className="flex items-end gap-2 border border-slate-100 rounded-lg p-3">
      <label className="text-sm flex-1">
        <span className="text-xs text-slate-500">Identyfikator działki (ULDK) *</span>
        <input
          value={p.idBezposredni ?? ""}
          onChange={(e) => onPatch(i, { idBezposredni: e.target.value })}
          className="inp mt-0.5 font-mono"
          placeholder="np. 160707_3.0006.51/2  (TERYT_gminy.obręb.numer)"
        />
      </label>
      {mozeUsunac && (
        <button type="button" onClick={onUsun} className="text-xs text-red-600 border border-red-200 rounded px-2 py-2 hover:bg-red-50">
          Usuń
        </button>
      )}
    </div>
  );
}

type OpcjaT = { teryt: string; nazwa: string };

function PozycjaWiersz({
  i,
  p,
  pierwsza,
  onPatch,
  onUsun,
  mozeUsunac,
}: {
  i: number;
  p: PozycjaDzialki;
  pierwsza: boolean;
  onPatch: (i: number, patch: Partial<PozycjaDzialki>) => void;
  onUsun: () => void;
  mozeUsunac: boolean;
}) {
  const [wojOpts, setWojOpts] = useState<OpcjaT[]>(WOJEWODZTWA.map((w) => ({ teryt: w.kod, nazwa: w.nazwa })));
  const [powOpts, setPowOpts] = useState<OpcjaT[]>([]);
  const [gmOpts, setGmOpts] = useState<OpcjaT[]>([]);
  const [obrOpts, setObrOpts] = useState<OpcjaT[]>([]);

  // Kaskada (podpowiedzi z mini-słownika). Dociąga po nazwie rodzica.
  useEffect(() => {
    pobierzOpcjeTeryt({ poziom: "wojewodztwa" }).then((o) => o.length && setWojOpts(o));
  }, []);
  useEffect(() => {
    if (!p.wojewodztwo) return setPowOpts([]);
    pobierzOpcjeTeryt({ poziom: "powiaty", wojNazwa: p.wojewodztwo }).then(setPowOpts);
  }, [p.wojewodztwo]);
  useEffect(() => {
    if (!p.wojewodztwo || !p.powiat) return setGmOpts([]);
    pobierzOpcjeTeryt({ poziom: "gminy", wojNazwa: p.wojewodztwo, powiatNazwa: p.powiat }).then(setGmOpts);
  }, [p.wojewodztwo, p.powiat]);
  useEffect(() => {
    if (!p.wojewodztwo || !p.powiat || !p.gmina) return setObrOpts([]);
    pobierzOpcjeTeryt({ poziom: "obreby", wojNazwa: p.wojewodztwo, powiatNazwa: p.powiat, gminaNazwa: p.gmina }).then(setObrOpts);
  }, [p.wojewodztwo, p.powiat, p.gmina]);

  return (
    <div className="grid grid-cols-2 lg:grid-cols-6 gap-2 items-end border border-slate-100 rounded-lg p-3">
      <Lab label="Województwo *">
        <select
          value={p.wojewodztwo}
          onChange={(e) => onPatch(i, { wojewodztwo: e.target.value, powiat: "", gmina: "", obreb: "", gminaTeryt: undefined })}
          className="inp bg-white"
        >
          <option value="">—</option>
          {wojOpts.map((w) => (
            <option key={w.teryt} value={w.nazwa}>{w.nazwa}</option>
          ))}
        </select>
      </Lab>
      <Lab label="Powiat">
        <input
          list={`pow-${i}`}
          value={p.powiat}
          onChange={(e) => onPatch(i, { powiat: e.target.value, gmina: "", obreb: "", gminaTeryt: undefined })}
          className="inp"
        />
        <datalist id={`pow-${i}`}>{powOpts.map((x) => <option key={x.teryt} value={x.nazwa} />)}</datalist>
      </Lab>
      <Lab label="Gmina">
        <input
          list={`gm-${i}`}
          value={p.gmina}
          onChange={(e) => {
            const opt = gmOpts.find((o) => o.nazwa === e.target.value);
            onPatch(i, { gmina: e.target.value, obreb: "", gminaTeryt: opt?.teryt });
          }}
          className="inp"
        />
        <datalist id={`gm-${i}`}>{gmOpts.map((x) => <option key={x.teryt} value={x.nazwa} />)}</datalist>
      </Lab>
      <Lab label="Obręb">
        <input
          list={`ob-${i}`}
          value={p.obreb}
          onChange={(e) => onPatch(i, { obreb: e.target.value })}
          className="inp"
          placeholder="np. 0012"
        />
        <datalist id={`ob-${i}`}>{obrOpts.map((x) => <option key={x.teryt} value={x.teryt}>{x.nazwa}</option>)}</datalist>
      </Lab>
      <Lab label="Numer działki *">
        <input value={p.numer} onChange={(e) => onPatch(i, { numer: e.target.value })} className="inp" placeholder="np. 123/4" />
      </Lab>
      <div>
        {!pierwsza && mozeUsunac && (
          <button type="button" onClick={onUsun} className="text-xs text-red-600 border border-red-200 rounded px-2 py-2 hover:bg-red-50 w-full">
            Usuń
          </button>
        )}
      </div>
    </div>
  );
}

function PotwierdzenieDanych({ dane, meta }: { dane: DaneDzialki; meta: MetaRozw }) {
  const trybMapy: TrybMapy = dane.powierzchniaM2 === 0 ? "notfound" : meta.przylegajace === false ? "nonadjacent" : "ok";
  return (
    <div className="grid lg:grid-cols-[1fr_minmax(0,440px)] gap-4 items-start">
    <Karta tytul="Teren inwestycji (A°, potwierdzenie wczytania)" podtytul="Scalona geometria z ULDK — dane automatyczne pobrane w tle">
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
      {meta.bledy.length > 0 && (
        <ul className="mt-3 space-y-1">
          {meta.bledy.map((b, i) => (
            <li key={i} className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded px-2 py-1.5">⚑ {b}</li>
          ))}
        </ul>
      )}
    </Karta>
    <div className="lg:sticky" style={{ top: "var(--grunt-sticky-top)" }}>
      <PodgladTerenu mode={trybMapy} view="start" layers={{ parcel: true }} shape={meta.ksztaltSvg ?? ""} geo={meta.ksztaltGeo ?? ""} />
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

function NumP3({ label, tryb = "A±", k, p3, setP3, sufiks, krok }: { label: string; tryb?: Tryb; k: string; p3: Record<string, string>; setP3: (f: (s: Record<string, string>) => Record<string, string>) => void; sufiks?: string; krok?: string }) {
  return (
    <label className="text-sm block">
      <span className="text-xs text-slate-500 flex items-center gap-1.5">{label}{sufiks ? ` (${sufiks})` : ""} <TrybBadge tryb={tryb} /></span>
      <input type="number" step={krok ?? "any"} value={p3[k] ?? ""} onChange={(e) => setP3((s) => ({ ...s, [k]: e.target.value }))} className="inp mt-0.5" />
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

