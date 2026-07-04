/**
 * Archiwum przeanalizowanych działek — trwały zapis po stronie przeglądarki
 * (localStorage). MVP bez backendu: rekord przechowuje pełny `WynikAnalizy`,
 * dzięki czemu ponowne otwarcie renderuje dokładnie ten sam raport bez
 * przeliczania. Klucz rekordu = identyfikator działki (upsert — ponowna
 * analiza tej samej działki nadpisuje wpis, nie duplikuje).
 *
 * Logika (podsumowanie / upsert / usuwanie) jest czysta i testowalna offline;
 * dostęp do localStorage jest odizolowany i bezpieczny przy renderze SSR.
 */

import type { Profil, ProfilRekomendowany, Werdykt, WynikAnalizy } from "./types";

const KLUCZ = "grunt:archiwum:v1";

/** Skrót wpisu na listę + pełny wynik do ponownego renderu. */
export interface WpisArchiwum {
  id: string; // = identyfikator działki (dane.id); klucz upsertu
  identyfikator: string;
  gmina: string;
  powiat: string;
  wojewodztwo: string;
  powierzchniaM2: number;
  profilP1: ProfilRekomendowany;
  werdyktP1: Werdykt;
  scoreMlodzi: number;
  scoreSeniorzy: number;
  rekomendacjaM2: Profil | "brak";
  zapisano: string; // ISO 8601
  wynik: WynikAnalizy;
}

// ── Logika czysta ────────────────────────────────────────────────────────────

/** Buduje rekord archiwum z pełnego wyniku analizy. */
export function podsumujWynik(wynik: WynikAnalizy, zapisano: string): WpisArchiwum {
  const { dane, poziom1: p1, poziom2: p2 } = wynik;
  return {
    id: dane.id,
    identyfikator: dane.id,
    gmina: dane.gmina ?? "",
    powiat: dane.powiat ?? "",
    wojewodztwo: dane.wojewodztwo ?? "",
    powierzchniaM2: dane.powierzchniaM2 ?? 0,
    profilP1: p1.profilRekomendowany,
    werdyktP1: p1.werdykt,
    scoreMlodzi: p1.scoreMlodzi,
    scoreSeniorzy: p1.scoreSeniorzy,
    rekomendacjaM2: p2.ocenaM2.rekomendacja,
    zapisano,
    wynik,
  };
}

/** Wstawia/nadpisuje wpis (po id) i zwraca listę posortowaną najnowszymi na górze. */
export function upsert(lista: WpisArchiwum[], wpis: WpisArchiwum): WpisArchiwum[] {
  const bez = lista.filter((w) => w.id !== wpis.id);
  return [wpis, ...bez].sort((a, b) => b.zapisano.localeCompare(a.zapisano));
}

/** Usuwa wpis po id. */
export function usun(lista: WpisArchiwum[], id: string): WpisArchiwum[] {
  return lista.filter((w) => w.id !== id);
}

// ── Dostęp do localStorage (bezpieczny przy SSR) ─────────────────────────────

function magazyn(): Storage | null {
  try {
    return typeof window !== "undefined" ? window.localStorage : null;
  } catch {
    return null;
  }
}

/** Wczytuje archiwum (pusta lista, gdy brak danych lub uszkodzony zapis). */
export function wczytajArchiwum(): WpisArchiwum[] {
  const m = magazyn();
  if (!m) return [];
  try {
    const surowe = m.getItem(KLUCZ);
    if (!surowe) return [];
    const dane = JSON.parse(surowe);
    return Array.isArray(dane) ? (dane as WpisArchiwum[]) : [];
  } catch {
    return [];
  }
}

function zapiszArchiwum(lista: WpisArchiwum[]): void {
  const m = magazyn();
  if (!m) return;
  try {
    m.setItem(KLUCZ, JSON.stringify(lista));
  } catch {
    // Przekroczony limit / tryb prywatny — zapis nietrwały, nie przerywamy UI.
  }
}

/** Zapisuje wynik analizy do archiwum (upsert po identyfikatorze). Zwraca wpis. */
export function zapiszWynik(wynik: WynikAnalizy): WpisArchiwum {
  const wpis = podsumujWynik(wynik, new Date().toISOString());
  zapiszArchiwum(upsert(wczytajArchiwum(), wpis));
  return wpis;
}

/** Usuwa wpis z archiwum i zwraca zaktualizowaną listę. */
export function usunWpis(id: string): WpisArchiwum[] {
  const lista = usun(wczytajArchiwum(), id);
  zapiszArchiwum(lista);
  return lista;
}

/** Wczytuje pojedynczy wpis po identyfikatorze. */
export function wczytajWpis(id: string): WpisArchiwum | null {
  return wczytajArchiwum().find((w) => w.id === id) ?? null;
}

/** Czy dana działka jest już w archiwum. */
export function czyWArchiwum(id: string): boolean {
  return wczytajArchiwum().some((w) => w.id === id);
}
