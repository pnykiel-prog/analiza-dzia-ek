/**
 * Katalog trybów pól (R / R? / A / A° / A± / S) — wg dokumentu
 * „Katalog danych i tryby pól — wprowadzanie per poziom".
 *
 * Tryb steruje widocznością i edytowalnością pola na danym poziomie.
 * Reguła nadrzędna: im wyżej poziom, tym więcej parametrów odsłoniętych;
 * konfiguracja systemowa (S) nigdy nie jest polem inputu.
 */

export type Tryb = "R" | "R?" | "A" | "A°" | "A±" | "S";

export const OPIS_TRYBU: Record<Tryb, { nazwa: string; opis: string; klasa: string }> = {
  R: { nazwa: "R", opis: "Ręczne — wymagane", klasa: "bg-red-100 text-red-700" },
  "R?": { nazwa: "R?", opis: "Ręczne — opcjonalne", klasa: "bg-orange-100 text-orange-700" },
  A: { nazwa: "A", opis: "Automatyczne — ukryte", klasa: "bg-slate-100 text-slate-500" },
  "A°": { nazwa: "A°", opis: "Automatyczne — tylko odczyt", klasa: "bg-blue-100 text-blue-700" },
  "A±": { nazwa: "A±", opis: "Automatyczne — modyfikowalne (override)", klasa: "bg-violet-100 text-violet-700" },
  S: { nazwa: "S", opis: "Systemowe / konfiguracyjne", klasa: "bg-slate-100 text-slate-400" },
};

/**
 * Reguła wystarczalności danych rynkowych (sekcja 7 dokumentu).
 * Tryb pola rynkowego (czynsz / cena nowych) zależy od liczby ofert N po
 * wyczerpaniu drabiny przestrzennej.
 */
export interface ProgiRynkowe {
  wiarygodne: number; // N ≥ tu → A± pełna pewność
  szacunek: number; // N ≥ tu → A± „szacunek"
}

export const PROGI_RYNKOWE: ProgiRynkowe = { wiarygodne: 30, szacunek: 10 };

export type StatusRynkowy = "wiarygodne" | "szacunek" | "niewystarczajace";

export function statusRynkowy(N: number, progi: ProgiRynkowe = PROGI_RYNKOWE): StatusRynkowy {
  if (N >= progi.wiarygodne) return "wiarygodne";
  if (N >= progi.szacunek) return "szacunek";
  return "niewystarczajace";
}

/**
 * Tryb pola rynkowego zależny od poziomu i statusu danych.
 * - P1: zawsze A (ukryte) — nigdy nie pytamy użytkownika (sek. 7.3).
 * - P2: niewystarczające → przełączenie A± → R (z medianą regionalną jako podpowiedzią).
 */
export function trybRynkowy(N: number, poziom: 1 | 2 | 3): { tryb: Tryb; status: StatusRynkowy; etykietaZrodla: string } {
  const status = statusRynkowy(N);
  if (poziom === 1) {
    return {
      tryb: "A",
      status,
      etykietaZrodla: status === "niewystarczajace" ? "fallback regionalny (niska pewność)" : "oferty lokalne",
    };
  }
  if (status === "niewystarczajace") {
    return { tryb: "R", status, etykietaZrodla: "fallback regionalny / ręczne" };
  }
  return { tryb: "A±", status, etykietaZrodla: status === "szacunek" ? "oferty lokalne (szacunek)" : "oferty lokalne" };
}

/** Tryby pól na Poziomie 2 (do oznaczeń w UI). */
export const TRYBY_P2: Record<string, Tryb> = {
  statusPlanistyczny: "A±",
  wskaznikiPlanistyczne: "A±",
  wlasnoscKW: "R",
  odlegloscDoSieciM: "A°",
  warunkiPrzylaczenia: "R",
  geotechnika: "R?",
  sredniSpadekPct: "A°",
  ryzykoPowodzioweSzczegolne: "A°",
  osuwisko: "A°",
  uslugiPodstawowePieszo: "A°",
  pozWZasiegu: "A°",
  zlobkiSzkolyWZasiegu: "A°",
  czasDojazdAglomeracjaMin: "A°",
  przystanekZCzestotliwoscia: "A°",
  natura2000: "A°",
  ochronaWykluczajaca: "A°",
  strefaKonserwatorska: "A°",
  cenaNowychM2: "A±",
  czynszRynkowyM2: "A±",
  pustostanyPct: "A±",
  normatywParkingowy: "A±",
};

/** Tryby pól na Poziomie 3. */
export const TRYBY_P3: Record<string, Tryb> = {
  scenariuszRezim: "A±",
  fazyOsiCzasu: "A±",
  parametryProgramu: "A±",
  wartoscOdtworzeniowaM2: "A°",
  kosztBudowyM2: "A±",
  cenaGruntu: "R",
  kosztUzbrojenia: "A±",
  partycypacje: "R",
  indeksy: "A±",
  pustostanyRezerwa: "A±",
};
