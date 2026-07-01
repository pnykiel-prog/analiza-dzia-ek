/**
 * Konektor GUS BDL — demografia i rynek pracy (M1, Poziom 1).
 *
 * Auto-dobór zmiennych z katalogu BDL po nazwie (`variables/search`) — frazy są
 * stabilniejsze niż numeryczne ID; konektor sam znajduje ID na BDL (można je
 * nadpisać w konfiguracji `zmienneId`). Następnie:
 *  - units/search → jednostka gminy,
 *  - data/by-unit → wartości zmiennych,
 *  - wyliczenie udziałów (65+, 20–39) z liczebności / ludności ogółem.
 *
 * Funkcje parsujące są czyste (testowane offline). Brak danych → status „brak".
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

/** Pierwsze ID zmiennej z odpowiedzi variables/search. */
export function pierwszaZmienna(json: unknown): string | null {
  const wyniki = (json as { results?: { id?: number | string }[] })?.results;
  if (!Array.isArray(wyniki) || wyniki.length === 0) return null;
  const id = wyniki[0]?.id;
  return id != null ? String(id) : null;
}

/** Wyciąga wartość zmiennej (dla roku lub najnowszą) z odpowiedzi data/by-unit. */
export function wartoscZmiennej(json: unknown, rok?: number): number | null {
  const obj = json as {
    values?: { year?: string | number; val?: number }[];
    results?: { values?: { year?: string | number; val?: number }[] }[];
  };
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

/**
 * Wartości WIELU zmiennych w JEDNYM zapytaniu (data/by-unit z powtórzonym `var-id`).
 * Krytyczne dla limitów BDL: bez X-ClientId równoległe pojedyncze zapytania są
 * odrzucane (429) — jedno zbiorcze omija limit i mieści się w czasie funkcji.
 */
async function wartosciWielu(unitId: string, varIds: string[]): Promise<Map<string, number | null>> {
  const qs = new URLSearchParams({ format: "json", year: String(gus.rok) });
  for (const id of varIds) qs.append("var-id", id);
  const odp = await fetchJson<{ results?: { id?: string | number; values?: { year?: string | number; val?: number }[] }[] }>(
    `${gus.endpoint}/data/by-unit/${encodeURIComponent(unitId)}?${qs.toString()}`,
    { ...KONFIG_KONEKTORY.siec, naglowki: naglowki() }
  );
  const map = new Map<string, number | null>();
  for (const r of odp?.results ?? []) {
    const vals = r.values ?? [];
    const dop = vals.find((v) => Number(v.year) === gus.rok) ?? [...vals].sort((a, b) => Number(b.year) - Number(a.year))[0];
    map.set(String(r.id), typeof dop?.val === "number" ? dop.val : null);
  }
  return map;
}

/**
 * Zmienne BDL „Ludność wg grup wieku i płci" (temat P2137), kolumna „· ogółem":
 *  72305 = ogółem (razem); 72306 = 0-4; każda kolejna 5-letnia grupa = +1
 *  (72307=5-9, 72308=10-14, …). Potwierdzone diagnostyką /api/diag-gus.
 */
const P2137_OGOLEM_TOTAL = "72305";
const P2137_OGOLEM_0_4 = 72306;
const idPasma = (k: number): string => String(P2137_OGOLEM_0_4 + k); // k=0 → 0-4, k=4 → 20-24, k=12 → 60-64
const PASMA_0_64 = Array.from({ length: 13 }, (_, k) => idPasma(k)); // 0-4 … 60-64
const PASMA_20_39 = [4, 5, 6, 7].map(idPasma); // 20-24, 25-29, 30-34, 35-39

/** Suma wartości pasm (null, gdy któregokolwiek brak — nie zaniżamy udziału). */
function sumaPasm(wartosci: (number | null)[]): number | null {
  if (wartosci.some((v) => v === null)) return null;
  return (wartosci as number[]).reduce((s, v) => s + v, 0);
}

export const konektorGUS: Konektor = {
  klucz: "GUS_BDL",
  zrodlo: "GUS Bank Danych Lokalnych",
  poziom: "P1",
  aktywny: gus.aktywny,
  async pobierz(teren: Teren): Promise<WynikKonektora> {
    const czas = new Date().toISOString();
    if (!teren.gmina) return brakWyniku(this.klucz, this.zrodlo, czas, "Brak nazwy gminy.");

    // Wyszukanie jednostki: najpierw z filtrem poziomu (gmina), a gdy brak trafienia —
    // bez filtra (miasta na prawach powiatu bywają na innym poziomie niż zwykła gmina).
    const jedn = await fetchJson(url("units/search", { name: teren.gmina, level: String(gus.poziomGmina) }), {
      ...KONFIG_KONEKTORY.siec,
      naglowki: naglowki(),
    });
    if (jedn === null) return brakWyniku(this.klucz, this.zrodlo, czas, "BDL nieosiągalny (units/search) — sieć/egress.");
    let jednostka = wybierzJednostke(jedn, teren.gmina);
    if (!jednostka) {
      const jedn2 = await fetchJson(url("units/search", { name: teren.gmina }), { ...KONFIG_KONEKTORY.siec, naglowki: naglowki() });
      jednostka = wybierzJednostke(jedn2, teren.gmina);
    }
    if (!jednostka) return brakWyniku(this.klucz, this.zrodlo, czas, `Nie znaleziono jednostki BDL dla gminy „${teren.gmina}".`);

    const dane: Partial<DaneDzialki> = {};
    const meta: MetaPola[] = [];
    const dodaj = (pole: keyof DaneDzialki, v: number | null, pewnosc = 90) => {
      if (v === null || Number.isNaN(v)) return;
      (dane[pole] as number) = Math.round(v * 100) / 100;
      meta.push({ pole, zrodlo: this.zrodlo, czas, pewnosc, status: "ok", tryb: "A" });
    };

    // Demografia z pasm wieku (P2137, kolumna „· ogółem") + wskaźniki — JEDNO zapytanie
    // zbiorcze (limity BDL: równoległe pojedyncze zapytania bywają odrzucane bez X-ClientId).
    const idPodmioty = gus.zmienneId.podmiotyNa10k ?? "60530";
    const idSaldo = gus.zmienneId.saldoMigracji ?? "1365234";
    const potrzebne = [...new Set([P2137_OGOLEM_TOTAL, ...PASMA_0_64, ...PASMA_20_39, idPodmioty, idSaldo])];
    const m = await wartosciWielu(jednostka.id, potrzebne);
    if ([...m.values()].every((v) => v === null)) {
      return brakWyniku(
        this.klucz,
        this.zrodlo,
        czas,
        `Jednostka „${jednostka.name}" (id ${jednostka.id}) znaleziona, ale zbiorcze data/by-unit nie zwróciło wartości (limit BDL/rok ${gus.rok}?). Diagnostyka: /api/diag-gus?gmina=${encodeURIComponent(teren.gmina)}.`
      );
    }
    const ogolem = m.get(P2137_OGOLEM_TOTAL) ?? null;
    const pasma0_64 = sumaPasm(PASMA_0_64.map((id) => m.get(id) ?? null));
    const pasma20_39 = sumaPasm(PASMA_20_39.map((id) => m.get(id) ?? null));
    const podmioty = m.get(idPodmioty) ?? null;
    const saldo = m.get(idSaldo) ?? null;

    if (ogolem && ogolem > 0) {
      // 65+ = ogółem − (0–64); udział 20–39 z sumy pasm. „Brak danych ≠ nie" — gdy pasma niepełne, pomijamy.
      if (pasma0_64 !== null) dodaj("udzial65PlusPct", ((ogolem - pasma0_64) / ogolem) * 100, 80);
      if (pasma20_39 !== null) {
        dodaj("udzial2039Pct", (pasma20_39 / ogolem) * 100, 80);
        dodaj("mediana2039Woj", gus.medianaWiek2039Pct, 55); // baza odniesienia dla „młodych"
      }
    }
    // BDL 60530 to podmioty „na 10 tys." — model/UI używa „na 1000", więc /10.
    dodaj("liczbaPodmiotowGosp", podmioty === null ? null : podmioty / 10);
    dodaj("saldoMigracjiMlodzi", saldo, 70); // proxy: saldo ogółem (nie tylko 25–39)

    if (Object.keys(dane).length === 0) {
      return brakWyniku(
        this.klucz,
        this.zrodlo,
        czas,
        `Jednostka „${jednostka.name}" (id ${jednostka.id}) znaleziona, ale brak wartości — frazy nie trafiają w ID zmiennych BDL. Ustaw gus.zmienneId w konfiguracji (diagnostyka: /api/diag-gus?gmina=${encodeURIComponent(teren.gmina)}).`
      );
    }
    return { klucz: this.klucz, zrodlo: this.zrodlo, status: "ok", czas, dane, meta };
  },
};
