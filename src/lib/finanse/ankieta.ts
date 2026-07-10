/**
 * Logika ankiety finansowej i składania montażu (brama Poziomu 3).
 *
 * Wszystkie funkcje są czyste i testowane offline. Liczby czytane wyłącznie z
 * `parametry_finansowania.json` (przez `parametry.ts`) — po nowelizacji ustawy
 * aktualizujemy JSON, nie ten plik.
 *
 * Odwzorowane reguły szczególne (sekcja 5 wytycznych):
 *  1. Grant NIGDY nie finansuje gruntu.
 *  2. Aport gminny usuwa grunt z bazy finansowania.
 *  3. SIM prywatny zależny od reżimu (grant przez gminę „trudno dostępny").
 *  4. Przyszły reżim: niższa obsługa długu, ale mniejsza partycypacja i brak wykupu.
 *  5. Okno 2027–2028 — timing wniosku jest zmienną strategiczną (porównanie reżimów).
 *  6. Wartości `tbc` przyszłego reżimu prezentowane jako zakresy z flagą.
 */

import type {
  AnalizaFinansowa,
  DostepZasobu,
  InstrumentWsparcia,
  ParametryKredytuAnkiety,
  PorownanieRezimow,
  ProfilFinansowy,
  RezimFinansowy,
  SkladnikMontazu,
  TypInwestora,
  TypZasobu,
  Zakres,
} from "./typy";
import {
  PARAMETRY_FINANSOWANIA as P,
  kluczRezimu,
  macierz,
  montazGotowy,
  zasob,
} from "./parametry";

const proc = (u: number) => Math.round(u * 1000) / 10; // ułamek → % (0.205 → 20.5)
const num = (v: unknown, dom = 0): number => (typeof v === "number" ? v : dom);

/** Inwestor jest podmiotem z udziałem gminy (łatwiejszy dostęp do grantu przez gminę). */
function inwestorGminny(t: TypInwestora): boolean {
  return t === "GMINA" || t === "SIM_GMINNY" || t === "SPOLKA_GMINNA";
}

// ── Q2: dynamiczny filtr zasobów wg macierzy dostępu ─────────────────────────

export interface OpcjaZasobu {
  zasob: TypZasobu;
  dostep: DostepZasobu;
}

/** Zasoby dostępne dla inwestora w reżimie (bez „brak"); „ograniczony" oznaczony. */
export function dostepneZasoby(rezim: RezimFinansowy, inwestor: TypInwestora): OpcjaZasobu[] {
  const wiersz = macierz(rezim)[inwestor] ?? {};
  return (Object.entries(wiersz) as [TypZasobu, DostepZasobu][])
    .filter(([, d]) => d !== "brak")
    .map(([zasob, dostep]) => ({ zasob, dostep }));
}

// ── Q3/Q8: sugestia reżimu z daty wniosku (transition_rules) ─────────────────

export interface SugestiaRezimu {
  rezim: RezimFinansowy;
  oknoPrzejsciowe: boolean;
  uzasadnienie: string;
}

/**
 * Nowa ustawa spodziewana w oknie 2027–2028. Wniosek przed oknem → reżim obecny;
 * po oknie → nowy; w oknie zostawiamy obecny (ustawa wciąż obowiązuje) i flagujemy
 * niepewność, sugerując porównanie obu reżimów.
 */
export function sugerujRezim(dataWniosku: string): SugestiaRezimu {
  const rok = Number((dataWniosku || "").slice(0, 4)) || 0;
  if (rok >= 2029)
    return { rezim: "future", oknoPrzejsciowe: false, uzasadnienie: "Wniosek po wejściu nowej ustawy — reżim nowy." };
  if (rok >= 2027)
    return {
      rezim: "current",
      oknoPrzejsciowe: true,
      uzasadnienie:
        "Okno przejściowe 2027–2028 — reżimy się nakładają. Sugerowany obecny, zalecane porównanie obu (timing wniosku jest zmienną strategiczną).",
    };
  return { rezim: "current", oknoPrzejsciowe: false, uzasadnienie: "Wniosek przed wejściem nowej ustawy — reżim obecny." };
}

// ── Sekcja 2: walidacja uprawnień inwestor × zasób ───────────────────────────

export interface WynikWalidacji {
  dostep: DostepZasobu;
  zablokowana: boolean;
  ostrzezenia: string[];
}

