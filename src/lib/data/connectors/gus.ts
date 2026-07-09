/**
 * Konektor GUS BDL — demografia i rynek pracy (M1, Poziom 1).
 *
 * Auto-dobór zmiennych z katalogu BDL po nazwie (`variables/search`) — frazy są
 * stabilniejsze niż numeryczne ID; konektor sam znajduje ID na BDL (można je
 * nadpisać w konfiguracji `zmienneId`). Następnie:
 *  - units/search → jednostka gminy,
 *  - data/by-unit → wartości zmiennych,
 *  - wyliczenie udziałów (65+, 20–64 aktywni) z liczebności / ludności ogółem.
 *
 * Funkcje parsujące są czyste (testowane offline). Brak danych → status „brak".
 */

import type { DaneDzialki, DynamikaGminy, PunktSzeregu } from "../../types";
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

/**
 * Wybiera aktualną jednostkę BDL; pomija jednostki archiwalne („…do 2001").
 *
 * Zakotwiczenie po TERYT (gdy podano `teryt` = WWPPGG): id jednostki BDL zawiera
 * kod TERYT gminy, więc kandydat, którego id zawiera ten kod, to NA PEWNO właściwa
 * gmina — nawet gdy w Polsce istnieje kilka gmin o tej samej nazwie w różnych
 * województwach (np. „Brzeziny", „Kamień"). Bez tej kotwicy dobór po samej nazwie
 * mógł trafić w duplikat z innego regionu (błąd „dane innej gminy niż działka").
 * Gdy żaden kandydat nie zawiera kodu (nietypowy format id) — schodzimy do doboru
 * po nazwie, więc zmiana nie może pogorszyć dotychczasowego zachowania.
 */
