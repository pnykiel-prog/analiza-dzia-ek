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

type KluczZmiennej = keyof typeof gus.zapytania;

/** Cache wykrytych ID zmiennych (BDL var-id się nie zmienia) — w obrębie instancji serwera. */
const cacheId = new Map<KluczZmiennej, string | null>();

/** Znajduje ID zmiennej: nadpisanie z konfiguracji albo auto-dobór z BDL (z cache). */
async function idZmiennej(klucz: KluczZmiennej): Promise<string | null> {
  const override = gus.zmienneId[klucz];
  if (override) return override;
  if (cacheId.has(klucz)) return cacheId.get(klucz)!;
  const fraza = gus.zapytania[klucz];
  if (!fraza) return null;
  const odp = await fetchJson(url("variables/search", { name: fraza }), { ...KONFIG_KONEKTORY.siec, naglowki: naglowki() });
  const id = pierwszaZmienna(odp);
  cacheId.set(klucz, id);
  return id;
}

async function wartosc(unitId: string, klucz: KluczZmiennej): Promise<number | null> {
  const varId = await idZmiennej(klucz);
  if (!varId) return null;
  // BDL: unit-id jest segmentem ścieżki (data/by-unit/{id}), nie parametrem zapytania.
  const odp = await fetchJson(url(`data/by-unit/${encodeURIComponent(unitId)}`, { "var-id": varId, year: String(gus.rok) }), {
    ...KONFIG_KONEKTORY.siec,
    naglowki: naglowki(),
  });
  return wartoscZmiennej(odp, gus.rok);
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

    // Liczebności do wyliczenia udziałów + gotowe wskaźniki.
    const [ogolem, l65, l2039, bezrobocie, podmioty, saldo] = await Promise.all([
      wartosc(jednostka.id, "ludnoscOgolem"),
      wartosc(jednostka.id, "ludnosc65"),
      wartosc(jednostka.id, "ludnosc2039"),
      wartosc(jednostka.id, "bezrobocie"),
      wartosc(jednostka.id, "podmiotyNa10k"),
      wartosc(jednostka.id, "saldoMigracji"),
    ]);

    if (ogolem && l65) dodaj("udzial65PlusPct", (l65 / ogolem) * 100, 80);
    if (ogolem && l2039) {
      dodaj("udzial2039Pct", (l2039 / ogolem) * 100, 80);
      // Baza odniesienia dla grupy „młodzi" (krajowa mediana) — bez niej udział sam nie liczy grupy.
      dodaj("mediana2039Woj", gus.medianaWiek2039Pct, 55);
    }
    dodaj("bezrobociePct", bezrobocie);
    dodaj("liczbaPodmiotowGosp", podmioty);
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