export function walidujUprawnienia(profil: ProfilFinansowy): WynikWalidacji {
  const dostep = (macierz(profil.rezim)[profil.typInwestora]?.[profil.typZasobu] ?? "brak") as DostepZasobu;
  const ostrzezenia: string[] = [];
  if (dostep === "brak") {
    return {
      dostep,
      zablokowana: true,
      ostrzezenia: [
        `Inwestor „${profil.typInwestora}" nie może tworzyć zasobu „${profil.typZasobu}" w reżimie ${
          profil.rezim === "current" ? "obecnym" : "nowym"
        }.`,
      ],
    };
  }
  if (dostep === "ograniczony")
    ostrzezenia.push(
      `Dostęp „ograniczony": ${profil.typInwestora} może tworzyć ${profil.typZasobu}, ale warunkowo — zweryfikuj wymogi ustawowe i dostępność instrumentów.`
    );
  return { dostep, zablokowana: false, ostrzezenia };
}

// ── Baza montażu (znormalizowana z gotowego stacku lub złożona z instrumentów) ─

interface BazaMontazu {
  grant: Zakres;
  grantTbc: boolean;
  grantUwaga?: string;
  loanMax: Zakres;
  loanDostepny: boolean;
  loanTbc: boolean;
  partycypacja: Zakres;
  partycypacjaUwaga?: string;
  kapitalWlasnyMin: number;
  constraints: string[];
}

/** Kategoria zasobu w tabelach funding_percentage instrumentów grantowych. */
function kategoriaGrantu(rezim: RezimFinansowy, z: TypZasobu): string {
  if (rezim === "current") {
    if (z === "SPOLECZNY_CZYNSZOWY" || z === "SPOLDZIELCZY_LOKATORSKI") return "spoleczny_czynszowy";
    return "komunalny_socjalny"; // SOCJALNY, KOMUNALNY
  }
  if (z === "SOCJALNY") return "socjalny";
  if (z === "KOMUNALNY") return "komunalny";
  if (z === "SPOLDZIELCZY_LOKATORSKI") return "spoldzielczy_lokatorski";
  return "spoleczny_czynszowy";
}

function instrument(rezim: RezimFinansowy, id: string): Record<string, unknown> | undefined {
  return P.support_instruments[kluczRezimu(rezim)].find((i) => i.id === id);
}

/** Partycypacja / wkład najemcy z resource_types (autorytatywne). */
function partycypacjaZasobu(profil: ProfilFilter): { z: Zakres; uwaga?: string } {
  const r = zasob(profil.typZasobu);
  if (profil.typZasobu === "SPOLDZIELCZY_LOKATORSKI")
    return { z: { min: 0.2, max: 0.4 }, uwaga: "Wkład członka wg regulaminu (zwykle 20–40% kosztów)." };
  if (profil.typZasobu === "SPOLECZNY_CZYNSZOWY") {
    const max = profil.rezim === "current" ? num(r?.tenant_participation_max_current, 0.3) : num(r?.tenant_participation_max_future, 0.1);
    const uwaga = profil.rezim === "future" ? "0% dla najemców <35 lat (nowy reżim)." : undefined;
    return { z: { min: 0, max }, uwaga };
  }
  return { z: { min: 0, max: 0 } }; // socjalny/komunalny — bez partycypacji najemcy
}

type ProfilFilter = Pick<ProfilFinansowy, "typZasobu" | "rezim">;

