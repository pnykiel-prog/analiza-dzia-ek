/**
 * Konektor GUS BDL — demografia i rynek pracy (M1, Poziom 1).
 *
 * Ścieżka: units/search (znajdź jednostkę po nazwie gminy + poziom) →
 * data/by-unit (wartości zmiennych). Mapowanie pól → ID zmiennych w konfiguracji
 * (do potwierdzenia w katalogu BDL). Brak ID / brak danych → status „brak"
 * (biała plama), nie błąd.
 *
 * Funkcje parsujące są czyste (testowalne offline).
 */

import type { DaneDzialki } from "../../types";
import type { Konektor, Teren, WynikKonektora, MetaPola } from "./types";
import { brakWyniku } from "./types";
import { fetchJson } from "./net";
import { KONFIG_KONEKTORY } from "../connectorsConfig";

interface JednostkaBDL {
  id: string;
  name: string;
  level?: number;
}

/** Wybiera jednostkę BDL pasującą nazwą (dokładnie), w razie braku pierwszą. */
export function wybierzJednostke(json: unknown, nazwa: string): JednostkaBDL | null {
  const wyniki = (json as { results?: JednostkaBDL[] })?.results;
  if (!Array.isArray(wyniki) || wyniki.length === 0) return null;
  const norm = (s: string) => s.toLowerCase().trim();
  return wyniki.find((u) => norm(u.name) === norm(nazwa)) ?? wyniki[0];
}

/** Wyciąga wartość zmiennej (dla roku lub najnowszą) z odpowiedzi data/by-unit. */
export function wartoscZmiennej(json: unknown, rok?: number): number | null {
  const obj = json as { values?: { year?: string | number; val?: number }[]; results?: { values?: { year?: string | number; val?: number }[] }[] };
  const values = obj?.values ?? obj?.results?.[0]?.values;
  if (!Array.isArray(values) || values.length === 0) return null;
  if (rok != null) {
    const dop = values.find((v) => Number(v.year) === rok);
    if (dop && typeof dop.val === "number") return dop.val;
  }
  const posortowane = [...values].filter((v) => typeof v.val === "number").sort((a, b) => Number(b.year) - Number(a.year));
  return posortowane[0]?.val ?? null;
}

const gus = KONFIG_KONEKTORY.gus;

function url(sciezka: string, params: Record<string, string>): string {
  const qs = new URLSearchParams({ format: "json", ...params }).toString();
  return `${gus.endpoint}/${sciezka}?${qs}`;
}

function naglowki(): Record<string, string> {
  return gus.clientId ? { "X-ClientId": gus.clientId } : {};
}

/** Mapowanie: klucz zmiennej konfiguracji → pole DaneDzialki. */
const MAPA_POL: { zmienna: keyof typeof gus.zmienne; pole: keyof DaneDzialki }[] = [
  { zmienna: "udzial65Plus", pole: "udzial65PlusPct" },
  { zmienna: "udzial2039", pole: "udzial2039Pct" },
  { zmienna: "bezrobocie", pole: "bezrobociePct" },
  { zmienna: "podmiotyNa10k", pole: "liczbaPodmiotowGosp" },
  { zmienna: "saldoMigracji", pole: "saldoMigracjiMlodzi" },
  { zmienna: "pustostany", pole: "pustostanyPct" },
];

export const konektorGUS: Konektor = {
  klucz: "GUS_BDL",
  zrodlo: "GUS Bank Danych Lokalnych",
  poziom: "P1",
  aktywny: gus.aktywny,
  async pobierz(teren: Teren): Promise<WynikKonektora> {
    const czas = new Date().toISOString();
    const skonfigurowane = MAPA_POL.filter((m) => gus.zmienne[m.zmienna]);
    if (!teren.gmina || skonfigurowane.length === 0) {
      return brakWyniku(this.klucz, this.zrodlo, czas, "Brak nazwy gminy lub nieskonfigurowane ID zmiennych BDL.");
    }

    const jedn = await fetchJson(url("units/search", { name: teren.gmina, level: String(gus.poziomGmina) }), {
      ...KONFIG_KONEKTORY.siec,
      naglowki: naglowki(),
    });
    const jednostka = wybierzJednostke(jedn, teren.gmina);
    if (!jednostka) return brakWyniku(this.klucz, this.zrodlo, czas, "Nie znaleziono jednostki BDL.");

    const dane: Partial<DaneDzialki> = {};
    const meta: MetaPola[] = [];
    for (const m of skonfigurowane) {
      const varId = gus.zmienne[m.zmienna];
      const odp = await fetchJson(url("data/by-unit", { "unit-id": jednostka.id, "var-id": varId, year: String(gus.rok) }), {
        ...KONFIG_KONEKTORY.siec,
        naglowki: naglowki(),
      });
      const v = wartoscZmiennej(odp, gus.rok);
      if (v !== null) {
        (dane[m.pole] as number) = Math.round(v * 100) / 100;
        meta.push({ pole: m.pole, zrodlo: this.zrodlo, czas, pewnosc: 90, status: "ok", tryb: "A" });
      }
    }

    if (Object.keys(dane).length === 0) {
      return brakWyniku(this.klucz, this.zrodlo, czas, "Brak wartości zmiennych dla jednostki.");
    }
    return { klucz: this.klucz, zrodlo: this.zrodlo, status: "ok", czas, dane, meta };
  },
};
