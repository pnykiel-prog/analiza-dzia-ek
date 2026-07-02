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
  parentId?: string;
}

/** Jednostka historyczna/nieaktualna w BDL (np. „M.st.Warszawa do 2001") — bez bieżących danych. */
function jednostkaHistoryczna(name: string): boolean {
  return /\bdo\s+(19|20)\d{2}\b/i.test(name); // „do 2001", „do 1998" itp.
}

/** Wybiera aktualną jednostkę BDL pasującą nazwą; pomija jednostki archiwalne („…do 2001"). */
export function wybierzJednostke(json: unknown, nazwa: string): JednostkaBDL | null {
  const wyniki = (json as { results?: JednostkaBDL[] })?.results;
  if (!Array.isArray(wyniki) || wyniki.length === 0) return null;
  const dopasuj = (s: string) => s.toLowerCase().trim();
  // Pomijamy jednostki archiwalne (mają id, ale data/by-unit nic nie zwraca).
  // Gdy w tej odpowiedzi są SAME archiwalne → zwracamy null, aby konektor spróbował
  // innego wyszukiwania (np. bez filtra poziomu) i znalazł aktualną jednostkę.
  const aktualne = wyniki.filter((u) => !jednostkaHistoryczna(u.name));
  if (aktualne.length === 0) return null;
  // Preferencja: dokładna nazwa → nazwa zawierająca szukaną (np. „Powiat m.st. Warszawa") → pierwsza.
  return (
    aktualne.find((u) => dopasuj(u.name) === dopasuj(nazwa)) ??
    aktualne.find((u) => dopasuj(u.name).includes(dopasuj(nazwa))) ??
    aktualne[0]
  );
}