/** Granty z gotowego montażu (funding_stacks). */
function grantZeStacku(stack: Record<string, unknown>, profil: ProfilFinansowy): { z: Zakres; tbc: boolean; uwagi: string[] } {
  const grants = (stack.grants ?? {}) as Record<string, unknown>;

  // ── REGUŁA DOTACYJNA: społeczny czynszowy → do 35% (baza 20%) ─────────────────
  // Dotacja z Funduszu Dopłat dla społecznego czynszowego to BAZA 20%, do 35% przy
  // partycypacji gminy / warunkach efektywności (BSK_GRANT.funding_percentage.spoleczny_czynszowy).
  // Stosujemy pełną stawkę, gdy:
  //  • reżim PRZYSZŁY (nowy grant bezpośredni ma drogę do 35% — inaczej „płaskie 20%" nigdy nie
  //    dochodzi do 35%), LUB
  //  • reżim OBECNY + prywatny SIM z UMOWĄ PARTYCYPACYJNĄ z gminą — beneficjentem dotacji jest
  //    gmina, która przekazuje środki SIM-owi; umowa odblokowuje pełną stawkę (vs prywatne {0,0.20}).
  // Warunek MAX (35%) = efektywność energetyczna / OZE / FEnIKS. Bez umowy z gminą prywatny SIM
  // zostaje przy niższym dostępie {0, 0.20} (przechodzi do generycznego składania niżej).
  const spolCzynszowy = profil.typZasobu === "SPOLECZNY_CZYNSZOWY";
  const umowaPartycypacyjnaGminy = profil.wspolpracaGmina !== "BRAK";
  const prywatnySim = profil.typInwestora === "SIM_PRYWATNY";
  if (spolCzynszowy && (profil.rezim === "future" || (prywatnySim && umowaPartycypacyjnaGminy))) {
    const bazaPct = 0.2;
    const maxPct = 0.35;
    const stawka = profil.efektywnoscEnergetyczna ? maxPct : bazaPct;
    const uwagiReg: string[] = [];
    if (profil.rezim === "current" && prywatnySim && umowaPartycypacyjnaGminy)
      uwagiReg.push("Dotacja przez gminę (beneficjent): umowa partycypacyjna z gminą odblokowuje stawkę do 35% (baza 20%).");
    if (!profil.efektywnoscEnergetyczna)
      uwagiReg.push("Do 35% kosztów przy efektywności energetycznej / OZE / FEnIKS.");
    return { z: { min: stawka, max: stawka }, tbc: profil.rezim === "future", uwagi: uwagiReg };
  }

  let min = 0;
  let max = 0;
  let tbc = false;
  const uwagi: string[] = [];
  const gmina = inwestorGminny(profil.typInwestora) || profil.wspolpracaGmina !== "BRAK";
  const lzgZpi =
    profil.sposobWniesieniaDzialki === "LOKAL_ZA_GRUNT" ||
    profil.wspolpracaGmina === "LOKAL_ZA_GRUNT" ||
    profil.wspolpracaGmina === "ZPI";

  for (const [gk, gvRaw] of Object.entries(grants)) {
    if (gk === "FENIKS" || gk === "OZE") {
      if (!profil.efektywnoscEnergetyczna) continue;
      const t = num((gvRaw as Record<string, unknown>).typical);
      min += t;
      max += t;
      continue;
    }
    if (gk === "BSK") {
      if (!gmina) {
        uwagi.push("BSK niedostępny bez roli/współpracy gminy (grant idzie przez gminę).");
        continue;
      }
      const gv = gvRaw as Record<string, unknown>;
      min += num(gv.min);
      max += num(gv.max, num(gv.min));
      if (profil.typInwestora === "SIM_PRYWATNY" || profil.typInwestora === "SPOLDZIELNIA")
        uwagi.push("BSK w obecnym reżimie „trudno dostępny” dla tego inwestora (dolna granica realistyczna).");
      continue;
    }
    if (gk === "NOWY_GRANT") {
      tbc = true;
      if (typeof gvRaw === "number") {
        min += gvRaw;
        max += gvRaw;
      } else {
        const gv = gvRaw as Record<string, unknown>;
        const base = num(gv.base);
        const mx = num(gv.max, base);
        min += base;
        max += lzgZpi ? mx : base;
        if (mx > base && !lzgZpi) uwagi.push(`Maksymalny grant komunalny (${proc(mx)}%) wymaga Lokal za Grunt lub ZPI.`);
      }
      if (profil.efektywnoscEnergetyczna) uwagi.push("Status FEnIKS/OZE w nowym reżimie do potwierdzenia (tbc).");
      continue;
    }
  }
  return { z: { min, max }, tbc, uwagi };
}