export function wybierzJednostke(json: unknown, nazwa: string, teryt?: string): JednostkaBDL | null {
  const wyniki = (json as { results?: JednostkaBDL[] })?.results;
  if (!Array.isArray(wyniki) || wyniki.length === 0) return null;
  const dopasuj = (s: string) => s.toLowerCase().trim();
  // Pomijamy jednostki archiwalne (mają id, ale data/by-unit nic nie zwraca).
  // Gdy w tej odpowiedzi są SAME archiwalne → zwracamy null, aby konektor spróbował
  // innego wyszukiwania (np. bez filtra poziomu) i znalazł aktualną jednostkę.
  const aktualne = wyniki.filter((u) => !jednostkaHistoryczna(u.name));
  if (aktualne.length === 0) return null;
  const kod = (teryt ?? "").replace(/\D/g, "").slice(0, 6);
  // KOTWICA TERYT: spośród kandydatów bierzemy tych, których id zawiera kod gminy.
  const poTeryt = kod.length === 6 ? aktualne.filter((u) => (u.id ?? "").includes(kod)) : [];
  const pula = poTeryt.length > 0 ? poTeryt : aktualne;
  // Preferencja w obrębie puli: dokładna nazwa → nazwa zawierająca szukaną
  // (np. „Powiat m.st. Warszawa") → pierwsza. Gdy kotwica TERYT zadziałała, pula
  // ma już właściwą gminę, więc „pierwsza" jest bezpieczna.
  return (
    pula.find((u) => dopasuj(u.name) === dopasuj(nazwa)) ??
    pula.find((u) => dopasuj(u.name).includes(dopasuj(nazwa))) ??
    pula[0]
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
 * SZEREGI CZASOWE wielu zmiennych (panel dynamiki gminy). data/by-unit z wieloma
 * `year` (ostatnie `lata` roczniki) → mapa id → [{rok, wartość|null}] posortowana
 * rosnąco. Braki (attrId===0) jako null (luka w wykresie, NIE zero). Jedna paczka
 * (≤12 zmiennych), bez pinowania jednego roku.
 */
async function szeregiWielu(unitId: string, varIds: string[], lata: number[]): Promise<Map<string, PunktSzeregu[]>> {
  const map = new Map<string, PunktSzeregu[]>();
  const ids = varIds.filter(Boolean);
  if (ids.length === 0) return map;
  const qs = new URLSearchParams({ format: "json" });
  if (gus.clientId) qs.set("client-id", gus.clientId);
  for (const r of lata) qs.append("year", String(r));
  for (const id of ids.slice(0, 12)) qs.append("var-id", id);
  const odp = await fetchJson<{ results?: { id?: string | number; values?: { year?: string | number; val?: number; attrId?: number }[] }[] }>(
    `${gus.endpoint}/data/by-unit/${encodeURIComponent(unitId)}?${qs.toString()}`,
    { ...KONFIG_KONEKTORY.siec, naglowki: naglowki() }
  );
  for (const r of odp?.results ?? []) {
    const punkty: PunktSzeregu[] = (r.values ?? [])
      .map((v) => ({ rok: Number(v.year), wartosc: v.attrId === 0 || typeof v.val !== "number" ? null : v.val }))
      .filter((p) => Number.isFinite(p.rok))
      .sort((a, b) => a.rok - b.rok);
    if (punkty.length) map.set(String(r.id), punkty);
  }
  return map;
}

/**
 * Panel dynamiki gminy — 5 szeregów rocznych (~10 lat), CZYSTY KONTEKST (nie zmienia
 * popytu). Degradacja łagodna: brak szeregu → pole null (wykres znika), nigdy nie
 * wywraca panelu. Jedna próba; wyjątek → cały panel null (ludność jest kotwicą UI).
 */
async function pobierzDynamike(unitId: string): Promise<DynamikaGminy | null> {
  try {
    const rokDo = gus.rok;
    const lata = Array.from({ length: gus.dynamikaLata }, (_, i) => rokDo - (gus.dynamikaLata - 1) + i);
    const idLudnosc = totalIdWieku();
    const idPodmioty = gus.zmienneId.podmiotyNa10k ?? "60530";
    // Potwierdzone ID mają pierwszeństwo; inaczej dobór odporny (poziom gminy + jednostka).
    const idMieszkania = gus.zmienneId.mieszkaniaOddane ?? (await idDynamiki(gus.zapytania.mieszkaniaOddane)); // jedn. „-"
    const idDochody = gus.zmienneId.dochodyWlasne ?? (await idDynamiki(gus.zapytania.dochodyWlasne, "zł"));
    const idBezrobotni = gus.zmienneId.bezrobotniLiczba ?? (await idDynamiki(gus.zapytania.bezrobotniLiczba, "osoba"));
    const ids = [idLudnosc, idPodmioty, idMieszkania, idDochody, idBezrobotni].filter(Boolean) as string[];
    const m = await szeregiWielu(unitId, ids, lata);
    const wez = (id: string | null): PunktSzeregu[] | null => (id ? m.get(id) ?? null : null);
    const dyn: DynamikaGminy = {
      ludnosc: wez(idLudnosc),
      mieszkaniaOddane: wez(idMieszkania),
      podmioty: wez(idPodmioty),
      dochodyWlasne: wez(idDochody),
      bezrobotni: wez(idBezrobotni),
    };
    // Panel ma sens tylko z kotwicą (ludność) lub jakimkolwiek szeregiem.
    const cokolwiek = Object.values(dyn).some((s) => s && s.length > 0);
    return cokolwiek ? dyn : null;
  } catch {
    return null;
  }
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
/** Cache ID zmiennej „ludność ogółem" (wiek=ogółem, płeć=ogółem) — dynamicznie z katalogu P2137. */
let cacheTotalId: string | null = null;

/** ID zmiennej „ludność ogółem" z tematu P2137 (samodobór; fallback do stałej). */
export function totalIdWieku(): string {
  return cacheTotalId ?? P2137_OGOLEM_TOTAL;
}

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
    const wiek = (czesci[0] ?? "").toLowerCase().trim();
    const zakres = zakresWieku(czesci[0] ?? "");
    if (zakres) out.push({ id: String(r.id), lo: zakres[0], hi: zakres[1] });
    else if (wiek === "ogółem" || wiek === "ogolem") cacheTotalId = String(r.id); // grand total (wiek=ogółem)
  }
  if (out.length > 0) cachePasma = out;
  return out;
}

/** Pełna, nienakładająca się partycja wieku: 5-letnie pasma (0-4…80-84) + otwarte „85 i więcej". */
function partycjaWieku(pasma: PasmoWieku[]): PasmoWieku[] {
  return pasma.filter((p) => p.hi - p.lo === 4 || (p.lo === 85 && p.hi === Infinity));
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

// ── Regionalna baza odniesienia (mediana wojewódzka 20–64 aktywni) ───────────────────

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

/** Cache: nazwa województwa → udział 20–64 [%] (regionalna baza odniesienia). */
const cacheMediana = new Map<string, number>();

/** Udział 20–64 (aktywni) dla województwa (dane BDL). Fallback do stałej krajowej, gdy brak. */
async function medianaWojAktywni(wojNazwa: string, pAktywni: PasmoWieku[]): Promise<number | null> {
  if (!wojNazwa || pAktywni.length === 0) return null;
  const klucz = norm(wojNazwa);
  if (cacheMediana.has(klucz)) return cacheMediana.get(klucz)!;
  const wojId = await jednostkaWojewodztwa(wojNazwa);
  if (!wojId) return null;
  const idTotal = totalIdWieku();
  const pPartycja = partycjaWieku(cachePasma ?? pAktywni);
  const m = await wartosciWielu(wojId, [idTotal, P2137_OGOLEM_TOTAL, ...pAktywni.map((p) => p.id), ...pPartycja.map((p) => p.id)]);
  const ogolem = m.get(idTotal) ?? m.get(P2137_OGOLEM_TOTAL) ?? sumaPasm(pPartycja, m);
  const suma = sumaPasm(pAktywni, m);
  if (!ogolem || ogolem <= 0 || suma === null) return null;
  const udzial = Math.round((suma / ogolem) * 1000) / 10;
  cacheMediana.set(klucz, udzial);
  return udzial;
}

/** Auto-dobór id zmiennej BDL z katalogu po frazie (cache per fraza). */
const cacheIdFraza = new Map<string, string | null>();
async function idZmiennejPoFrazie(fraza: string): Promise<string | null> {
  if (!fraza) return null;
  if (cacheIdFraza.has(fraza)) return cacheIdFraza.get(fraza)!;
  const odp = await fetchJson(url("variables/search", { name: fraza, "page-size": "100" }), {
    ...KONFIG_KONEKTORY.siec,
    naglowki: naglowki(),
  });
  const id = pierwszaZmienna(odp);
  cacheIdFraza.set(fraza, id);
  return id;
}

/**
 * Dobór ID zmiennej BDL dla panelu dynamiki — ODPORNY na wieloznaczność frazy:
 * spośród wyników preferuje poziom GMINY (6) i pasującą JEDNOSTKĘ (np. „zł", „osoba"),
 * a przy remisie krótszą nazwę (zwykle „· ogółem", nie przekrój). Fallback: pierwszy wynik.
 */
const cacheIdDynamiki = new Map<string, string | null>();
async function idDynamiki(fraza: string, jednostkaZawiera?: string): Promise<string | null> {
  if (!fraza) return null;
  const klucz = `${fraza}::${jednostkaZawiera ?? ""}`;
  if (cacheIdDynamiki.has(klucz)) return cacheIdDynamiki.get(klucz)!;
  const odp = await fetchJson<{ results?: { id?: number | string; n1?: string; n2?: string; n3?: string; level?: number | string; measureUnitName?: string }[] }>(
    url("variables/search", { name: fraza, "page-size": "100" }),
    { ...KONFIG_KONEKTORY.siec, naglowki: naglowki() }
  );
  const wyniki = odp?.results ?? [];
  const nazwa = (r: (typeof wyniki)[number]) => [r.n1, r.n2, r.n3].filter(Boolean).join(" ").toLowerCase();
  const pasujeJedn = (r: (typeof wyniki)[number]) =>
    !jednostkaZawiera || (r.measureUnitName ?? "").toLowerCase().includes(jednostkaZawiera.toLowerCase());
  // Odrzuć przekroje miesięczne/wskaźnikowe — chcemy ROCZNĄ sumę (lub roczny wskaźnik).
  const MIESIACE = /(stycze|lut|marz|kwiec|maj|czerw|lip|sierp|wrze|paździe|listopad|grud)/;
  const OKRESY = /(styczeń-|-luty|-marzec|-kwiecień|-maj|-czerwiec|-lipiec|-sierpień|-wrzesień|-październik|-listopad)/;
  const roczne = wyniki.filter((r) => !MIESIACE.test(nazwa(r)) || nazwa(r).includes("styczeń-grudzień"));
  const zbiorBaza = roczne.length ? roczne : wyniki;
  const kandydaci = zbiorBaza.filter(pasujeJedn);
  const zbior = kandydaci.length ? kandydaci : zbiorBaza;
  // Preferuj „ogółem"/roczne, a przy braku — najkrótszą nazwę (najmniej przekrojów).
  const wybrany =
    zbior.find((r) => nazwa(r).includes("styczeń-grudzień") && nazwa(r).includes("ogółem")) ??
    zbior.find((r) => nazwa(r).includes("ogółem") && !OKRESY.test(nazwa(r))) ??
    [...zbior].sort((a, b) => nazwa(a).length - nazwa(b).length)[0];
  const id = wybrany?.id != null ? String(wybrany.id) : null;
  cacheIdDynamiki.set(klucz, id);
  return id;
}

/** Diagnostyka: wyszukiwanie zmiennych BDL po frazie (id, nazwa, jednostka, poziom). */
export async function diagZmienne(fraza: string): Promise<unknown> {
  const odp = await fetchJson<{ results?: Record<string, unknown>[] }>(
    url("variables/search", { name: fraza, "page-size": "100" }),
    { ...KONFIG_KONEKTORY.siec, naglowki: naglowki() }
  );
  return (odp?.results ?? []).map((r) => ({
    id: r.id,
    nazwa: [r.n1, r.n2, r.n3].filter(Boolean).join(" · "),
    jednostka: r.measureUnitName ?? null,
    poziom: r.level ?? null,
  }));
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
    let jednostka = wybierzJednostke(jedn, teren.gmina, teren.teryt);
    if (!jednostka) {
      const jedn2 = await fetchJson(url("units/search", { name: teren.gmina }), { ...KONFIG_KONEKTORY.siec, naglowki: naglowki() });
      jednostka = wybierzJednostke(jedn2, teren.gmina, teren.teryt);
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
    //  20–64 (aktywni) = 20-24…60-64 (9 pasm); 65+ = 65-69 + „70 i więcej" (agregat) — 2 pasma,
    //  odporne (nie wymaga kompletu 13 pasm 0–64). Plus ludność ogółem, podmioty, saldo.
    const idPodmioty = gus.zmienneId.podmiotyNa10k ?? "60530";
    const idSaldo = gus.zmienneId.saldoMigracji ?? "1365234";
    const idDochod = gus.dochodId;
    // Napływ/odpływ migracji brutto — ID z konfiguracji lub auto-dobór po frazie (weryfikacja: ?vars=).
    const idZamel = gus.zameldowaniaId ?? (await idZmiennejPoFrazie(gus.zapytania.zameldowania));
    const idWymel = gus.wymeldowaniaId ?? (await idZmiennejPoFrazie(gus.zapytania.wymeldowania));
    const opcjonalne = [idDochod, idZamel, idWymel].filter(Boolean) as string[];
    const pasma = await pasmaWiekuOgolem();
    const idTotal = totalIdWieku(); // ID „ludność ogółem" (dynamiczne z katalogu, fallback do stałej)
    const pAktywni = pasma.filter((p) => p.lo >= 20 && p.hi <= 64 && p.hi - p.lo === 4);
    // 65+: agregat „70 i więcej" (odporny na braki) LUB pasma szczegółowe 65-69…85+ (fallback).
    const p65agg = [pasma.find((p) => p.lo === 65 && p.hi === 69), pasma.find((p) => p.lo === 70 && p.hi === Infinity)].filter(Boolean) as PasmoWieku[];
    const p65gran = pasma.filter((p) => p.lo >= 65 && (p.hi - p.lo === 4 || (p.lo >= 85 && p.hi === Infinity)));
    const idsWieku65 = [...new Set([...p65agg, ...p65gran].map((p) => p.id))];
    // Pełna, nienakładająca się partycja wieku (0-4…80-84 + 85+) — suma = ludność ogółem,
    // gdy zmienna „ogółem" nie zwraca wartości (obserwowane dla części jednostek).
    const pPartycja = partycjaWieku(pasma);
    const potrzebne = [...new Set([idTotal, P2137_OGOLEM_TOTAL, ...pAktywni.map((p) => p.id), ...idsWieku65, ...pPartycja.map((p) => p.id), idPodmioty, idSaldo, ...opcjonalne])];
    const m = await wartosciWielu(jednostka.id, potrzebne);
    if ([...m.values()].every((v) => v === null)) {
      return brakWyniku(
        this.klucz,
        this.zrodlo,
        czas,
        `Jednostka „${jednostka.name}" (id ${jednostka.id}) znaleziona, ale data/by-unit nie zwróciło wartości (limit BDL / brak klucza X-ClientId?). Diagnostyka: /api/diag-gus?gmina=${encodeURIComponent(teren.gmina)}.`
      );
    }
    // Ludność ogółem: dynamiczne ID → stałe ID → suma pasm aktywni+65+ (ostatnia deska ratunku).
    const popAktywni = sumaPasm(pAktywni, m);
    const pop65 = (p65agg.length === 2 ? sumaPasm(p65agg, m) : null) ?? (p65gran.length > 0 ? sumaPasm(p65gran, m) : null);
    const ogolem = m.get(idTotal) ?? m.get(P2137_OGOLEM_TOTAL) ?? sumaPasm(pPartycja, m);
    const podmioty = m.get(idPodmioty) ?? null;

    // MIGRACJA — fallback roczny. Zapytanie pinuje `year=gus.rok`, a saldo/wymeldowania
    // bywają publikowane z opóźnieniem (obserwacja: Katowice mają zameldowania 2023,
    // ale saldo i wymeldowania puste). Gdy któraś zmienna migracyjna jest null dla
    // bieżącego roku, sięgamy po najnowszy dostępny (rok-1, rok-2) — tylko dla tych ID.
    let saldo = m.get(idSaldo) ?? null;
    let zamel = idZamel ? m.get(idZamel) ?? null : null;
    let wymel = idWymel ? m.get(idWymel) ?? null : null;
    const migIds = [idSaldo, idZamel, idWymel].filter(Boolean) as string[];
    const brakMig = () => (saldo == null) || (idZamel != null && zamel == null) || (idWymel != null && wymel == null);
    for (const rokFb of [gus.rok - 1, gus.rok - 2]) {
      if (!brakMig() || migIds.length === 0) break;
      const mFb = await wartosciWielu(jednostka.id, migIds, rokFb);
      if (saldo == null) saldo = mFb.get(idSaldo) ?? null;
      if (idZamel && zamel == null) zamel = mFb.get(idZamel) ?? null;
      if (idWymel && wymel == null) wymel = mFb.get(idWymel) ?? null;
    }

    const udzial65 = ogolem && ogolem > 0 && pop65 !== null ? (pop65 / ogolem) * 100 : null;
    // Liczby bezwzględne (popyt P1: trójdzielny podział + benchmarki per mieszkaniec).
    if (ogolem && ogolem > 0) dodaj("liczbaMieszkancowGminy", ogolem, 85);
    if (popAktywni !== null) dodaj("liczbaAktywni", popAktywni, 80);
    if (pop65 !== null) dodaj("liczba65Plus", pop65, 80);
    // Dochód i migracje brutto — tylko gdy skonfigurowano ID zmiennych BDL (inaczej fallback w modelu).
    if (idDochod) dodaj("dochodPrzecietnyGmina", m.get(idDochod) ?? null, 70);
    if (idZamel && ogolem && ogolem > 0) {
      dodaj("naplywZameldowanNa1000", zamel == null ? null : (zamel / ogolem) * 1000, 75);
    }
    if (idWymel && ogolem && ogolem > 0) {
      dodaj("odplywMlodychNa1000", wymel == null ? null : (wymel / ogolem) * 1000, 65);
    }
    if (ogolem && ogolem > 0) {
      if (udzial65 !== null) dodaj("udzial65PlusPct", udzial65, 80);
      if (popAktywni !== null) {
        dodaj("udzialAktywniPct", (popAktywni / ogolem) * 100, 80);
        // Baza odniesienia „aktywnych": realna mediana wojewódzka (BDL) albo krajowy fallback.
        const medWoj = await medianaWojAktywni(teren.wojewodztwo, pAktywni);
        dodaj("medianaAktywniWoj", medWoj ?? gus.medianaWiekAktywniPct, medWoj !== null ? 75 : 55);
      }
    }
    // BDL 60530 to podmioty „na 10 tys." — model/UI używa „na 1000", więc /10.
    dodaj("liczbaPodmiotowGosp", podmioty === null ? null : podmioty / 10);
    dodaj("saldoMigracjiMlodzi", saldo, 70); // proxy: saldo ogółem (nie tylko 25–39)

    // NSP (rok spisu): udział gospodarstw BEZ tytułu własności = realna, per-gmina
    // kalibracja „bez własnego lokalu" (definicja profili). udział bez = 1 − własność/ogółem.
    const idGospOgolem = gus.zmienneId.gospodarstwaOgolem ?? (await idZmiennejPoFrazie(gus.zapytania.gospodarstwaOgolem));
    const idGospWlasnosc = gus.zmienneId.gospodarstwaWlasnosc ?? (await idZmiennejPoFrazie(gus.zapytania.gospodarstwaWlasnosc));
    if (idGospOgolem && idGospWlasnosc) {
      const mNsp = await wartosciWielu(jednostka.id, [idGospOgolem, idGospWlasnosc], gus.nspRok);
      const gOgolem = mNsp.get(idGospOgolem);
      const gWlasnosc = mNsp.get(idGospWlasnosc);
      if (gOgolem && gOgolem > 0 && gWlasnosc != null) {
        const bezPct = Math.max(0, Math.min(100, (1 - gWlasnosc / gOgolem) * 100));
        dodaj("udzialGospodarstwBezWlasnosciPct", bezPct, 78);
      }
    }

    // Trend (rok bazowy → bieżący) dla 65+ i ludności ogółem — profil senioralny + „pułapka seniorów".
    if (ogolem && ogolem > 0) {
      const mBaza = await wartosciWielu(jednostka.id, [idTotal, P2137_OGOLEM_TOTAL, ...idsWieku65, ...pPartycja.map((p) => p.id)], gus.rokBazowyTrend);
      const ogolemBaza = mBaza.get(idTotal) ?? mBaza.get(P2137_OGOLEM_TOTAL) ?? sumaPasm(pPartycja, mBaza);
      const pop65Baza = (p65agg.length === 2 ? sumaPasm(p65agg, mBaza) : null) ?? (p65gran.length > 0 ? sumaPasm(p65gran, mBaza) : null);
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

    // Poziom powiatu (jednostka nadrzędna gminy): stopa bezrobocia + przeciętne wynagrodzenie.
    // BDL nie publikuje dochodu gospodarstw na poziomie GMINY — realnym zakotwiczeniem
    // podziału dochodowego (K/S/R) jest wynagrodzenie powiatowe (proxy), nie estymacja regionalna.
    const powiatId = jednostka.parentId;
    if (powiatId) {
      const idWyn = gus.zmienneId.wynagrodzenie ?? (await idZmiennejPoFrazie(gus.zapytania.wynagrodzenie));
      const potrzebnePow = idWyn ? [...gus.stopaBezrobociaIds, idWyn] : gus.stopaBezrobociaIds;
      const mPow = await wartosciWielu(powiatId, potrzebnePow);
      const stopa = gus.stopaBezrobociaIds.map((id) => mPow.get(id)).find((v) => v !== null && v !== undefined) ?? null;
      dodaj("bezrobociePct", stopa ?? null, 85);
      // Nie nadpisujemy dochodu, jeśli wcześniej ustawiono go z jawnej zmiennej gminnej (gus.dochodId).
      if (idWyn && dane.dochodPrzecietnyGmina == null) {
        const wyn = mPow.get(idWyn);
        if (wyn != null) {
          // Odporność na dobór zmiennej-indeksu „Polska=100" (wartość ~50–200 zamiast zł):
          // gdy wartość jest zbyt mała na wynagrodzenie, traktujemy ją jako % średniej krajowej.
          const zl = wyn < 400 ? (wyn / 100) * gus.wynagrodzenieKrajoweMies : wyn;
          dodaj("dochodPrzecietnyGmina", zl * gus.dochodMnoznikWynagrodzenie, 68);
        }
      }
    }

    // Panel dynamiki gminy — szeregi ~10 lat (czysty kontekst; degradacja łagodna,
    // wyjątek → null, nie wywraca reszty wyniku). Nie liczy się do `dane` progu poniżej.
    const dynamika = await pobierzDynamike(jednostka.id);
    if (dynamika) {
      dane.dynamikaGminy = dynamika;
      meta.push({ pole: "dynamikaGminy", zrodlo: this.zrodlo, czas, pewnosc: 80, status: "ok", tryb: "A" });
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
