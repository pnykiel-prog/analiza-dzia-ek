/**
 * Przekrój montażu finansowego M3 — OBA reżimy obok siebie (obecny / przyszły 2027+).
 * ================================================================================
 * Nie werdykt („spina się / nie spina"), lecz PRZEKRÓJ: koszt inwestycji rozbity na
 * źródła, gdzie **wkład własny jest pozycją domykającą**. Liczone czysto i
 * deterministycznie — funkcja zasila suwak kosztu budowy (przelicza na żywo).
 *
 * Uproszczenie względem pełnego modelu czasowo-reżimowego (poziom3.ts): pomijamy
 * indeksację do daty, uzbrojenie, rezerwy i koszty finansowe budowy — na tym
 * ekranie klient steruje jedną dźwignią (koszt budowy) i widzi wrażliwość montażu.
 *
 * KOSZT   = koszt budowy (suwak × PUM całkowite) + cena gruntu (gdy zakup)
 * ŹRÓDŁA  = grant · kredyt (ze zdolności czynszowej) · aport działki (gdy aport)
 *           · partycypacja najemców · wkład gminy · WKŁAD WŁASNY (domykający)
 */

import type { KonfiguracjaFinanse, ParametryRezimu } from "../config";
import { KONFIG_FINANSE } from "../config";

/** Rola wartości działki w przekroju wg sposobu wniesienia. */
export type RolaDzialki = "zrodlo" | "koszt" | "neutralna";

export interface WejscieMontazu {
  pumMieszkalnaM2: number; // PUM (do czynszu i kredytu)
  pumCalkowiteM2: number; // PUM + wspólne/usługowe (do kosztu budowy)
  kosztBudowyM2: number; // suwak [zł/m²]
  wartoscOdtworzeniowaM2: number; // A° — pułap czynszu
  wartoscDzialkiPln: number; // R — rola zależna od wniesienia
  rolaDzialki: RolaDzialki; // aport → źródło, zakup → koszt, posiadana/LzG → neutralna
  partycypacjaNajemcowPct: number; // % kosztu (opcjonalne, 0 gdy brak)
  wkladGminyPct: number; // % kosztu (opcjonalne, 0 gdy brak)
}

export interface KolumnaMontazu {
  rezim: "obecny" | "przyszly";
  nazwa: string;
  koszt: { budowa: number; grunt: number; razem: number };
  zrodla: {
    grant: number;
    kredyt: number;
    aport: number;
    partycypacjaNajemcow: number;
    wkladGminy: number;
    wkladWlasny: number; // pozycja DOMYKAJĄCA
  };
  czynszM2: number; // pułap czynszu SIM [zł/m²/mc]
  zalozenia: {
    oprocentowaniePct: number;
    okresLat: number;
    maxGrantPct: number;
    stopaCzynszuPct: number;
    maxKredytPct: number;
  };
  flagaNiepewnosci: boolean;
}

/** Udział pozycji w koszcie [%] — do prezentacji kwotowo + procentowo. */
export function udzialPct(kwota: number, razem: number): number {
  return razem > 0 ? Math.round((kwota / razem) * 1000) / 10 : 0;
}

function kolumna(
  rezim: "obecny" | "przyszly",
  p: ParametryRezimu,
  wej: WejscieMontazu,
  cfg: KonfiguracjaFinanse
): KolumnaMontazu {
  const z = cfg.zalozenia;

  // ── KOSZT ────────────────────────────────────────────────────────────────
  const budowa = Math.round(wej.kosztBudowyM2 * wej.pumCalkowiteM2);
  const grunt = wej.rolaDzialki === "koszt" ? Math.round(wej.wartoscDzialkiPln) : 0;
  const razem = budowa + grunt;

  // ── Czynsz SIM (pułap = wartość odtworzeniowa × stopa / 12) ─────────────────
  const czynszM2 = (wej.wartoscOdtworzeniowaM2 * p.stopaPulapuCzynszu) / 12;

  // ── Kredyt ze zdolności czynszowej (DSCR = 1), ograniczony udziałem CAPEX ───
  const przychodRoczny = czynszM2 * wej.pumMieszkalnaM2 * 12 * (1 - z.pustostanyPct / 100);
  const kosztyOperacyjne = z.kosztyOperacyjneM2Mc * wej.pumMieszkalnaM2 * 12;
  const przychodNetto = przychodRoczny - kosztyOperacyjne;
  const r = p.oprocentowanie;
  const n = p.okresKredytuLata;
  const annuityFactor = r > 0 ? (1 - Math.pow(1 + r, -n)) / r : n;
  const kredytZObslugi = przychodNetto > 0 ? przychodNetto * annuityFactor : 0;
  const kredytLimit = (p.maxUdzialKredytuPct / 100) * razem;
  const kredyt = Math.max(0, Math.round(Math.min(kredytZObslugi, kredytLimit)));

  // ── Pozostałe źródła (kaskada domykająca) ──────────────────────────────────
  const aport = wej.rolaDzialki === "zrodlo" ? Math.round(wej.wartoscDzialkiPln) : 0;
  let reszta = Math.max(0, razem - kredyt - aport);

  const grant = Math.round(Math.min((p.maxGrantPct / 100) * razem, reszta));
  reszta = Math.max(0, reszta - grant);

  const partLimit = (Math.min(wej.partycypacjaNajemcowPct, p.maxPartycypacjaNajemcowPct) / 100) * razem;
  const partycypacjaNajemcow = Math.round(Math.min(partLimit, reszta));
  reszta = Math.max(0, reszta - partycypacjaNajemcow);

  const wkladGminy = Math.round(Math.min((wej.wkladGminyPct / 100) * razem, reszta));
  reszta = Math.max(0, reszta - wkladGminy);

  const wkladWlasny = reszta; // domyka

  return {
    rezim,
    nazwa: p.nazwa,
    koszt: { budowa, grunt, razem },
    zrodla: { grant, kredyt, aport, partycypacjaNajemcow, wkladGminy, wkladWlasny },
    czynszM2: Math.round(czynszM2 * 10) / 10,
    zalozenia: {
      oprocentowaniePct: Math.round(p.oprocentowanie * 1000) / 10,
      okresLat: p.okresKredytuLata,
      maxGrantPct: p.maxGrantPct,
      stopaCzynszuPct: Math.round(p.stopaPulapuCzynszu * 1000) / 10,
      maxKredytPct: p.maxUdzialKredytuPct,
    },
    flagaNiepewnosci: p.flagaNiepewnosci,
  };
}

/** Przekrój obu reżimów: obecny (A_SBC_2026) i przyszły (B_program_2027). */
export function przekrojObuRezimow(
  wej: WejscieMontazu,
  cfg: KonfiguracjaFinanse = KONFIG_FINANSE
): { obecny: KolumnaMontazu; przyszly: KolumnaMontazu } {
  return {
    obecny: kolumna("obecny", cfg.rezimy.A_SBC_2026, wej, cfg),
    przyszly: kolumna("przyszly", cfg.rezimy.B_program_2027, wej, cfg),
  };
}

/** Rola wartości działki w przekroju wg sposobu wniesienia (mapowanie z ankiety). */
export function rolaZeSposobu(sposob: string): RolaDzialki {
  if (sposob === "ZAKUP_KREDYT" || sposob === "ZAKUP_KAPITAL_WLASNY") return "koszt";
  if (sposob === "APORT_GMINNY" || sposob === "LOKAL_ZA_GRUNT") return "zrodlo";
  return "neutralna"; // JUZ_POSIADANA
}