/** Granty złożone z support_instruments (gdy brak gotowego stacku). */
function grantZeSkladania(profil: ProfilFinansowy): { z: Zakres; tbc: boolean; uwagi: string[] } {
  const uwagi: string[] = [];
  const kat = kategoriaGrantu(profil.rezim, profil.typZasobu);
  let min = 0;
  let max = 0;
  let tbc = false;
  const gmina = inwestorGminny(profil.typInwestora) || profil.wspolpracaGmina !== "BRAK";

  if (profil.rezim === "current") {
    const bsk = instrument("current", "BSK_GRANT");
    const fp = ((bsk?.funding_percentage ?? {}) as Record<string, Record<string, number>>)[kat];
    if (fp && gmina) {
      min += num(fp.base);
      max += num(fp.max, num(fp.base));
    } else if (fp) {
      uwagi.push("BSK niedostępny bez roli/współpracy gminy (grant idzie przez gminę).");
    }
    if (profil.efektywnoscEnergetyczna) {
      min += num(instrument("current", "FENIKS_GRANT")?.funding_percentage_typical);
      max += num(instrument("current", "FENIKS_GRANT")?.funding_percentage_typical);
      min += num(instrument("current", "OZE_CIEPLOWNICTWO_PREMIE")?.funding_percentage_typical);
      max += num(instrument("current", "OZE_CIEPLOWNICTWO_PREMIE")?.funding_percentage_typical);
    }
  } else {
    tbc = true;
    const ng = instrument("future", "NOWY_GRANT");
    const fp = ((ng?.funding_percentage ?? {}) as Record<string, unknown>)[kat];
    const lzgZpi =
      profil.sposobWniesieniaDzialki === "LOKAL_ZA_GRUNT" ||
      profil.wspolpracaGmina === "LOKAL_ZA_GRUNT" ||
      profil.wspolpracaGmina === "ZPI";
    if (typeof fp === "number") {
      min += fp;
      max += fp;
    } else if (fp) {
      const o = fp as Record<string, unknown>;
      const base = num(o.base);
      const mx = num(o.max, base);
      min += base;
      max += lzgZpi ? mx : base;
      if (mx > base && !lzgZpi) uwagi.push(`Maksymalny grant komunalny (${proc(mx)}%) wymaga Lokal za Grunt lub ZPI.`);
    }
    if (profil.efektywnoscEnergetyczna) uwagi.push("Status FEnIKS/OZE w nowym reżimie do potwierdzenia (tbc).");
  }
  return { z: { min, max }, tbc, uwagi };
}

function bazaMontazu(profil: ProfilFinansowy): BazaMontazu {
  const klucz = `${profil.typInwestora}_${profil.typZasobu}`;
  const stack = montazGotowy(profil.rezim, klucz);
  const constraints: string[] = [];
  const grant = stack ? grantZeStacku(stack, profil) : grantZeSkladania(profil);
  constraints.push(...grant.uwagi);
  if (stack && Array.isArray(stack.constraints)) constraints.push(...(stack.constraints as string[]));

  // Kredyt — udział CAPEX z gotowego stacku lub z instrumentu (max_share_of_capex).
  const gmina = profil.typInwestora === "GMINA";
  let loanMax: Zakres = { min: 0, max: 0 };
  let loanDostepny = true;
  let loanTbc = false;
  let kapitalWlasnyMin = 0;

  if (profil.rezim === "current") {
    if (gmina) {
      loanDostepny = false; // gmina bezpośrednio nie korzysta z kredytu preferencyjnego
      kapitalWlasnyMin = num((stack?.own_capital_required_min as number) ?? 0.15);
    } else {
      const m = stack ? num((stack.loan as Record<string, unknown>)?.SBC_max, 0.8) : num(instrument("current", "SBC_KREDYT")?.max_share_of_capex, 0.8);
      loanMax = { min: 0, max: m };
    }
  } else {
    if (gmina) {
      loanTbc = true;
      loanDostepny = true; // available_tbc
    }
    const arr = ((stack?.loan as Record<string, unknown>)?.NOWY_KREDYT_BGK_max_tbc ?? instrument("future", "NOWY_KREDYT_BGK")?.max_share_of_capex_tbc) as
      | [number, number]
      | undefined;
    loanMax = arr ? { min: arr[0], max: arr[1] } : { min: 0.7, max: 0.8 };
    loanTbc = true;
  }

  // Wkład kapitałowy gminny (jawnie z gotowego stacku).
  if (stack && typeof stack.own_capital_required_min === "number" && kapitalWlasnyMin === 0)
    kapitalWlasnyMin = stack.own_capital_required_min as number;

  const part = partycypacjaZasobu(profil);
  return {
    grant: grant.z,
    grantTbc: grant.tbc,
    loanMax,
    loanDostepny,
    loanTbc,
    partycypacja: part.z,
    partycypacjaUwaga: part.uwaga,
    kapitalWlasnyMin,
    constraints,
  };
}

