/**
 * Typowany dostęp do `parametry_finansowania.json`.
 *
 * Zgodnie z zasadą „konfiguracja, nie kod" liczby (procenty grantów, udziały
 * kredytu, oprocentowanie, reguły przejściowe) trzymamy w JSON. Po publikacji
 * finalnej ustawy i rozporządzeń aktualizujemy WYŁĄCZNIE JSON — logika ankiety
 * i analizy pozostaje bez zmian.
 */

import surowe from "./parametry_finansowania.json";
import type { RezimFinansowy } from "./typy";

export const PARAMETRY_FINANSOWANIA = surowe as unknown as ParametryFinansowania;

/** Klucz sekcji reżimu w JSON (`current` → `current_regime`). */
export function kluczRezimu(r: RezimFinansowy): "current_regime" | "future_regime" {
  return r === "current" ? "current_regime" : "future_regime";
}

// ── Kształt JSON (fragmenty używane przez logikę; reszta jako luźne rekordy) ──

export interface InvestorType {
  id: string;
  name: string;
  legal_form: string;
  capital_structure: string;
  profit_distribution: string;
  can_build_resources: string[];
  notes?: string;
}

export interface ResourceType {
  id: string;
  name: string;
  target_group: string;
  rent_level: string;
  contract_type: string;
  buyout_current: boolean;
  buyout_future: boolean;
  buyout_future_exception?: string;
  tenant_participation_max_current?: number;
  tenant_participation_max_future?: number;
  tenant_participation_under_35_future?: number;
  income_verification_current?: string;
  income_verification_future?: string;
  member_contribution?: string;
}

export type Dostep = "brak" | "ograniczony" | "pełen";
export type MacierzRezimu = Record<string, Record<string, Dostep>>;

export interface KeyComparisons {
  debt_service_per_1M_PLN_loan: {
    current_SBC_30yr_3pct: number;
    new_BGK_50yr_2pct: number;
    new_BGK_50yr_1pct: number;
    savings_pct_new_vs_current: [number, number];
  };
  regime_differences: {
    number_of_acts: { current: number; future: number };
    number_of_applications: { current: number; future: number };
    grant_pathway_for_SIM: { current: string; future: string };
    grant_pathway_for_spoldzielnia: { current: string; future: string };
    loan_interest_rate_type: { current: string; future: string };
    loan_period_max_years: { current: number; future: number };
    participation_max_pct: { current: number; future: number };
    buyout_with_grant: { current: boolean; future: boolean };
  };
}

export interface TransitionRules {
  application_before_new_law: string;
  application_after_new_law: string;
  project_in_progress_at_transition: string;
  uncertainty_window_years: string;
  strategic_consideration: string;
}

/** Luźne rekordy tam, gdzie logika czyta dynamicznie po kluczach. */
export interface ParametryFinansowania {
  metadata: Record<string, unknown>;
  regimes: Record<string, { id: string; name: string; [k: string]: unknown }>;
  investor_types: InvestorType[];
  resource_types: ResourceType[];
  support_instruments: Record<"current_regime" | "future_regime", Array<Record<string, unknown>>>;
  cooperation_mechanisms: Array<Record<string, unknown>>;
  investor_resource_matrix: Record<"current_regime" | "future_regime", MacierzRezimu>;
  funding_stacks: Record<"current_regime" | "future_regime", Record<string, Record<string, unknown>>>;
  key_comparisons: KeyComparisons;
  transition_rules: TransitionRules;
  tbc_parameters: { description: string; items: string[] };
  monitoring_sources: Record<string, string[]>;
}

// ── Skróty dostępowe ─────────────────────────────────────────────────────────

export function inwestorzy(): InvestorType[] {
  return PARAMETRY_FINANSOWANIA.investor_types;
}

export function zasoby(): ResourceType[] {
  return PARAMETRY_FINANSOWANIA.resource_types;
}

export function zasob(id: string): ResourceType | undefined {
  return PARAMETRY_FINANSOWANIA.resource_types.find((z) => z.id === id);
}

export function inwestor(id: string): InvestorType | undefined {
  return PARAMETRY_FINANSOWANIA.investor_types.find((i) => i.id === id);
}

export function macierz(r: RezimFinansowy): MacierzRezimu {
  return PARAMETRY_FINANSOWANIA.investor_resource_matrix[kluczRezimu(r)];
}

export function montazGotowy(r: RezimFinansowy, klucz: string): Record<string, unknown> | undefined {
  return PARAMETRY_FINANSOWANIA.funding_stacks[kluczRezimu(r)][klucz];
}
