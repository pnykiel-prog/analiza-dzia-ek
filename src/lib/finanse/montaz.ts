/**
 * JEDEN silnik montażu finansowego (M3) — wspólny dla przekroju i raportu.
 * =========================================================================
 * Naprawa u przyczyny (wytyczne_claude_code_P3_drabinka_i_silnik): koniec z dwoma
 * silnikami. Grant, kredyt i partycypacja pochodzą z `zlozMontaz(profil, reżim)`
 * — czyli z pliku parametrów WG ZASOBU (komunalny 50–85 %, nie płaska stawka 35 %).
 * Silnik nie ma własnego domyślnego modelu; składa montaż z tego, co plik mówi dla
 * danej trójki (podmiot × zasób × reżim).
 *
 * KOSZT (jedna definicja, spójna z raportem): budowa + grunt(gdy zakup) + uzbrojenie
 *   + projekt + koszty finansowe + rezerwa.
 * ŹRÓDŁA: grant (wg zasobu) · kredyt (ze zdolności czynszowej) · aport (gdy aport)
 *   · partycypacja (auto: max gdzie przysługuje, 0 komunalny/socjalny)
 *   · WKŁAD WŁASNY (domyka; etykieta wg podmiotu).
 */

import type { ProfilFinansowy, RezimFinansowy } from "./typy";
import type { Rezim } from "../types";
import type { KonfiguracjaFinanse } from "../config";
import { KONFIG_FINANSE } from "../config";
import { zlozMontaz } from "./ankieta";

export type RolaDzialki = "zrodlo" | "koszt" | "neutralna";

/** Rola wartości działki w przekroju wg sposobu wniesienia. */
export function rolaZeSposobu(sposob: string): RolaDzialki {
  if (sposob === "ZAKUP_KREDYT" || sposob === "ZAKUP_KAPITAL_WLASNY") return "koszt";
  if (sposob === "APORT_GMINNY" || sposob === "LOKAL_ZA_GRUNT") return "zrodlo";
  return "neutralna"; // JUZ_POSIADANA
}

/** Udział pozycji w koszcie [%] — do prezentacji kwotowo + procentowo. */
export function udzialPct(kwota: number, razem: number): number {
  return razem > 0 ? Math.round((kwota / razem) * 1000) / 10 : 0;
}

/** Proxy kosztu uzbrojenia [zł] — spójny z modelem P3 (bazowe + długość przyłączy). */
export function uzbrojenieProxy(odlegloscDoSieciM: number | null | undefined): number {
  if (odlegloscDoSieciM == null) return 150_000;
  return Math.round(50_000 + odlegloscDoSieciM * 800);
}

const KOD_REZIMU: Record<RezimFinansowy, Rezim> = { current: "A_SBC_2026", future: "B_program_2027" };

/** Podmioty, dla których pozycja domykająca nosi etykietę „wkład gminy". */
const PODMIOTY_GMINNE = new Set(["GMINA", "SPOLKA_GMINNA", "SIM_GMINNY"]);

export interface WejscieMontazu {
  kosztBudowyM2: number; // suwak
  powierzchniaBudowyM2: number; // JEDNA zdefiniowana powierzchnia (PUM całkowite)
  pumMieszkalnaM2: number; // do czynszu/przychodu
  wartoscOdtworzeniowaM2: number; // A° — pułap czynszu
  wartoscDzialkiPln: number; // R
  rolaDzialki: RolaDzialki;
  uzbrojeniePln: number; // z modelu (proxy)
}