// ── Parametry kredytu (z support_instruments) ────────────────────────────────

function parametryKredytu(profil: ProfilFinansowy, loanMax: Zakres, invEU: boolean): ParametryKredytuAnkiety | null {
  if (profil.typInwestora === "GMINA" && profil.rezim === "current") return null; // gmina nie kredytuje
  if (profil.rezim === "current") {
    const s = instrument("current", "SBC_KREDYT")!;
    const zakres = ((s.interest_rate as Record<string, unknown>).effective_range as [number, number]) ?? [0.02, 0.04];
    const covered = (s.covered_costs as string[]) ?? [];
    return {
      nazwa: "Kredyt preferencyjny SBC (BGK)",
      oprocentowanie: { min: zakres[0], max: zakres[1] },
      typStopy: "zmienne",
      okresLat: num(s.loan_period_years, 30),
      maxUdzialCapexPct: { min: proc(loanMax.min), max: proc(invEU ? Math.min(loanMax.max, 0.7) : loanMax.max) },
      pokrywaGrunt: covered.includes("nabycie_gruntu"),
      prowizjaPct: num(s.commission, 0.0075),
      tbc: false,
    };
  }
  const s = instrument("future", "NOWY_KREDYT_BGK")!;
  const opcje = ((s.interest_rate as Record<string, unknown>).options as number[]) ?? [0.01, 0.02];
  const covered = (s.covered_costs as string[]) ?? [];
  return {
    nazwa: "Nowy kredyt preferencyjny BGK",
    oprocentowanie: { min: Math.min(...opcje), max: Math.max(...opcje) },
    typStopy: "stałe",
    okresLat: num(s.loan_period_years, 50),
    annuityFactor: { min: num(s.annuity_factor_1pct_50yr, 0.0255), max: num(s.annuity_factor_2pct_50yr, 0.0318) },
    maxUdzialCapexPct: { min: proc(loanMax.min), max: proc(invEU ? Math.min(loanMax.max, 0.7) : loanMax.max) },
    pokrywaGrunt: covered.some((c) => c.startsWith("nabycie_gruntu")),
    tbc: true,
  };
}

// ── Traktowanie gruntu (Q4) ──────────────────────────────────────────────────

function traktowanieGruntu(profil: ProfilFinansowy, pokrywaGrunt: boolean): { opis: string; ostrzezenia: string[] } {
  const ostrzezenia: string[] = [];
  switch (profil.sposobWniesieniaDzialki) {
    case "APORT_GMINNY":
      ostrzezenia.push("Aport gminny: grunt poza bazą finansowania — istotnie poprawia wykonalność.");
      if (pokrywaGrunt) ostrzezenia.push("Jeśli mimo aportu część gruntu w kredycie — max 20% CAPEX z kredytu na grunt (aport_constraint).");
      return { opis: "Aport gminny — grunt jako wkład niepieniężny, poza bazą finansowania.", ostrzezenia };
    case "ZAKUP_KREDYT":
      if (!pokrywaGrunt) ostrzezenia.push("Wybrany kredyt nie obejmuje nabycia gruntu — grunt musi pokryć inne źródło.");
      return { opis: "Zakup finansowany kredytem projektu (w bazie kredytu, jeśli obejmuje grunt).", ostrzezenia };
    case "ZAKUP_KAPITAL_WLASNY":
      return { opis: "Zakup ze środków własnych inwestora — grunt poza kredytem i grantem.", ostrzezenia };
    case "JUZ_POSIADANA":
      return { opis: "Działka już w posiadaniu inwestora — poza nowym finansowaniem.", ostrzezenia };
    case "LOKAL_ZA_GRUNT":
      ostrzezenia.push("Lokal za Grunt: zobowiązanie oddania lokali do zasobu komunalnego w zamian za grunt.");
      return { opis: "Lokal za Grunt — grunt od gminy w zamian za lokale komunalne.", ostrzezenia };
  }
}

// ── Porównanie reżimów (key_comparisons) ─────────────────────────────────────