/** Diagnostyka: surowe wyniki units/search (z filtrem poziomu i bez) — do namierzania jednostki. */
export async function diagJednostki(name: string): Promise<unknown> {
  const upros = (j: unknown) =>
    ((j as { results?: JednostkaBDL[] })?.results ?? []).map((u) => ({ id: u.id, name: u.name, level: u.level }));
  const zLevel = await fetchJson(url("units/search", { name, level: String(gus.poziomGmina) }), {
    ...KONFIG_KONEKTORY.siec,
    naglowki: naglowki(),
  });
  const bezLevel = await fetchJson(url("units/search", { name }), { ...KONFIG_KONEKTORY.siec, naglowki: naglowki() });
  return { name, poziomGmina: gus.poziomGmina, zLevel: upros(zLevel), bezLevel: upros(bezLevel) };
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
async function wartosciWielu(unitId: string, varIds: string[], rok: number = gus.rok): Promise<Map<string, number | null>> {
  const map = new Map<string, number | null>();
  // BDL ogranicza liczbę var-id na zapytanie — dzielimy na paczki (sekwencyjnie, bez serii równoległych).
  const ROZMIAR_PACZKI = 12;
  for (let i = 0; i < varIds.length; i += ROZMIAR_PACZKI) {
    const paczka = varIds.slice(i, i + ROZMIAR_PACZKI);
    const qs = new URLSearchParams({ format: "json", year: String(rok) });
    if (gus.clientId) qs.set("client-id", gus.clientId);
    for (const id of paczka) qs.append("var-id", id);
    const odp = await fetchJson<{ results?: { id?: string | number; values?: { year?: string | number; val?: number; attrId?: number }[] }[] }>(
      `${gus.endpoint}/data/by-unit/${encodeURIComponent(unitId)}?${qs.toString()}`,
      { ...KONFIG_KONEKTORY.siec, naglowki: naglowki() }
    );
    for (const r of odp?.results ?? []) {
      const vals = r.values ?? [];
      const dop = vals.find((v) => Number(v.year) === rok) ?? [...vals].sort((a, b) => Number(b.year) - Number(a.year))[0];
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

// ── Regionalna baza odniesienia (mediana wojewódzka 20–39) ───────────────────

const norm = (s: string) => s.toLowerCase().trim();

/** Cache: nazwa województwa → id jednostki BDL (poziom 2). Bardzo mała zmienność. */
const cacheWojId = new Map<string, string>();

/** Znajduje id jednostki województwa po nazwie (Units?level=2). Null, gdy brak. */
async function jednostkaWojewodztwa(wojNazwa: string): Promise<string | null> {
  if (!wojNazwa) return null;
  const klucz = norm(wojNazwa);
  if (cacheWojId.has(klucz)) return cacheWojId.get(klucz)!;
  const odp = await fetchJson<{ results?: { id?: string; name?: string }[] }>(
    url("units", { level: "2", "page-size": "50" }),
    { ...KONFIG_KONEKTORY.siec, naglowki: naglowki() }
  );
  const trafiona = (odp?.results ?? []).find((u) => norm(String(u.name ?? "")) === klucz);
  if (trafiona?.id) {
    cacheWojId.set(klucz, trafiona.id);
    return trafiona.id;
  }
  return null;
}

/** Cache: nazwa województwa → udział 20–39 [%] (regionalna baza odniesienia). */
const cacheMediana = new Map<string, number>();

/** Udział 20–39 dla województwa (dane BDL). Fallback do stałej krajowej, gdy brak. */
async function medianaWoj2039(wojNazwa: string, p2039: PasmoWieku[]): Promise<number | null> {
  if (!wojNazwa || p2039.length === 0) return null;
  const klucz = norm(wojNazwa);
  if (cacheMediana.has(klucz)) return cacheMediana.get(klucz)!;
  const wojId = await jednostkaWojewodztwa(wojNazwa);
  if (!wojId) return null;
  const m = await wartosciWielu(wojId, [P2137_OGOLEM_TOTAL, ...p2039.map((p) => p.id)]);
  const ogolem = m.get(P2137_OGOLEM_TOTAL);
  const suma = sumaPasm(p2039, m);
  if (!ogolem || ogolem <= 0 || suma === null) return null;
  const udzial = Math.round((suma / ogolem) * 1000) / 10;
  cacheMediana.set(klucz, udzial);
  return udzial;
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

    // Demografia — pobieramy TYLKO potrzebne zmienne (jedna paczka, bez ryzyka dławienia):
    //  20–39 = 20-24…35-39 (4 pasma); 65+ = 65-69 + „70 i więcej" (agregat) — 2 pasma,
    //  odporne (nie wymaga kompletu 13 pasm 0–64). Plus ludność ogółem, podmioty, saldo.
    const idPodmioty = gus.zmienneId.podmiotyNa10k ?? "60530";
    const idSaldo = gus.zmienneId.saldoMigracji ?? "1365234";
    const pasma = await pasmaWiekuOgolem();
    const p2039 = pasma.filter((p) => p.lo >= 20 && p.hi <= 39 && p.hi - p.lo === 4);
    const p65_69 = pasma.find((p) => p.lo === 65 && p.hi === 69);
    const p70plus = pasma.find((p) => p.lo === 70 && p.hi === Infinity); // agregat „70 i więcej"
    const p65 = [p65_69, p70plus].filter(Boolean) as PasmoWieku[];
    const potrzebne = [...new Set([P2137_OGOLEM_TOTAL, ...p2039.map((p) => p.id), ...p65.map((p) => p.id), idPodmioty, idSaldo])];
    const m = await wartosciWielu(jednostka.id, potrzebne);
    if ([...m.values()].every((v) => v === null)) {
      return brakWyniku(
        this.klucz,
        this.zrodlo,
        czas,
        `Jednostka „${jednostka.name}" (id ${jednostka.id}) znaleziona, ale data/by-unit nie zwróciło wartości (limit BDL / brak klucza X-ClientId?). Diagnostyka: /api/diag-gus?gmina=${encodeURIComponent(teren.gmina)}.`
      );
    }
    const ogolem = m.get(P2137_OGOLEM_TOTAL) ?? null;
    const pop2039 = sumaPasm(p2039, m);
    const pop65 = p65.length === 2 ? sumaPasm(p65, m) : null; // 65-69 + 70+
    const podmioty = m.get(idPodmioty) ?? null;
    const saldo = m.get(idSaldo) ?? null;

    const udzial65 = ogolem && ogolem > 0 && pop65 !== null ? (pop65 / ogolem) * 100 : null;
    if (ogolem && ogolem > 0) {
      if (udzial65 !== null) dodaj("udzial65PlusPct", udzial65, 80);
      if (pop2039 !== null) {
        dodaj("udzial2039Pct", (pop2039 / ogolem) * 100, 80);
        // Baza odniesienia „młodych": realna mediana wojewódzka (BDL) albo krajowy fallback.
        const medWoj = await medianaWoj2039(teren.wojewodztwo, p2039);
        dodaj("mediana2039Woj", medWoj ?? gus.medianaWiek2039Pct, medWoj !== null ? 75 : 55);
      }
    }
    // BDL 60530 to podmioty „na 10 tys." — model/UI używa „na 1000", więc /10.
    dodaj("liczbaPodmiotowGosp", podmioty === null ? null : podmioty / 10);
    dodaj("saldoMigracjiMlodzi", saldo, 70); // proxy: saldo ogółem (nie tylko 25–39)

    // Trend (rok bazowy → bieżący) dla 65+ i ludności ogółem — profil senioralny + „pułapka seniorów".
    if (ogolem && ogolem > 0) {
      const mBaza = await wartosciWielu(jednostka.id, [P2137_OGOLEM_TOTAL, ...p65.map((p) => p.id)], gus.rokBazowyTrend);
      const ogolemBaza = mBaza.get(P2137_OGOLEM_TOTAL);
      const pop65Baza = p65.length === 2 ? sumaPasm(p65, mBaza) : null;
      if (ogolemBaza && ogolemBaza > 0) {
        // Trend ludności → trendLudnosc + populacjaStabilna.
        const zmianaPop = (ogolem - ogolemBaza) / ogolemBaza;
        const trendL = zmianaPop > 0.01 ? "rosnaca" : zmianaPop < -0.01 ? "malejaca" : "stabilna";
        dane.trendLudnosc = trendL;
        dane.populacjaStabilna = trendL !== "malejaca";
        meta.push({ pole: "trendLudnosc", zrodlo: this.zrodlo, czas, pewnosc: 75, status: "ok", tryb: "A" });
        meta.push({ pole: "populacjaStabilna", zrodlo: this.zrodlo, czas, pewnosc: 70, status: "ok", tryb: "A" });
        // Trend udziału 65+ (punkty proc.) → trend65Plus.
        if (udzial65 !== null && pop65Baza !== null) {
          const udzial65Baza = (pop65Baza / ogolemBaza) * 100;
          const delta = udzial65 - udzial65Baza;
          dane.trend65Plus = delta > 0.5 ? "rosnacy" : delta < -0.5 ? "malejacy" : "stabilny";
          meta.push({ pole: "trend65Plus", zrodlo: this.zrodlo, czas, pewnosc: 75, status: "ok", tryb: "A" });
        }
      }
    }

    // Stopa bezrobocia rejestrowanego — poziom powiatu (jednostka nadrzędna gminy).
    const powiatId = jednostka.parentId;
    if (powiatId) {
      const mBezr = await wartosciWielu(powiatId, gus.stopaBezrobociaIds);
      const stopa = gus.stopaBezrobociaIds.map((id) => mBezr.get(id)).find((v) => v !== null && v !== undefined) ?? null;
      dodaj("bezrobociePct", stopa ?? null, 85);
    }

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
