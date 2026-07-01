/** Formatowanie liczb i etykiet do prezentacji. */

import type { Profil, ProfilRekomendowany, Rezim, Scenariusz, Typologia, Werdykt } from "./types";

export function pln(v: number | null | undefined): string {
  if (v === null || v === undefined || Number.isNaN(v)) return "—";
  return new Intl.NumberFormat("pl-PL", { style: "currency", currency: "PLN", maximumFractionDigits: 0 }).format(v);
}

export function plnMln(v: number | null | undefined): string {
  if (v === null || v === undefined || Number.isNaN(v)) return "—";
  return `${(v / 1_000_000).toFixed(2)} mln zł`;
}

export function liczba(v: number | null | undefined, sufiks = "", miejsca = 0): string {
  if (v === null || v === undefined || Number.isNaN(v)) return "—";
  return `${v.toLocaleString("pl-PL", { maximumFractionDigits: miejsca })}${sufiks}`;
}

export function pct(v: number | null | undefined, miejsca = 0): string {
  if (v === null || v === undefined || Number.isNaN(v)) return "—";
  return `${v.toFixed(miejsca)}%`;
}

export const etykietaWerdyktu: Record<Werdykt, string> = {
  zielony: "Zielony — akceptacja wstępna",
  zolty: "Żółty — warunkowo",
  czerwony: "Czerwony — wykluczone / wymaga rewizji",
};

/** Status słowny werdyktu (jak w prototypie GRUNT: „Nadaje się" / „Warunkowo" / …). */
export const statusSlowny: Record<Werdykt, string> = {
  zielony: "Nadaje się",
  zolty: "Warunkowo",
  czerwony: "Nie nadaje się",
};

export const etykietaProfilu: Record<ProfilRekomendowany, string> = {
  mlodzi: "Dla młodych",
  seniorzy: "Senioralny",
  oba: "Oba profile",
  zaden: "Żaden profil",
};

export function etykietaProfilKrotka(p: Profil): string {
  return p === "mlodzi" ? "młodzi" : "seniorzy";
}

export const etykietaTypologii: Record<Typologia, string> = {
  niska_wielorodzinna: "Niska wielorodzinna (3–4 kond.)",
  sredniowysoka_wielorodzinna: "Średniowysoka wielorodzinna (5–8 kond., winda)",
  pierzejowa_mixed_use: "Pierzejowa / mixed-use (parter usługowy)",
  senioralna_wspomagana: "Senioralna / wspomagana (pełna dostępność)",
};

export const etykietaScenariusza: Record<Scenariusz, string> = {
  konserwatywny: "Konserwatywny",
  oczekiwany: "Oczekiwany",
  korzystny: "Korzystny",
};

export const etykietaRezimu: Record<Rezim, string> = {
  A_SBC_2026: "A — SBC 2026",
  B_program_2027: "B — program 2027+",
  C_upside_unijny: "C — upside unijny",
};

export function kolorWerdyktu(w: Werdykt): { bg: string; text: string; kropka: string } {
  switch (w) {
    case "zielony":
      return { bg: "bg-grunt-green-bg", text: "text-grunt-green", kropka: "bg-grunt-green" };
    case "zolty":
      return { bg: "bg-grunt-amber-bg", text: "text-grunt-amber-text", kropka: "bg-grunt-amber" };
    case "czerwony":
      return { bg: "bg-grunt-red-bg", text: "text-grunt-red", kropka: "bg-grunt-red" };
  }
}