export function porownajRezimy(profil: ProfilFinansowy): PorownanieRezimow {
  const kc = P.key_comparisons;
  const ds = kc.debt_service_per_1M_PLN_loan;
  const rd = kc.regime_differences;
  const komentarz: string[] = [
    `Obsługa długu na 1 mln PLN kredytu spada z ${ds.current_SBC_30yr_3pct.toLocaleString("pl-PL")} zł/rok (obecny, 30 lat) do ${ds.new_BGK_50yr_2pct.toLocaleString(
      "pl-PL"
    )}–${ds.new_BGK_50yr_1pct.toLocaleString("pl-PL")} zł/rok (nowy, 50 lat, 1–2%).`,
    "Nowy reżim = niższa rata, ale mniejsza partycypacja (30% → 10%) i brak wykupu z grantem — kompromis, nie czysty zysk.",
  ];
  if (profil.typInwestora === "SIM_PRYWATNY")
    komentarz.push("SIM prywatny: grant przez gminę „trudno dostępny” (obecny) → grant bezpośredni (nowy). Timing wniosku może odwrócić wynik.");
  if (profil.typInwestora === "SPOLDZIELNIA")
    komentarz.push("Spółdzielnia: grant przez gminę trudny (obecny) → grant bezpośredni (nowy) — zmiana przełomowa.");
  return {
    obslugaDluguNa1MlnPln: {
      obecny: ds.current_SBC_30yr_3pct,
      nowy2pct: ds.new_BGK_50yr_2pct,
      nowy1pct: ds.new_BGK_50yr_1pct,
      oszczednoscPct: { min: ds.savings_pct_new_vs_current[0], max: ds.savings_pct_new_vs_current[1] },
    },
    roznice: {
      liczbaUstaw: { obecny: rd.number_of_acts.current, nowy: rd.number_of_acts.future },
      liczbaWnioskow: { obecny: rd.number_of_applications.current, nowy: rd.number_of_applications.future },
      okresKredytuLata: { obecny: rd.loan_period_max_years.current, nowy: rd.loan_period_max_years.future },
      maxPartycypacjaPct: { obecny: proc(rd.participation_max_pct.current), nowy: proc(rd.participation_max_pct.future) },
      wykupZGrantem: { obecny: rd.buyout_with_grant.current, nowy: rd.buyout_with_grant.future },
      sciezkaGrantu: { obecny: rd.grant_pathway_for_SIM.current, nowy: rd.grant_pathway_for_SIM.future },
      typStopy: { obecny: rd.loan_interest_rate_type.current, nowy: rd.loan_interest_rate_type.future },
    },
    komentarz,
  };
}

// ── Główna: złożenie montażu finansowego ─────────────────────────────────────