export interface KolumnaMontazu {
  rezim: "obecny" | "przyszly";
  rezimFin: RezimFinansowy;
  nazwa: string;
  dostepny: boolean; // profil dozwolony w tym reżimie (inaczej „niedostępny")
  brakParametrow: boolean; // brak grantu i kredytu w pliku → jawna flaga, nie zgadywanie
  koszt: {
    budowa: number;
    grunt: number;
    uzbrojenie: number;
    projekt: number;
    kosztyFinansowe: number;
    rezerwa: number;
    razem: number;
  };
  zrodla: {
    grant: number;
    kredyt: number;
    aport: number;
    partycypacjaNajemcow: number;
    wkladWlasny: number; // pozycja DOMYKAJĄCA
  };
  etykietaWkladu: string; // „Wkład gminy" / „Wkład inwestora" wg podmiotu
  czynszM2: number;
  zalozenia: {
    grantPct: number;
    oprocentowaniePct: number;
    okresLat: number;
    stopaCzynszuPct: number;
    maxKredytPct: number;
    partycypacjaPct: number;
  };
  flagi: string[];
}

const srodek = (z: { min: number; max: number }) => (z.min + z.max) / 2;

/**
 * Złożenie jednej kolumny montażu dla danego reżimu. Grant/kredyt/partycypacja
 * pochodzą z `zlozMontaz` (wg zasobu). Zwraca pełne rozbicie kosztu i źródeł;
 * wkład własny domyka i nigdy nie schodzi poniżej zera.
 */
