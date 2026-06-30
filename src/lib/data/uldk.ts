/**
 * Klient ULDK (Usługa Lokalizacji Działek Katastralnych, GUGiK).
 *
 * Dwa zastosowania:
 *  1) Słownik administracyjny (kaskada TERYT: województwa → powiaty → gminy → obręby)
 *     — daje realne kody TERYT do złożenia identyfikatora działki.
 *  2) Geometria działki po identyfikatorze (GetParcelById) → powierzchnia/front.
 *
 * Funkcja parsująca odpowiedź jest czysta (testowalna offline). Funkcje sieciowe
 * mają timeout i zwracają wartość pustą przy błędzie/niedostępności (graceful
 * fallback — np. gdy egress blokuje host albo ULDK nie odpowiada).
 *
 * Uwaga środowiskowa: w niektórych środowiskach (sandbox) host
 * `uldk.gugik.gov.pl` bywa zablokowany przez politykę egress — wtedy te funkcje
 * zwracają null/[], a warstwa wyżej korzysta z fallbacku. Na docelowym hostingu
 * (np. Vercel) z otwartym dostępem do sieci działają normalnie.
 */

import { metrykiZWkt } from "../geo";
import { logDebug, skrot } from "./debug";

const BAZA = "https://uldk.gugik.gov.pl/";
const TIMEOUT_MS = 8000;

export interface ParsowanaOdpowiedz {
  ok: boolean;
  status: string;
  wiersze: string[][];
}

/** Parsuje tekstową odpowiedź ULDK: 1. linia = status ("0" = OK), reszta = wiersze `a|b|c`. */
export function parsujOdpowiedzUldk(text: string): ParsowanaOdpowiedz {
  const linie = text.replace(/﻿/g, "").split(/\r?\n/).map((l) => l.trim());
  const niepuste = linie.filter((l) => l.length > 0);
  if (niepuste.length === 0) return { ok: false, status: "", wiersze: [] };
  const status = niepuste[0];
  const ok = status === "0";
  const wiersze = niepuste.slice(1).map((l) => l.split("|"));
  return { ok, status, wiersze };
}

async function uldkFetch(params: Record<string, string>): Promise<ParsowanaOdpowiedz | null> {
  const qs = new URLSearchParams(params).toString();
  const url = `${BAZA}?${qs}`;
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    logDebug(`ULDK → ${url}`);
    const r = await fetch(url, { signal: ctrl.signal, headers: { Accept: "text/plain" } });
    if (!r.ok) {
      logDebug(`ULDK HTTP ${r.status} dla ${params.request}`);
      return null;
    }
    const txt = await r.text();
    logDebug(`ULDK ← ${params.request}: ${skrot(txt)}`);
    return parsujOdpowiedzUldk(txt);
  } catch (e) {
    logDebug(`ULDK błąd ${params.request}: ${String(e)}`);
    return null; // timeout / brak sieci / blokada egress → fallback wyżej
  } finally {
    clearTimeout(t);
  }
}

export interface PozycjaSlownika {
  teryt: string;
  nazwa: string;
}

function mapujSlownik(odp: ParsowanaOdpowiedz | null): PozycjaSlownika[] {
  if (!odp || !odp.ok) return [];
  return odp.wiersze
    .map((w) => ({ teryt: (w[0] ?? "").trim(), nazwa: (w[1] ?? "").trim() }))
    .filter((p) => p.teryt && p.nazwa)
    .sort((a, b) => a.nazwa.localeCompare(b.nazwa, "pl"));
}

export async function pobierzWojewodztwa(): Promise<PozycjaSlownika[]> {
  return mapujSlownik(await uldkFetch({ request: "GetVoivodeships", result: "teryt,name" }));
}
export async function pobierzPowiaty(wojTeryt: string): Promise<PozycjaSlownika[]> {
  return mapujSlownik(await uldkFetch({ request: "GetCounties", voivodeship: wojTeryt, result: "teryt,name" }));
}
export async function pobierzGminy(powiatTeryt: string): Promise<PozycjaSlownika[]> {
  return mapujSlownik(await uldkFetch({ request: "GetCommunes", county: powiatTeryt, result: "teryt,name" }));
}
export async function pobierzObreby(gminaTeryt: string): Promise<PozycjaSlownika[]> {
  // region teryt ma postać `<gmina_teryt>.<obreb>` — wycinamy człon obrębu.
  const sl = mapujSlownik(await uldkFetch({ request: "GetRegions", commune: gminaTeryt, result: "teryt,name" }));
  return sl.map((p) => ({ ...p, teryt: p.teryt.includes(".") ? p.teryt.split(".").pop()! : p.teryt }));
}

/** Dopasowanie po nazwie: dokładne (bez wielkości liter), potem „zawiera". */
export function dopasujPoNazwie(opcje: PozycjaSlownika[], nazwa: string): PozycjaSlownika | null {
  const n = nazwa.toLowerCase().trim();
  if (!n) return null;
  return (
    opcje.find((o) => o.nazwa.toLowerCase().trim() === n) ??
    opcje.find((o) => o.nazwa.toLowerCase().includes(n)) ??
    null
  );
}

/**
 * Ustala kod TERYT gminy z samych nazw (woj → powiat → gmina) przez słownik
 * administracyjny ULDK. Pozwala złożyć poprawny identyfikator działki nawet gdy
 * użytkownik wpisał nazwy ręcznie (klient nie złapał kodu). Zwraca null, gdy
 * nie uda się dopasować na którymś poziomie.
 */
export async function rozwiazTerytGminy(woj: string, powiat: string, gmina: string): Promise<string | null> {
  if (!woj || !powiat || !gmina) return null;
  const w = dopasujPoNazwie(await pobierzWojewodztwa(), woj);
  if (!w) return null;
  const p = dopasujPoNazwie(await pobierzPowiaty(w.teryt), powiat);
  if (!p) return null;
  const g = dopasujPoNazwie(await pobierzGminy(p.teryt), gmina);
  return g?.teryt ?? null;
}

export interface DzialkaUldk {
  id: string;
  powierzchniaM2: number;
  frontM: number | null;
  proporcjaBokow: number | null;
  wojewodztwo: string;
  powiat: string;
  gmina: string;
  geomWkt: string;
}

/** Pobiera geometrię i atrybuty działki po identyfikatorze ULDK. */
export async function pobierzDzialkePoId(id: string): Promise<DzialkaUldk | null> {
  const odp = await uldkFetch({
    request: "GetParcelById",
    id,
    result: "geom_wkt,voivodeship,county,commune,region",
    srid: "2180",
  });
  if (!odp || !odp.ok || odp.wiersze.length === 0) return null;
  const w = odp.wiersze[0];
  const geomWkt = (w[0] ?? "").trim();
  if (!geomWkt) return null;
  const m = metrykiZWkt(geomWkt);
  return {
    id,
    powierzchniaM2: m.powierzchniaM2,
    frontM: m.frontM,
    proporcjaBokow: m.proporcjaBokow,
    wojewodztwo: (w[1] ?? "").trim(),
    powiat: (w[2] ?? "").trim(),
    gmina: (w[3] ?? "").trim(),
    geomWkt,
  };
}