export function zlozMontaz(profil: ProfilFinansowy): AnalizaFinansowa {
  const walidacja = walidujUprawnienia(profil);
  const okno = sugerujRezim(profil.dataWniosku).oknoPrzejsciowe;
  const ostrzezenia = [...walidacja.ostrzezenia];
  const flagiTbc: string[] = [];

  if (walidacja.zablokowana) {
    return {
      profil,
      rezim: profil.rezim,
      dostepZasobu: walidacja.dostep,
      zablokowana: true,
      montaz: [],
      instrumenty: [],
      kredyt: null,
      traktowanieGruntu: "—",
      wykupDozwolony: false,
      weryfikacjaDochodowa: "—",
      procedura: "—",
      ostrzezenia,
      flagiTbc,
      oknoPrzejsciowe: okno,
      porownanieRezimow: okno ? porownajRezimy(profil) : null,
    };
  }

  const baza = bazaMontazu(profil);
  const invEU =
    !!profil.nowyPodmiot && profil.typInwestora !== "GMINA" && profil.rezim === "current"; // gwarancja InvestEU (nowe podmioty)
  const kredyt = parametryKredytu(profil, baza.loanMax, invEU);
  const grunt = traktowanieGruntu(profil, kredyt?.pokrywaGrunt ?? false);
  ostrzezenia.push(...grunt.ostrzezenia, ...baza.constraints);

  // Reguła #1 — grant nie finansuje gruntu (oba reżimy).
  ostrzezenia.push("Grant nie finansuje nabycia gruntu — grunt zawsze z kredytu / kapitału / aportu / LzG.");

  // Instrumenty i flagi tbc.
  const instrumenty: InstrumentWsparcia[] = [];
  if (baza.grant.max > 0) instrumenty.push({ id: "GRANT", nazwa: profil.rezim === "current" ? "Grant BSK / FEnIKS / OZE" : "Nowy grant (bezpośredni)", typ: "bezzwrotny_grant" });
  if (baza.loanDostepny && kredyt) instrumenty.push({ id: "KREDYT", nazwa: kredyt.nazwa, typ: "kredyt_preferencyjny" });
  if (invEU) {
    instrumenty.push({ id: "INVESTEU_GWARANCJA", nazwa: "Gwarancja InvestEU (nowe podmioty)", typ: "gwarancja_kredytu" });
    ostrzezenia.push("Gwarancja InvestEU: pokrycie 30%, kredyt ≤70% CAPEX, do 10 mln €, koszt 0 — dla podmiotu bez zdolności kredytowej.");
  }
  if (profil.mieszkanieNaStart)
    instrumenty.push({ id: "MIESZKANIE_NA_START", nazwa: "Mieszkanie na Start (dopłata do czynszu)", typ: "doplata_do_czynszu" });

  if (profil.rezim === "future") {
    flagiTbc.push(
      "Udział nowego kredytu w CAPEX (70% czy 80%)",
      "Czy nowy kredyt obejmuje grunt",
      "Katalog kosztów kwalifikowanych nowego grantu",
      "Status FEnIKS / OZE w nowym reżimie"
    );
  }

  // Wykup, weryfikacja dochodowa, procedura.
  const r = zasob(profil.typZasobu);
  const wykupDozwolony = profil.rezim === "current" ? !!r?.buyout_current : !!r?.buyout_future;
  if (profil.rezim === "future" && baza.grant.max > 0)
    ostrzezenia.push("Nowy reżim: zakaz wykupu mieszkań sfinansowanych z grantem.");
  const weryfikacjaDochodowa =
    (profil.rezim === "current" ? r?.income_verification_current : r?.income_verification_future) ??
    (profil.rezim === "current" ? "roczny PIT" : "cykliczna (co 3–5 lat)");
  const procedura = profil.rezim === "current" ? "dwa wnioski (grant + kredyt osobno)" : "jeden zintegrowany wniosek (grant + kredyt)";

  // Składniki montażu (udziały maksymalne/orientacyjne w CAPEX).
  const montaz: SkladnikMontazu[] = [];
  if (baza.grant.max > 0)
    montaz.push({
      klucz: "grant",
      nazwa: "Grant (bezzwrotny)",
      udzialPct: { min: proc(baza.grant.min), max: proc(baza.grant.max) },
      tbc: baza.grantTbc,
      uwaga: "Nie pokrywa gruntu.",
    });
  if (baza.loanDostepny && kredyt)
    montaz.push({
      klucz: "kredyt",
      nazwa: kredyt.nazwa,
      udzialPct: kredyt.maxUdzialCapexPct,
      tbc: kredyt.tbc,
      uwaga: `${kredyt.typStopy === "stałe" ? "stała" : "zmienna"} ${proc(kredyt.oprocentowanie.min)}–${proc(kredyt.oprocentowanie.max)}%, ${kredyt.okresLat} lat${
        kredyt.pokrywaGrunt ? ", obejmuje grunt" : ""
      }`,
    });
  if (baza.partycypacja.max > 0)
    montaz.push({
      klucz: "partycypacja",
      nazwa: "Partycypacja / wkład najemcy",
      udzialPct: { min: proc(baza.partycypacja.min), max: proc(baza.partycypacja.max) },
      tbc: false,
      uwaga: baza.partycypacjaUwaga,
    });
  if (baza.kapitalWlasnyMin > 0)
    montaz.push({
      klucz: "kapital_wlasny",
      nazwa: "Wymagany kapitał własny",
      udzialPct: { min: proc(baza.kapitalWlasnyMin), max: proc(baza.kapitalWlasnyMin) },
      tbc: false,
    });

  return {
    profil,
    rezim: profil.rezim,
    dostepZasobu: walidacja.dostep,
    zablokowana: false,
    montaz,
    instrumenty,
    kredyt,
    traktowanieGruntu: grunt.opis,
    wykupDozwolony,
    weryfikacjaDochodowa,
    procedura,
    ostrzezenia: [...new Set(ostrzezenia)],
    flagiTbc,
    oknoPrzejsciowe: okno,
    porownanieRezimow: okno ? porownajRezimy(profil) : null,
  };
}
