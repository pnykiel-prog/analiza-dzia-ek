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
  const bazowe: Record<string, string> = { format: "json", ...params };
  // Klucz API także jako parametr URL (obok nagłówka) — odporność na proxy zdejmujące nagłówki.
  if (gus.clientId) bazowe["client-id"] = gus.clientId;
  return `${gus.endpoint}/${sciezka}?${new URLSearchParams(bazowe).toString()}`;
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
  const map = new Map<string, number | null>();
  // BDL ogranicza liczbę var-id na zapytanie — dzielimy na paczki (sekwencyjnie, bez serii równoległych).
  const ROZMIAR_PACZKI = 12;
  for (let i = 0; i < varIds.length; i += ROZMIAR_PACZKI) {
    const paczka = varIds.slice(i, i + ROZMIAR_PACZKI);
    const qs = new URLSearchParams({ format: "json", year: String(gus.rok) });
    if (gus.clientId) qs.set("client-id", gus.clientId);
    for (const id of paczka) qs.append("var-id", id);
    const odp = await fetchJson<{ results?: { id?: string | number; values?: { year?: string | number; val?: number; attrId?: number }[] }[] }>(
      `${gus.endpoint}/data/by-unit/${encodeURIComponent(unitId)}?${qs.toString()}`,
      { ...KONFIG_KONEKTORY.siec, naglowki: naglowki() }
    );
    for (const r of odp?.results ?? []) {
      const vals = r.values ?? [];
      const dop = vals.find((v) => Number(v.year) === gus.rok) ?? [...vals].sort((a, b) => Number(b.year) - Number(a.year))[0];
      // BDL: attrId===0 oznacza brak danych (val bywa 0) — traktujemy jako null.
      const brakDanych = dop?.attrId === 0;
      map.set(String(r.id), !brakDanych && typeof dop?.val === "number" ? dop.val : null);
    }
  }
  return map;
}

/**
 * Temat BDL „Ludność wg grup wieku i płci" (P2137). ID zmiennych pasm NIE są
 * ciągłe — dlatego zamiast zgadywać, odczytujemy listę zmiennych tematu i
 * parsujemy zakres wieku z nazwy (kolumna „· ogółem"). Total = 72305.
 */
const TEMAT_GRUPY_WIEKU = "P2137";
const P2137_OGOLEM_TOTAL = "72305";

interface PasmoWieku {
  id: string;
  lo: number;
  hi: number; // Infinity dla „N i więcej"
}

/** Parsuje zakres wieku z etykiety BDL: „20-24" → [20,24]; „85 i więcej" → [85,∞]. */
function zakresWieku(band: string): [number, number] | null {
  const przedzial = band.match(/^(\d+)\s*[-–]\s*(\d+)$/);
  if (przedzial) return [Number(przedzial[1]), Number(przedzial[2])];
  const otwarty = band.match(/^(\d+)\s*(?:i\s*(?:wi|więcej|wiecej)|\+)/i);
  if (otwarty) return [Number(otwarty[1]), Infinity];
  return null; // „ogółem" itp.
}

/** Cache listy pasm (definicja zmiennych P2137 jest stała) — 1 zapytanie na instancję, nie na analizę. */
let cachePasma: PasmoWieku[] | null = null;

/** Lista pasm wieku (kolumna „· ogółem") tematu P2137 — samodobór z katalogu (bez zgadywania ID). */
async function pasmaWiekuOgolem(): Promise<PasmoWieku[]> {
  if (cachePasma && cachePasma.length > 0) return cachePasma;
  const odp = await fetchJson<{ results?: { id?: number | string; n1?: string; n2?: string; n3?: string }[] }>(
    url("variables", { "subject-id": TEMAT_GRUPY_WIEKU, "page-size": "100" }),
    { ...KONFIG_KONEKTORY.siec, naglowki: naglowki() }
  );
  const out: PasmoWieku[] = [];
  for (const r of odp?.results ?? []) {
    const czesci = [r.n1, r.n2, r.n3].filter(Boolean) as string[];
    if (czesci[czesci.length - 1] !== "ogółem") continue; // tylko kolumna obu płci
    const zakres = zakresWieku(czesci[0] ?? "");
    if (zakres) out.push({ id: String(r.id), lo: zakres[0], hi: zakres[1] });
  }
  if (out.length > 0) cachePasma = out;
  return out;
}

/** Suma wartości wybranych pasm (null, gdy któregokolwiek brak — nie zaniżamy udziału). */
function sumaPasm(pasma: PasmoWieku[], m: Map<string, number | null>): number | null {
  if (pasma.length === 0) return null;
  let suma = 0;
  for (const p of pasma) {
    const v = m.get(p.id);
    if (v === null || v === undefined) return null;
    suma += v;
  }
  return suma;
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

    // Demografia z pasm wieku (P2137) — samodobór pasm z katalogu (ID nieciągłe),
    // potem JEDNO zbiorcze data/by-unit (limity BDL: serie równoległe bywają odrzucane).
    const idPodmioty = gus.zmienneId.podmiotyNa10k ?? "60530";
    const idSaldo = gus.zmienneId.saldoMigracji ?? "1365234";
    const pasma = await pasmaWiekuOgolem();
    const potrzebne = [...new Set([P2137_OGOLEM_TOTAL, ...pasma.map((p) => p.id), idPodmioty, idSaldo])];
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
    // WAŻNE: temat zawiera też pasma zbiorcze („0-14", „70 i więcej") nakładające się
    // na 5-letnie — sumujemy WYŁĄCZNIE pasma 5-letnie (szerokość == 4), by nie liczyć podwójnie.
    const piecioletnie = pasma.filter((p) => p.hi - p.lo === 4);
    // 65+ = ogółem − (0–64); 20–39 = pasma 20-24…35-39. Sumy null, gdy pasmo bez danych.
    const pasma0_64 = sumaPasm(piecioletnie.filter((p) => p.hi <= 64), m);
    const pasma20_39 = sumaPasm(piecioletnie.filter((p) => p.lo >= 20 && p.hi <= 39), m);
    const podmioty = m.get(idPodmioty) ?? null;
    const saldo = m.get(idSaldo) ?? null;

    if (ogolem && ogolem > 0) {
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