export function zlozKolumne(
  profil: ProfilFinansowy,
  rezimFin: RezimFinansowy,
  wej: WejscieMontazu,
  cfg: KonfiguracjaFinanse = KONFIG_FINANSE
): KolumnaMontazu {
  const rezimUI = rezimFin === "current" ? "obecny" : "przyszly";
  const kod = KOD_REZIMU[rezimFin];
  const rp = cfg.rezimy[kod];
  const z = cfg.zalozenia;
  const gminny = PODMIOTY_GMINNE.has(profil.typInwestora);
  const etykietaWkladu = gminny ? "Wkład gminy (domyka)" : "Wkład inwestora (domyka)";

  // ── Parametry montażu WG ZASOBU (z pliku, nie płaska stawka) ────────────────
  const a = zlozMontaz({ ...profil, rezim: rezimFin });
  const flagi = [...a.flagiTbc];

  const pusteZrodla = { grant: 0, kredyt: 0, aport: 0, partycypacjaNajemcow: 0, wkladWlasny: 0 };
  const pustyKoszt = { budowa: 0, grunt: 0, uzbrojenie: 0, projekt: 0, kosztyFinansowe: 0, rezerwa: 0, razem: 0 };

  if (a.zablokowana) {
    return {
      rezim: rezimUI, rezimFin, nazwa: rp.nazwa, dostepny: false, brakParametrow: false,
      koszt: pustyKoszt, zrodla: pusteZrodla, etykietaWkladu, czynszM2: 0,
      zalozenia: { grantPct: 0, oprocentowaniePct: 0, okresLat: 0, stopaCzynszuPct: 0, maxKredytPct: 0, partycypacjaPct: 0 },
      flagi: [`Kombinacja niedostępna w reżimie „${rezimUI}": ${a.ostrzezenia[0] ?? "brak dostępu do zasobu"}`],
    };
  }

  const grantSk = a.montaz.find((m) => m.klucz === "grant");
  const partSk = a.montaz.find((m) => m.klucz === "partycypacja");
  const grantPct = grantSk ? srodek(grantSk.udzialPct) : null; // % (proc() już przeliczył)
  const partPct = partSk ? partSk.udzialPct.max : 0; // auto: max gdzie przysługuje
  const maxKredytPct = a.kredyt ? a.kredyt.maxUdzialCapexPct.max : 0;
  const oproc = a.kredyt ? srodek(a.kredyt.oprocentowanie) : rp.oprocentowanie;
  const okres = a.kredyt ? a.kredyt.okresLat : rp.okresKredytuLata;
  const brakParametrow = grantPct == null && !a.kredyt;
  if (brakParametrow) flagi.push("Brak parametrów montażu dla tej kombinacji w pliku — wynik do uzupełnienia (nie zgadujemy).");

  // ── KOSZT (jedna definicja bazy, spójna z raportem) ─────────────────────────
  const budowa = Math.round(wej.kosztBudowyM2 * wej.powierzchniaBudowyM2);
  const grunt = wej.rolaDzialki === "koszt" ? Math.round(wej.wartoscDzialkiPln) : 0;
  const uzbrojenie = Math.round(wej.uzbrojeniePln);
  const projekt = Math.round((budowa * z.kosztyProjektowePct) / 100);
  const kosztBezFin = grunt + budowa + uzbrojenie + projekt;
  const szacKredyt = (maxKredytPct / 100) * kosztBezFin;
  const kosztyFinansowe = Math.round(szacKredyt * rp.prowizjaPct + szacKredyt * oproc * (cfg.osCzasu.budowaMies / 12) * 0.5);
  const rezerwa = Math.round(((budowa + uzbrojenie) * z.rezerwaRyzykoPct) / 100);
  const razem = grunt + budowa + uzbrojenie + projekt + kosztyFinansowe + rezerwa;

  // ── Czynsz pułap (5 % wartości odtworzeniowej) + kredyt ze zdolności czynszowej ─
  const czynszM2 = (wej.wartoscOdtworzeniowaM2 * rp.stopaPulapuCzynszu) / 12;
  const przychodRoczny = czynszM2 * wej.pumMieszkalnaM2 * 12 * (1 - z.pustostanyPct / 100);
  const kosztyOperacyjne = z.kosztyOperacyjneM2Mc * wej.pumMieszkalnaM2 * 12;
  const przychodNetto = przychodRoczny - kosztyOperacyjne;
  const annuityFactor = oproc > 0 ? (1 - Math.pow(1 + oproc, -okres)) / oproc : okres;
  const kredytZObslugi = przychodNetto > 0 ? przychodNetto * annuityFactor : 0;
  const kredyt = Math.max(0, Math.round(Math.min(kredytZObslugi, (maxKredytPct / 100) * razem)));

  // ── Kaskada domykająca (suma ≤ koszt; wkład własny ≥ 0) ─────────────────────
  const aport = wej.rolaDzialki === "zrodlo" ? Math.round(wej.wartoscDzialkiPln) : 0;
  let reszta = Math.max(0, razem - kredyt - aport);
  const grant = grantPct != null ? Math.round(Math.min((grantPct / 100) * razem, reszta)) : 0;
  reszta = Math.max(0, reszta - grant);
  const partycypacjaNajemcow = Math.round(Math.min((partPct / 100) * razem, reszta));
  reszta = Math.max(0, reszta - partycypacjaNajemcow);
  const wkladWlasny = reszta;

  return {
    rezim: rezimUI,
    rezimFin,
    nazwa: rp.nazwa,
    dostepny: true,
    brakParametrow,
    koszt: { budowa, grunt, uzbrojenie, projekt, kosztyFinansowe, rezerwa, razem },
    zrodla: { grant, kredyt, aport, partycypacjaNajemcow, wkladWlasny },
    etykietaWkladu,
    czynszM2: Math.round(czynszM2 * 10) / 10,
    zalozenia: {
      grantPct: grantPct != null ? Math.round(grantPct * 10) / 10 : 0,
      oprocentowaniePct: Math.round(oproc * 1000) / 10,
      okresLat: okres,
      stopaCzynszuPct: Math.round(rp.stopaPulapuCzynszu * 1000) / 10,
      maxKredytPct: Math.round(maxKredytPct * 10) / 10,
      partycypacjaPct: Math.round(partPct * 10) / 10,
    },
    flagi,
  };
}

/** Przekrój obu reżimów (obecny + przyszły) — każdy z właściwym stosem wg zasobu. */
export function przekrojMontazu(
  profil: ProfilFinansowy,
  wej: WejscieMontazu,
  cfg: KonfiguracjaFinanse = KONFIG_FINANSE
): { obecny: KolumnaMontazu; przyszly: KolumnaMontazu } {
  return {
    obecny: zlozKolumne(profil, "current", wej, cfg),
    przyszly: zlozKolumne(profil, "future", wej, cfg),
  };
}
